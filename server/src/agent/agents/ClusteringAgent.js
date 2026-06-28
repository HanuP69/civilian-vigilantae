import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const ClusteringAgent = {
  async execute(ctx) {
    const { trace, latitude, longitude, classificationResult, reportData } = ctx;
    const completeCluster = trace.startStep('find_cluster', { lat: latitude, lng: longitude, category: classificationResult.category });

    const clusterResult = await toolHandlers.find_cluster({
      lat: latitude,
      lng: longitude,
      category: classificationResult.category,
      timestamp: new Date().toISOString(),
      text: reportData?.text || '',
    });

    ctx.clusterResult = clusterResult;

    const reasoning = await enrichReasoning('find_cluster', clusterResult) || (clusterResult.found ? `Duplicate alert: matches existing incident cluster #${clusterResult.ticket_id}.` : 'No duplicate hotspots identified in proximity.');
    completeCluster(clusterResult, reasoning);

    // Dispatch message to VerificationAgent
    ctx.messageBus?.sendMessage('ClusteringAgent', 'VerificationAgent', 'clustering_processed', {
      found: clusterResult.found,
      ticket_id: clusterResult.ticket_id || null,
      neighbors_count: clusterResult.neighbors?.length || 0
    });
  }
};
