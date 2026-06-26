import { db } from './src/config/firebase.js';
import { computeBrierScore } from './src/math/accuracy.js';

async function run() {
  console.log("Fetching tickets from Firestore...");
  const snap = await db.collection('tickets').get();
  console.log(`Retrieved ${snap.size} tickets.`);

  const tickets = [];
  snap.forEach(doc => tickets.push(doc.data()));

  // 1. Classification Metrics
  let totalWithAI = 0;
  let totalWithVision = 0;
  let agreedCount = 0;
  let totalEntropy = 0;
  let entropyCount = 0;

  tickets.forEach(t => {
    if (t.ai_classification) {
      totalWithAI++;
      if (t.classification_agreement === true) {
        agreedCount++;
      }
      const entropy = t.ai_classification.entropy ?? (t.priority_score_details && t.priority_score_details.entropy);
      if (entropy !== undefined && entropy !== null) {
        totalEntropy += entropy;
        entropyCount++;
      }
    }
    if (t.cloud_vision_result) {
      totalWithVision++;
    }
  });

  console.log("\n--- CLASSIFICATION METRICS ---");
  console.log(`Tickets with AI Classification: ${totalWithAI}`);
  console.log(`Tickets with Cloud Vision Labeling: ${totalWithVision}`);
  console.log(`Multi-Model Agreement Rate: ${totalWithAI > 0 ? ((agreedCount / totalWithAI) * 100).toFixed(2) : 0}%`);
  console.log(`Average posterior distribution entropy: ${entropyCount > 0 ? (totalEntropy / entropyCount).toFixed(4) : "N/A"}`);

  // 2. SLA & Weibull Forecasting Accuracy
  const predictions = [];
  const outcomes = [];
  let totalPriority = 0;
  let priorityCount = 0;
  const priorities = [];
  let totalResHours = 0;
  let resolvedCountForDuration = 0;

  tickets.forEach(t => {
    if (t.priority_score !== undefined) {
      totalPriority += t.priority_score;
      priorities.push(t.priority_score);
      priorityCount++;
    }
    if (t.status === 'resolved' && t.resolved_at && t.created_at) {
      const durationH = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000;
      if (durationH > 0) {
        totalResHours += durationH;
        resolvedCountForDuration++;
      }
    }

    if (t.sla_probability !== undefined && t.sla_deadline && t.created_at) {
      const deadlineTime = new Date(t.sla_deadline).getTime();
      
      let resolvedOnTime = null;
      if (t.status === 'resolved' && t.resolved_at) {
        const resolvedTime = new Date(t.resolved_at).getTime();
        resolvedOnTime = resolvedTime <= deadlineTime ? 1 : 0;
      } else if (Date.now() > deadlineTime) {
        resolvedOnTime = 0;
      }

      if (resolvedOnTime !== null) {
        predictions.push(t.sla_probability);
        outcomes.push(resolvedOnTime);
      }
    }
  });

  const meanPriority = priorityCount > 0 ? totalPriority / priorityCount : 0;
  const variancePriority = priorityCount > 0 ? priorities.reduce((s, v) => s + Math.pow(v - meanPriority, 2), 0) / priorityCount : 0;
  const stdevPriority = Math.sqrt(variancePriority);

  console.log("\n--- SLA FORECASTING METRICS ---");
  console.log(`Tickets evaluated for SLA: ${predictions.length}`);
  if (predictions.length > 0) {
    try {
      const brier = computeBrierScore(predictions, outcomes);
      console.log(`Brier Score (Calibration error): ${brier.toFixed(4)}`);
      console.log(`(A score closer to 0 indicates better prediction accuracy. A random guess is 0.25)`);
    } catch (err) {
      console.error("Error computing Brier Score:", err.message);
    }
  } else {
    console.log("No completed or breached tickets with SLA predictions found.");
  }

  console.log("\n--- TICKET TELEMETRY & EFFICIENCY ---");
  console.log(`Average Priority Score: ${meanPriority.toFixed(2)}%`);
  console.log(`Priority Score StDev: ${stdevPriority.toFixed(2)}%`);
  console.log(`Average Resolution Time: ${resolvedCountForDuration > 0 ? (totalResHours / resolvedCountForDuration).toFixed(2) : 0} hours`);

  // 3. Status Breakdown
  const counts = {};
  tickets.forEach(t => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });
  console.log("\n--- TICKET STATUS BREAKDOWN ---");
  Object.entries(counts).forEach(([status, c]) => {
    console.log(`- ${status}: ${c}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
