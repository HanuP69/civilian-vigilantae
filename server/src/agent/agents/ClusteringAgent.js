import { enrichReasoning } from '../enricher.js';
import { toolHandlers } from '../toolHandlers.js';

export const ClusteringAgent = {
  async execute(ctx) {
    const { trace, latitude, longitude, classificationResult } = ctx;
    const completeCluster = trace.startStep('find_cluster', { lat: latitude, lng: longitude, category: classificationResult.category });

    const clusterResult = await toolHandlers.find_cluster({
      lat: latitude,
      lng: longitude,
      category: classificationResult.category,
      timestamp: new Date().toISOString(),
    });

    ctx.clusterResult = clusterResult;

    const reasoning = await enrichReasoning('find_cluster', clusterResult) || (clusterResult.found ? `Duplicate alert: matches existing incident swarm #${clusterResult.ticket_id}.` : 'No duplicate hotspots identified in proximity.');
    completeCluster(clusterResult, reasoning);
  }
};
