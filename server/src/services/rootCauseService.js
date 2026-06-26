import { getLLMClient } from '../llm/index.js';
import { db } from '../config/firebase.js';

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
      explanation: 'This report does not match any surrounding hotspot swarms, representing an isolated, localized event.',
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

  // 2. Calculate Temporal Correlation (Standard Deviation in hours)
  let temporalCorrelation = 'N/A (Single Incident)';
  let stdDevHours = 0;
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

  // 4. Fetch Historical Recurrence risk for this category and ward
  let historicalRecurrenceRisk = 'Pending dynamic fitting';
  const firstReport = reports[0];
  if (firstReport && firstReport.ward) {
    try {
      const recDoc = await db.collection('recurrence_risks')
        .where('ward', '==', firstReport.ward)
        .where('category', '==', category)
        .get();
      if (!recDoc.empty) {
        const risk = recDoc.docs[0].data();
        historicalRecurrenceRisk = `${Math.round((risk.probability || 0) * 100)}% recurrence risk forecasted for this ward/category.`;
      }
    } catch (err) {
      console.warn('[RootCauseService] Failed to query historical recurrence:', err.message);
    }
  }

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
Your job is to explain the underlying root cause using the provided evidence, determining a probable cause and confidence.

Respond ONLY with a valid JSON object matching the following schema. Do NOT include markdown code fence formatting or conversational text.

Schema:
{
  "cause": "Short Title of the Probable Cause (e.g. Main Pipe Fracture, Circuit Substation Fault, Sewer Line Blockage)",
  "confidence": <integer percentage between 0 and 100 representing confidence>,
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
      confidence: Math.min(Math.max(Number(parsed.confidence) || 75, 0), 100),
      explanation: parsed.explanation || 'Analyzed underlying municipal infrastructure anomalies.',
      evidence: evidenceSummary
    };
  } catch (err) {
    console.warn('[RootCauseService] Failed to parse LLM response, using fallback:', err.message);
    const fallbacks = {
      water_leak: { cause: 'Aging Water Main Leakage', confidence: 60, explanation: `Nearby leakage reports indicate pressure stress. Asset correlation: ${evidenceSummary.asset}.` },
      streetlight: { cause: 'Circuit Substation Fault', confidence: 65, explanation: `Lighting grid failures clustered temporally. Temporal correlation: ${evidenceSummary.temporal}.` },
      waste: { cause: 'Illegal Commercial Dumping', confidence: 70, explanation: `Persistent refuse overflows in this ward. Recurrence risk: ${evidenceSummary.recurrence}.` },
      pothole: { cause: 'Sub-base Water Infiltration', confidence: 65, explanation: `Tarmac degradation accelerated by sub-base wear. Asset correlation: ${evidenceSummary.asset}.` },
      road_damage: { cause: 'Heavy Construction Transit', confidence: 60, explanation: `Tarmac deterioration indicates heavy vehicle detours. Temporal correlation: ${evidenceSummary.temporal}.` },
      drainage: { cause: 'Drainage Culvert Sewer Blockage', confidence: 70, explanation: `Flooding indicates culvert blockages. Recurrence risk: ${evidenceSummary.recurrence}.` }
    };
    const fb = fallbacks[category] || {
      cause: `${category.replace('_', ' ').toUpperCase()} Swarm`,
      confidence: 50,
      explanation: 'Clustered reports suggest localized infrastructure stress.'
    };
    return { ...fb, evidence: evidenceSummary };
  }
}
