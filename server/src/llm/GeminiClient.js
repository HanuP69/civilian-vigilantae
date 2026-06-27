/**
 * @module llm/GeminiClient
 * @description Gemini API client implementing the LLMClient interface.
 *
 * Uses the @google/generative-ai SDK with native function calling
 * and multimodal (image + video) input support.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/env.js';
import { LLMClient } from './LLMClient.js';
import { OllamaClient } from './OllamaClient.js';

/** Max retries on transient failures */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BASE_DELAY_MS = 1000;

/**
 * Convert our generic tool definitions to Gemini's function declaration format.
 *
 * @param {import('./LLMClient.js').ToolDefinition[]} tools
 * @returns {Object[]} Gemini-formatted function declarations
 */
function toGeminiFunctionDeclarations(tools) {
  if (!tools || tools.length === 0) return undefined;

  return [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  }];
}

/**
 * Convert our generic messages to Gemini's content format.
 *
 * @param {import('./LLMClient.js').Message[]} messages
 * @returns {{ systemInstruction: Object|undefined, contents: Object[] }}
 */
function toGeminiContents(messages) {
  let systemInstruction;
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
      continue;
    }

    if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.name,
            response: { result: msg.content },
          },
        }],
      });
      continue;
    }

    const parts = [];

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    if (msg.media) {
      parts.push({
        inlineData: {
          mimeType: msg.media.mimeType,
          data: msg.media.data,
        },
      });
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        parts.push({
          functionCall: {
            name: tc.name,
            args: tc.args || {},
          },
        });
      }
    }

    if (parts.length === 0) {
      parts.push({ text: '' });
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  return { systemInstruction, contents };
}

/**
 * Parse Gemini response into our standard LLMResponse format.
 *
 * @param {Object} result — Gemini generateContent result
 * @returns {import('./LLMClient.js').LLMResponse}
 */
function parseGeminiResponse(result) {
  const response = result.response;
  const candidate = response.candidates?.[0];

  if (!candidate) {
    return { toolCalls: [], text: '' };
  }

  const toolCalls = [];
  let text = '';

  for (const part of candidate.content?.parts || []) {
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
    if (part.text) {
      text += part.text;
    }
  }

  return { toolCalls, text };
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class GeminiClient extends LLMClient {
  constructor() {
    super();
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });
  }

  /**
   * Send a conversation to Gemini with optional tool definitions.
   *
   * @param {import('./LLMClient.js').Message[]}        messages
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chat(messages, tools) {
    const geminiTools = toGeminiFunctionDeclarations(tools);
    const { systemInstruction, contents } = toGeminiContents(messages);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents,
          tools: geminiTools,
          systemInstruction,
        });

        const parsed = parseGeminiResponse(result);

        // Log token usage (non-blocking)
        try {
          const usage = result.response?.usageMetadata;
          if (usage) {
            console.log(`[Gemini] tokens — prompt: ${usage.promptTokenCount}, response: ${usage.candidatesTokenCount}`);
          }
        } catch (_) { /* ignore logging errors */ }

        return parsed;
      } catch (err) {
        const isRetryable = err.status >= 500;

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[Gemini] Retryable error (${err.status}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        if (err.status === 429 || err.message?.includes('Quota') || err.message?.includes('403')) {
          console.warn(`[Gemini] Quota/Auth error (${err.status}), falling back to Ollama...`);
          if (!this.fallbackClient) this.fallbackClient = new OllamaClient();
          return this.fallbackClient.chat(messages, tools);
        }

        console.error(`[Gemini] Error:`, err.message || err);
        throw err;
      }
    }
  }

  /**
   * Send a multimodal message (text + image/video) for classification.
   *
   * @param {string} text
   * @param {Object} media — { mimeType: string, data: string (base64) }
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chatWithMedia(text, media, tools) {
    try {
      const messages = [{ role: 'user', content: text, media }];
      return await this.chat(messages, tools);
    } catch (err) {
      if (media?.mimeType?.startsWith('video/')) {
        console.error('[Gemini] Video classification failed and Ollama cannot handle video:', err.message);
        throw err;
      }
      if (!this.fallbackClient) this.fallbackClient = new OllamaClient();
      return this.fallbackClient.chatWithMedia(text, media, tools);
    }
  }
}
