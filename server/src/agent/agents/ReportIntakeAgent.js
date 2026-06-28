import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const ReportIntakeAgent = {
  async execute(ctx) {
    const { reportData, trace } = ctx;
    
    // 1. Intake
    const completeIntake = trace.startStep('intake', { reportData });
    const intakeResult = {
      report_id: reportData.id || 'new',
      text: reportData.text,
      lat: reportData.lat,
      lng: reportData.lng,
      reporter_id: reportData.reporter_id || 'anonymous',
      reporter_name: reportData.reporter_name || 'Anonymous',
      address: reportData.address || null,
      media_urls: reportData.media_urls || [],
    };

    // Validate coordinates (restrict to Lucknow bounding box)
    const latitude = parseFloat(reportData.lat);
    const longitude = parseFloat(reportData.lng);
    
    const minLat = 26.75;
    const maxLat = 26.95;
    const minLng = 80.85;
    const maxLng = 81.05;

    if (Number.isNaN(latitude) || Number.isNaN(longitude) || 
        latitude < minLat || latitude > maxLat || 
        longitude < minLng || longitude > maxLng) {
      trace.logStep('validation_error', { lat: reportData.lat, lng: reportData.lng }, { error: 'Invalid coordinates' }, 'Coordinates are outside Lucknow city boundaries.', 0);
      throw new Error('Invalid coordinates: Out of Lucknow boundaries');
    }

    ctx.intakeResult = intakeResult;
    ctx.latitude = latitude;
    ctx.longitude = longitude;

    const intakeReasoning = await enrichReasoning('intake', intakeResult) || 'Citizen report successfully received and logged.';
    completeIntake(intakeResult, intakeReasoning);

    // 2. Classification
    const completeClassify = trace.startStep('classify_issue', { text: reportData.text });
    let classificationResult = ctx.classificationResult;
    if (!classificationResult) {
      classificationResult = await toolHandlers.classify_issue({ text: reportData.text, has_media: !!ctx.mediaUrls.length }, ctx);
    }
    ctx.classificationResult = classificationResult;
    const classificationReasoning = await enrichReasoning('classify_issue', classificationResult) || `Categorized as [${classificationResult.category}] with severity [${classificationResult.severity}] (confidence: ${classificationResult.confidence}).`;
    completeClassify(classificationResult, classificationReasoning);

    // 3. Geo
    const completeGeo = trace.startStep('geo_resolve', { lat: latitude, lng: longitude });
    const geoResult = await toolHandlers.geo_resolve({ lat: latitude, lng: longitude });
    ctx.geoResult = geoResult;
    const geoReasoning = await enrichReasoning('geo_resolve', geoResult) || `Geospatial match resolved location coordinates to ward [${geoResult.ward}].`;
    completeGeo(geoResult, geoReasoning);

    // Dispatch message to ClusteringAgent
    ctx.messageBus?.sendMessage('ReportIntakeAgent', 'ClusteringAgent', 'intake_processed', {
      category: ctx.classificationResult.category,
      ward: geoResult.ward,
      lat: latitude,
      lng: longitude
    });
  }
};
