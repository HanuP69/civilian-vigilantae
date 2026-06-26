import { enrichReasoning } from '../enricher.js';
import { calculateVerificationScore, statusFromVerificationScore } from '../../math/verification.js';

export const VerificationAgent = {
  async execute(ctx) {
    const { trace, classificationResult, clusterResult, userId } = ctx;
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
    const nearbyEvidence = clusterResult.found ? Math.min((clusterResult.cluster_size || 1) / 5, 1.0) : 0.0;
    const communityVotes = 0.5; // neutral initial value

    const vScore = calculateVerificationScore({
      aiConfidence,
      reporterTrust,
      nearbyEvidence,
      communityVotes,
    });
    const vStatus = statusFromVerificationScore(vScore);

    const verificationResult = {
      verification_score: vScore,
      status: vStatus,
      explanation: `Verification score ${vScore}% derived from AI confidence, reporter reputation trust, and cluster density.`,
    };

    ctx.verificationResult = verificationResult;
    ctx.vStatus = vStatus;

    const reasoning = await enrichReasoning('record_verification', verificationResult) || `Multi-agent verification resolved score to ${vScore}% (${vStatus}).`;
    completeVerify(verificationResult, reasoning);
  }
};
