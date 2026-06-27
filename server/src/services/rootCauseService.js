import { getLLMClient } from '../llm/index.js';
import { db } from '../config/firebase.js';
import { computeRecurrenceRisk } from '../math/recurrence.js';

/**
 * Gathers structured mathematical and spatial evidence for a cluster of reports,
 * then passes it to the LLM to generate an explanation.
 *
 * @param {string} category - Category of the cluster (e.g. 'water_leak')
 * @param {Array<{title: string, description: string, address: string, ward: string, created_at: string, asset_id: string, asset_name: string}>} reports - Reports in the cluster
 * @returns {Promise<{cause: string, confidence: number, explanation: string, evidence: object}>} Root cause analysis result
 */
export async function analyzeRootCause(category, reports) {
  if (!reports || reports.length === 0) {
    return {
      cause: 'Isolated Incident',
      confidence: 100,
      explanation: 'This report does not match any surrounding hotspot clusters, representing an isolated, localized event.',
      evidence: { composition: 'Single report', temporal: 'N/A' }
    };
  }

  // 1. Calculate Cluster Composition
  const totalReportsCount = reports.length;
  const categoriesCount = {};
  reports.forEach(r => {
    const cat = r.category || category;
    categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
  });

  // 2. Calculate Temporal Correlation (Standard Deviation in hours + Burstiness Index)
  let temporalCorrelation = 'N/A (Single Incident)';
  let stdDevHours = 0;
  let burstinessIndex = 0;
  let burstinessText = 'N/A';

  if (totalReportsCount >= 2) {
    const timestamps = reports.map(r => new Date(r.created_at || Date.now()).getTime());
    const mean = timestamps.reduce((sum, t) => sum + t, 0) / totalReportsCount;
    const variance = timestamps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / totalReportsCount;
    const stdDevMs = Math.sqrt(variance);
    stdDevHours = stdDevMs / 3600000;

    if (stdDevHours <= 6) {
      temporalCorrelation = `High Temporal Correlation (σ = ${stdDevHours.toFixed(1)}h - Sudden Burst Anomaly)`;
    } else if (stdDevHours <= 24) {
      temporalCorrelation = `Moderate Temporal Correlation (σ = ${stdDevHours.toFixed(1)}h - Continuous Degradation)`;
    } else {
      temporalCorrelation = `Low Temporal Correlation (σ = ${stdDevHours.toFixed(1)}h - Intermittent Accumulation)`;
    }

    // Compute Interval Burstiness if we have at least 3 incidents (which gives 2 intervals)
    if (totalReportsCount >= 3) {
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      const intervals = [];
      for (let i = 0; i < sortedTimestamps.length - 1; i++) {
        intervals.push(sortedTimestamps[i + 1] - sortedTimestamps[i]);
      }
      const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const varInterval = intervals.reduce((sum, val) => sum + Math.pow(val - meanInterval, 2), 0) / intervals.length;
      const stdDevInterval = Math.sqrt(varInterval);

      if (meanInterval + stdDevInterval > 0) {
        burstinessIndex = (stdDevInterval - meanInterval) / (stdDevInterval + meanInterval);
      }

      if (burstinessIndex > 0.3) {
        burstinessText = `High Burstiness (B = ${burstinessIndex.toFixed(2)} - Clustered Anomaly)`;
      } else if (burstinessIndex < -0.3) {
        burstinessText = `Low Burstiness (B = ${burstinessIndex.toFixed(2)} - Regularly Spaced)`;
      } else {
        burstinessText = `Poisson Burstiness (B = ${burstinessIndex.toFixed(2)})`;
      }
      temporalCorrelation = `${temporalCorrelation} | ${burstinessText}`;
    }
  }

  // 3. Calculate Asset Correlation
  const assetsCount = {};
  reports.forEach(r => {
    if (r.asset_name) {
      assetsCount[r.asset_name] = (assetsCount[r.asset_name] || 0) + 1;
    }
  });
  const uniqueAssets = Object.keys(assetsCount);
  let assetCorrelation = 'No linked assets';
  if (uniqueAssets.length === 1) {
    assetCorrelation = `Identical Asset Affected: ${uniqueAssets[0]} (${assetsCount[uniqueAssets[0]]}/${totalReportsCount} reports)`;
  } else if (uniqueAssets.length > 1) {
    assetCorrelation = `Distributed Infrastructure Stress across ${uniqueAssets.length} assets`;
  }

  // 4. Compute recurrence risk inline from resolved tickets
  let historicalRecurrenceRisk = 'Insufficient resolved ticket data for recurrence estimation.';
  const firstReport = reports[0];
  if (firstReport && firstReport.ward) {
    try {
      const resolvedSnap = await db.collection('tickets')
        .where('status', '==', 'resolved')
        .where('ward', '==', firstReport.ward)
        .where('category', '==', category)
        .get();
      const resolvedTickets = [];
      resolvedSnap.forEach(doc => {
        const t = doc.data();
        if (t.resolved_at) resolvedTickets.push({ resolved_at: t.resolved_at, category: t.category, ward: t.ward, verification_score: t.verification_score });
      });
      if (resolvedTickets.length >= 2) {
        const risks = computeRecurrenceRisk(resolvedTickets, 14);
        const match = risks.find(r => r.ward === firstReport.ward && r.category === category);
        if (match) {
          historicalRecurrenceRisk = `${Math.round(match.probability * 100)}% recurrence risk in next 14 days. ${match.recommendedAction}.`;
        }
      }
    } catch (err) {
      console.warn('[RootCauseService] Failed to compute recurrence risk:', err.message);
    }
  }

  // Calculate evidence-grounded confidence score
  // Size (40% max), Temporal (20% max), Asset (20% max), Recurrence (20% max)
  const sizeScore = Math.min(totalReportsCount * 4, 40);
  let temporalScore = 5;
  if (totalReportsCount >= 2) {
    if (stdDevHours <= 6) temporalScore = 20;
    else if (stdDevHours <= 24) temporalScore = 15;
    else temporalScore = 10;
  }
  let assetScore = 5;
  if (uniqueAssets.length === 1) assetScore = 20;
  else if (uniqueAssets.length > 1) assetScore = 10;

  let recurrenceScore = 5;
  if (historicalRecurrenceRisk.includes('%')) {
    const pctMatch = historicalRecurrenceRisk.match(/(\d+)%/);
    if (pctMatch) {
      const riskPct = parseInt(pctMatch[1], 10);
      recurrenceScore = Math.min(Math.max(Math.round(riskPct * 0.2), 5), 20);
    }
  }

  const computedConfidence = Math.min(Math.max(sizeScore + temporalScore + assetScore + recurrenceScore, 50), 95);

  // 5. Package Evidence for LLM explanation
  const evidenceSummary = {
    composition: `${totalReportsCount} active complaints under [${category.toUpperCase()}] category`,
    temporal: temporalCorrelation,
    asset: assetCorrelation,
    recurrence: historicalRecurrenceRisk
  };

  const reportsSummary = reports.map((r, i) => 
    `[Complaint #${i+1}] Title: "${r.title || 'Untitled'}", Desc: "${r.description || 'None'}", Asset: "${r.asset_name || 'N/A'}"`
  ).join('\n');

  const systemPrompt = `You are the City Command Center Root Cause Analysis Agent.
You are given a list of citizen complaints and a set of mathematical/spatial EVIDENCE summaries.
Your job is to explain the underlying root cause using the provided evidence.

Respond ONLY with a valid JSON object matching the following schema. Do NOT include markdown code fence formatting or conversational text.

Schema:
{
  "cause": "Short Title of the Probable Cause (e.g. Main Pipe Fracture, Circuit Substation Fault, Sewer Line Blockage)",
  "explanation": "A concise explanation (2-3 sentences) explaining how the evidence (temporal correlation, asset correlation, and recurrence risk) leads to this diagnosis."
}`;

  const userPrompt = `
[EVIDENCE SUMMARY]
- Cluster Composition: ${evidenceSummary.composition}
- Temporal Correlation: ${evidenceSummary.temporal}
- Asset Correlation: ${evidenceSummary.asset}
- Historical Recurrence: ${evidenceSummary.recurrence}

[CITIZEN REPORTS]
${reportsSummary}
`;

  try {
    const client = getLLMClient();
    const response = await client.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    let text = response.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(text);
    return {
      cause: parsed.cause || `${category.replace('_', ' ').toUpperCase()} Cluster`,
      confidence: computedConfidence,
      explanation: parsed.explanation || 'Analyzed underlying municipal infrastructure anomalies.',
      evidence: evidenceSummary
    };
  } catch (err) {
    console.warn('[RootCauseService] Failed to parse LLM response, using fallback:', err.message);
    const fallbacks = {
      water_leak: { cause: 'Aging Water Main Leakage', explanation: `Nearby leakage reports indicate pressure stress. Asset correlation: ${evidenceSummary.asset}.` },
      streetlight: { cause: 'Circuit Substation Fault', explanation: `Lighting grid failures clustered temporally. Temporal correlation: ${evidenceSummary.temporal}.` },
      waste: { cause: 'Illegal Commercial Dumping', explanation: `Persistent refuse overflows in this ward. Recurrence risk: ${evidenceSummary.recurrence}.` },
      pothole: { cause: 'Sub-base Water Infiltration', explanation: `Tarmac degradation accelerated by sub-base wear. Asset correlation: ${evidenceSummary.asset}.` },
      road_damage: { cause: 'Heavy Construction Transit', explanation: `Tarmac deterioration indicates heavy vehicle detours. Temporal correlation: ${evidenceSummary.temporal}.` },
      drainage: { cause: 'Drainage Culvert Sewer Blockage', explanation: `Flooding indicates culvert blockages. Recurrence risk: ${evidenceSummary.recurrence}.` }
    };
    const fb = fallbacks[category] || {
      cause: `${category.replace('_', ' ').toUpperCase()} Cluster`,
      explanation: 'Clustered reports suggest localized infrastructure stress.'
    };
    return { ...fb, confidence: computedConfidence, evidence: evidenceSummary };
  }
}
