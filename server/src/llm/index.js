/**
 * @module llm/index
 * @description LLM client factory.
 *
 * Returns the appropriate LLMClient based on the LLM_BACKEND environment
 * variable. Defaults to Gemini (primary), falls back to Ollama.
 */

import config from '../config/env.js';
import { GeminiClient } from './GeminiClient.js';
import { OllamaClient } from './OllamaClient.js';
import { MockClient } from './MockClient.js';

/** @type {import('./LLMClient.js').LLMClient|null} */
let _instance = null;

/**
 * Get the singleton LLM client instance.
 *
 * @returns {import('./LLMClient.js').LLMClient}
 */
export function getLLMClient() {
  if (_instance) return _instance;

  const backend = config.llmBackend;

  if (backend === 'ollama') {
    console.log('[LLM] Using Ollama backend:', config.ollamaModel);
    _instance = new OllamaClient();
  } else if (backend === 'mock' || !config.geminiApiKey || config.geminiApiKey === 'your_key') {
    console.log('[LLM] Using MockClient for testing.');
    _instance = new MockClient();
  } else {
    console.log('[LLM] Using Gemini backend: gemini-2.0-flash');
    _instance = new GeminiClient();
  }

  return _instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetLLMClient() {
  _instance = null;
}
