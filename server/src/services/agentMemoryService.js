import { db } from '../config/firebase.js';

/**
 * Calculates the historical dispute ratio for a given ward.
 * Helps agents adjust verification parameters based on past ward activity pattern learning.
 *
 * @param {string} ward
 * @returns {Promise<number>} dispute ratio in [0, 1]
 */
export async function getWardDisputeRatio(ward) {
  if (!ward) return 0.0;
  try {
    const ticketsSnap = await db.collection('tickets')
      .where('ward', '==', ward)
      .get();
    
    let total = 0;
    let disputed = 0;
    
    ticketsSnap.forEach(doc => {
      const t = doc.data();
      total++;
      // Consider disputed if low verification score or marked status dispute
      if (t.verification_score < 30 || (t.verification_explanation && t.verification_explanation.toLowerCase().includes('dispute'))) {
        disputed++;
      }
    });

    if (total === 0) return 0.0;
    return disputed / total;
  } catch (err) {
    console.warn(`[AgentMemory] Failed to get dispute ratio for ward ${ward}:`, err.message);
    return 0.0;
  }
}
