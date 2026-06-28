import { enrichReasoning } from '../enricher.js';
import { calculateVerificationScore, statusFromVerificationScore, calculateNearbyEvidence } from '../../math/verification.js';

export const VerificationAgent = {
  async execute(ctx) {
    const { trace, classificationResult, clusterResult, userId, latitude, longitude } = ctx;
    const completeVerify = trace.startStep('record_verification', { found: clusterResult.found });

    let reporterTrust = 0.5;
    if (userId && userId !== 'anonymous') {
      try {
        const { db } = await import('../../config/firebase.js');
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          reporterTrust = userDoc.data().trust_score ?? 0.5;
        }
      } catch (err) {
        console.warn('[VerificationAgent] Failed to fetch reporter trust:', err.message);
      }
    }

    const aiConfidence = classificationResult.confidence ?? 0.5;
    const nearbyEvidence = calculateNearbyEvidence(latitude, longitude, clusterResult.neighbors || []);
    
    // Cross-report learning pattern memory: query ward dispute history
    let memoryPenalty = 0;
    if (ctx.geoResult?.ward) {
      try {
        const { getWardDisputeRatio } = await import('../../services/agentMemoryService.js');
        const disputeRatio = await getWardDisputeRatio(ctx.geoResult.ward);
        if (disputeRatio > 0.3) {
          memoryPenalty = Math.min((disputeRatio - 0.3) * 0.5, 0.4);
          console.log(`[AgentMemory] High dispute ratio (${(disputeRatio*100).toFixed(1)}%) in ward ${ctx.geoResult.ward}. Restricting reporterTrust by penalty: ${memoryPenalty}`);
        }
      } catch (memErr) {
        console.warn('[VerificationAgent] Memory lookup failed:', memErr.message);
      }
    }

    const adjustedReporterTrust = Math.max(0.1, reporterTrust - memoryPenalty);
    const communityVotes = 0.5; // neutral initial value

    const vScore = calculateVerificationScore({
      aiConfidence,
      reporterTrust: adjustedReporterTrust,
      nearbyEvidence,
      communityVotes,
    });
    const vStatus = statusFromVerificationScore(vScore);

    const verificationResult = {
      verification_score: vScore,
      status: vStatus,
      explanation: `Verification score ${vScore}% derived from AI confidence, reporter reputation trust (adjusted by memory penalty: ${memoryPenalty.toFixed(2)}), and cluster density.`,
    };

    ctx.verificationResult = verificationResult;
    ctx.vStatus = vStatus;

    const reasoning = await enrichReasoning('record_verification', verificationResult) || `Multi-agent verification resolved score to ${vScore}% (${vStatus}).`;
    completeVerify(verificationResult, reasoning);

    // Dispatch message to PriorityAgent
    ctx.messageBus?.sendMessage('VerificationAgent', 'PriorityAgent', 'verification_processed', {
      score: vScore,
      status: vStatus,
      memory_penalty: memoryPenalty
    });
  }
};
