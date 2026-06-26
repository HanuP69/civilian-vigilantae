import { getLLMClient } from '../llm/index.js';

/**
 * Analyzes a cluster of reports to diagnose the probable root cause.
 *
 * @param {string} category - Category of the cluster (e.g. 'water_leak')
 * @param {Array<{title: string, description: string, address: string, ward: string}>} reports - Reports in the cluster
 * @returns {Promise<{cause: string, confidence: number, explanation: string}>} Root cause analysis result
 */
export async function analyzeRootCause(category, reports) {
  if (!reports || reports.length === 0) {
    return {
      cause: 'Isolated Incident',
      confidence: 100,
      explanation: 'This report does not match any surrounding hotspot swarms, representing an isolated, localized event.'
    };
  }

  const reportsSummary = reports.map((r, i) => 
    `[Incident #${i+1}] Title: ${r.title || 'Untitled'}, Desc: ${r.description || 'None'}, Location: ${r.address || 'Unknown'} (Ward: ${r.ward || 'Unknown'})`
  ).join('\n');

  const systemPrompt = `You are the City Command Center Root Cause Analysis Agent.
Analyze the given cluster of municipal incidents in a city and identify the most likely underlying root cause.
Respond ONLY with a valid JSON object matching the following schema. Do NOT include markdown code fence formatting (like \`\`\`json) or any conversational text.

Schema:
{
  "cause": "Short Title of the Probable Cause (e.g. Drainage Failure, Substation Overload, Sewer Line Collapse)",
  "confidence": <integer percentage between 0 and 100 representing confidence>,
  "explanation": "A concise (2-3 sentences) explanation citing the pattern of issues, assets affected, and municipal action recommended."
}`;

  const userPrompt = `Category of Swarm: ${category}
Reports inside cluster:
${reportsSummary}`;

  try {
    const client = getLLMClient();
    const response = await client.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    let text = response.text || '';
    // Clean potential markdown blocks
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(text);
    return {
      cause: parsed.cause || `${category.replace('_', ' ').toUpperCase()} Cluster`,
      confidence: Math.min(Math.max(Number(parsed.confidence) || 75, 0), 100),
      explanation: parsed.explanation || 'An underlying municipal infrastructure anomaly is suspected.'
    };
  } catch (err) {
    console.warn('[RootCauseService] Failed to analyze root cause with LLM:', err.message);
    // Dynamic rule-based fallback based on category
    const fallbacks = {
      water_leak: { cause: 'Aging Water Main Leakage', confidence: 60, explanation: 'Coincident nearby water leaks suggest pressure anomalies in the primary municipal distribution line.' },
      streetlight: { cause: 'Circuit Substation Fault', confidence: 65, explanation: 'Clustered power and lighting outages indicate localized grid circuit breaker failures.' },
      waste: { cause: 'Illegal Commercial Dumping', confidence: 70, explanation: 'Repeated waste pileups point to commercial violations overloading sanitation transit points.' },
      pothole: { cause: 'Sub-base Water Infiltration', confidence: 65, explanation: 'Clustered road damages indicate underlying sub-base erosion caused by drainage runoffs.' },
      road_damage: { cause: 'Heavy Construction Transit', confidence: 60, explanation: 'Repetitive tarmac damage patterns suggest unauthorized heavy vehicle detours through residential lanes.' },
      drainage: { cause: 'Drainage Culvert Sewer Blockage', confidence: 70, explanation: 'Co-located flood reports point to severe silting or plastic blockage in stormwater conduits.' }
    };
    return fallbacks[category] || {
      cause: `${category.replace('_', ' ').toUpperCase()} Swarm`,
      confidence: 50,
      explanation: 'Clustered reports suggest localized infrastructure stress in this ward.'
    };
  }
}
