import { db } from '../config/firebase.js';
import { getDashboardStats } from './ticketService.js';
import { awardXP } from './userService.js';

const WARD_CENTERS = {
  'Hazratganj': { lat: 26.8500, lng: 80.9450 },
  'Aminabad': { lat: 26.8467, lng: 80.9310 },
  'Aliganj': { lat: 26.8850, lng: 80.9390 },
  'Gomti Nagar': { lat: 26.8560, lng: 80.9830 },
  'Indira Nagar': { lat: 26.8720, lng: 80.9860 },
  'Alambagh': { lat: 26.8180, lng: 80.9110 },
  'Chowk': { lat: 26.8580, lng: 80.9170 },
  'Rajajipuram': { lat: 26.8530, lng: 80.8920 },
};

const CATEGORY_LABELS = {
  pothole: 'Pothole & Road Crack',
  water_leak: 'Water Main Leak',
  streetlight: 'Streetlight Outage',
  waste: 'Garbage Dump Pileup',
  road_damage: 'Severe Tarmac Damage',
  drainage: 'Blocked Drainage Culvert',
};

/**
 * Fetch all active and completed community missions.
 * Automatically generates new missions if database has few active missions.
 */
export async function getMissions() {
  const snapshot = await db.collection('missions').get();
  const missions = [];
  snapshot.forEach(doc => missions.push(doc.data()));

  const activeMissions = missions.filter(m => m.status === 'active');
  
  if (activeMissions.length < 3) {
    const generated = await generateMissions();
    return [...missions, ...generated];
  }

  return missions;
}

/**
 * Dynamically generate missions from recurrence predictions or reported tickets.
 */
export async function generateMissions() {
  const generated = [];
  try {
    const stats = await getDashboardStats();
    
    // 1. Generate from recurrence forecasts with high risk (> 0.4)
    const highRisks = (stats.recurrenceForecasts || []).filter(r => r.probability > 0.4);
    for (const risk of highRisks) {
      const missionId = `mission-risk-${risk.ward}-${risk.category}`.toLowerCase().replace(/\s+/g, '-');
      const doc = await db.collection('missions').doc(missionId).get();
      if (!doc.exists) {
        const center = WARD_CENTERS[risk.ward] || { lat: 26.8467, lng: 80.9462 };
        const newMission = {
          id: missionId,
          title: `🛡️ Survey ${risk.ward} ${CATEGORY_LABELS[risk.category] || risk.category} Spawn`,
          description: `A mathematical recurrence hazard risk of ${Math.round(risk.probability * 100)}% has been forecasted. Confirm 3 anomalies in this sector to verify.`,
          target_confirmations: 3,
          current_confirmations: 0,
          lat: center.lat,
          lng: center.lng,
          ward: risk.ward,
          category: risk.category,
          status: 'active',
          gold_reward: 50,
          xp_reward: 100,
          voted_users: [],
          type: 'hotspot_prediction',
          created_at: new Date().toISOString()
        };
        await db.collection('missions').doc(missionId).set(newMission);
        generated.push(newMission);
      }
    }

    // 2. Generate from reported/unverified tickets
    const ticketsSnap = await db.collection('tickets').get();
    const openUnverified = [];
    ticketsSnap.forEach(doc => {
      const t = doc.data();
      if (t.status === 'reported' && t.lat && t.lng) openUnverified.push(t);
    });

    for (const ticket of openUnverified.slice(0, 3)) {
      const missionId = `mission-ticket-${ticket.id}`;
      const doc = await db.collection('missions').doc(missionId).get();
      if (!doc.exists) {
        const newMission = {
          id: missionId,
          title: `🔍 Verify Incident #${ticket.id.substring(0, 6)}`,
          description: `An unverified report of ${CATEGORY_LABELS[ticket.category] || ticket.category} has been logged at ${ticket.address || 'coordinates'}. Confirm 3 nearby reports to claim XP.`,
          target_confirmations: 3,
          current_confirmations: ticket.verification_up || 0,
          lat: ticket.lat,
          lng: ticket.lng,
          ward: ticket.ward || 'Unknown',
          category: ticket.category || 'other',
          status: 'active',
          gold_reward: 30,
          xp_reward: 60,
          voted_users: ticket.verified_by || [],
          ticket_id: ticket.id,
          type: 'ticket_confirmation',
          created_at: new Date().toISOString()
        };
        await db.collection('missions').doc(missionId).set(newMission);
        generated.push(newMission);
      }
    }
  } catch (err) {
    console.error('[MissionService] Failed to generate missions:', err.message);
  }
  return generated;
}

/**
 * Advance confirmation progress on any active mission covering a ticket.
 */
export async function progressMission(ticketId, voterId, voteType) {
  if (!voterId || voterId === 'anonymous') return;

  try {
    const ticketDoc = await db.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) return;
    const ticket = ticketDoc.data();

    // Find active missions associated with this ticket or ward and category
    const missionsSnap = await db.collection('missions')
      .where('status', '==', 'active')
      .get();

    for (const doc of missionsSnap.docs) {
      const mission = doc.data();
      let match = false;

      if (mission.ticket_id === ticketId) {
        match = true;
      } else if (mission.ward === ticket.ward && mission.category === ticket.category) {
        // If it's a prediction hotspot mission for the same ward and category
        match = true;
      }

      if (match && !mission.voted_users.includes(voterId)) {
        const votedUsers = [...mission.voted_users, voterId];
        const newConfirmations = mission.current_confirmations + 1;
        const updates = {
          current_confirmations: newConfirmations,
          voted_users: votedUsers
        };

        if (newConfirmations >= mission.target_confirmations) {
          updates.status = 'completed';
          updates.completed_at = new Date().toISOString();

          // Award XP and Gold to all participants of this mission
          for (const uid of votedUsers) {
            try {
              const userRef = db.collection('users').doc(uid);
              const userSnap = await userRef.get();
              if (userSnap.exists) {
                const uData = userSnap.data();
                await userRef.update({
                  xp: (uData.xp || 0) + mission.xp_reward,
                  gold: (uData.gold || 0) + mission.gold_reward,
                });
                await awardXP(uid, 'vote_accurate'); // Give additional vote accurate reward
              }
            } catch (uErr) {
              console.error(`[MissionService] Failed to reward user ${uid}:`, uErr.message);
            }
          }
        }

        await db.collection('missions').doc(mission.id).update(updates);
      }
    }
  } catch (err) {
    console.error('[MissionService] Failed to progress mission:', err.message);
  }
}
