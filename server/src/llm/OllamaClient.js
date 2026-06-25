/**
 * @module llm/OllamaClient
 * @description Ollama API client implementing the LLMClient interface.
 *
 * Used as an offline fallback when Gemini is unavailable.
 * Uses qwen3:8b with JSON schema constrained decoding.
 */

import config from '../config/env.js';
import { LLMClient } from './LLMClient.js';

/**
 * Convert our generic tool definitions into a JSON schema that Ollama
 * can use for constrained decoding (format parameter).
 *
 * Since Ollama doesn't support native function calling in the same way
 * as Gemini, we instruct the model to output a structured JSON response
 * with a "tool_calls" array.
 *
 * @param {import('./LLMClient.js').ToolDefinition[]} tools
 * @returns {string} system prompt addendum describing available tools
 */
function buildToolSystemPrompt(tools) {
  if (!tools || tools.length === 0) return '';

  const toolDescriptions = tools.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  return `\n\nYou have access to the following tools. To use a tool, respond with a JSON object containing a "tool_calls" array. Each element should have "name" (tool name) and "args" (object with parameters). If you don't need a tool, respond with a "text" field instead.\n\nAvailable tools:\n${toolDescriptions}\n\nResponse format (when using tools):\n{"tool_calls": [{"name": "tool_name", "args": {...}}]}\n\nResponse format (when not using tools):\n{"text": "your response"}`;
}

/**
 * Convert our generic messages to Ollama's chat format.
 *
 * @param {import('./LLMClient.js').Message[]} messages
 * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
 * @returns {Object[]}
 */
function toOllamaMessages(messages, tools) {
  const ollamaMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      ollamaMessages.push({
        role: 'system',
        content: msg.content + buildToolSystemPrompt(tools),
      });
      continue;
    }

    if (msg.role === 'tool') {
      ollamaMessages.push({
        role: 'user',
        content: `Tool "${msg.name}" returned: ${msg.content}`,
      });
      continue;
    }

    const ollamaMsg = {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content || '',
    };

    // Ollama supports images via base64
    if (msg.media && msg.media.mimeType?.startsWith('image/')) {
      ollamaMsg.images = [msg.media.data];
    }

    ollamaMessages.push(ollamaMsg);
  }

  // If no system message was present, inject tool descriptions as system message
  if (tools?.length > 0 && !messages.some(m => m.role === 'system')) {
    ollamaMessages.unshift({
      role: 'system',
      content: 'You are a helpful assistant.' + buildToolSystemPrompt(tools),
    });
  }

  return ollamaMessages;
}

/**
 * Parse Ollama's response into our standard LLMResponse format.
 *
 * @param {Object} data — Ollama API response
 * @returns {import('./LLMClient.js').LLMResponse}
 */
function parseOllamaResponse(data) {
  const content = data.message?.content || '';

  // Try to parse as JSON (tool calls)
  try {
    const parsed = JSON.parse(content);

    if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
      return {
        toolCalls: parsed.tool_calls.map(tc => ({
          name: tc.name,
          args: tc.args || {},
        })),
        text: '',
      };
    }

    if (parsed.text) {
      return { toolCalls: [], text: parsed.text };
    }
  } catch (_) {
    // Not JSON — treat as plain text response
  }

  return { toolCalls: [], text: content };
}

export class OllamaClient extends LLMClient {
  constructor() {
    super();
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.ollamaModel;
  }

  /**
   * Send a conversation to Ollama with optional tool definitions.
   *
   * @param {import('./LLMClient.js').Message[]}        messages
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chat(messages, tools) {
    const ollamaMessages = toOllamaMessages(messages, tools);

    const body = {
      model: this.model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: 0.2,
      },
    };

    // If tools are present, use JSON format for constrained decoding
    if (tools && tools.length > 0) {
      body.format = 'json';
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API error (${res.status}): ${errText}`);
      }

      const data = await res.json();

      // Log token usage
      if (data.eval_count) {
        console.log(`[Ollama] tokens — eval: ${data.eval_count}, prompt: ${data.prompt_eval_count || '?'}`);
      }

      return parseOllamaResponse(data);
    } catch (err) {
      console.error(`[Ollama] Error:`, err.message || err);
      throw err;
    }
  }

  /**
   * Send a multimodal message (text + image) for classification.
   * Note: Ollama has limited video support — image only.
   *
   * @param {string} text
   * @param {Object} media — { mimeType: string, data: string (base64) }
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chatWithMedia(text, media, tools) {
    const messages = [
      {
        role: 'user',
        content: text,
        media,
      },
    ];
    return this.chat(messages, tools);
  }
}
