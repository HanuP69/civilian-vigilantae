import { getLLMClient } from '../llm/index.js';
import { retryWithBackoff } from '../utils/retryHelper.js';

export async function enrichReasoning(stepName, payload) {
  try {
    const llm = getLLMClient();
    const prompt = `You are a Lucknow municipal dispatch orchestrator. Enrich this agent step's reasoning with a professional, operational Lucknow municipal dispatch tone. Keep it under 20 words.\nStep: ${stepName}\nData: ${JSON.stringify(payload)}`;
    const response = await retryWithBackoff(() => llm.chat([{ role: 'user', content: prompt }], []));
    return response.text?.trim() || '';
  } catch {
    return '';
  }
}
