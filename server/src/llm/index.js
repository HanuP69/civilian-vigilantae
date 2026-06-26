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

/** @type {import('./LLMClient.js').LLMClient|null} */
let _instance = null;

function getTestOverride() {
  return globalThis.__SENTINEL_LLM_CLIENT__ || null;
}

/**
 * Get the singleton LLM client instance.
 *
 * @returns {import('./LLMClient.js').LLMClient}
 */
export function getLLMClient() {
  if (_instance) return _instance;

  const override = getTestOverride();
  if (override) return override;

  const backend = config.llmBackend;

  if (backend === 'gemini') {
    console.log('[LLM] Using Gemini backend: gemini-2.0-flash');
    _instance = new GeminiClient();
  } else {
    console.log('[LLM] Using Ollama backend:', config.ollamaModel);
    _instance = new OllamaClient();
  }

  return _instance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetLLMClient() {
  _instance = null;
  globalThis.__SENTINEL_LLM_CLIENT__ = null;
}

export function setTestLLMClient(client) {
  _instance = client;
  globalThis.__SENTINEL_LLM_CLIENT__ = client;
}
