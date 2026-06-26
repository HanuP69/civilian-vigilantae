/**
 * @module llm/OllamaClient
 * @description Ollama API client implementing the LLMClient interface.
 *
 * Uses local Ollama with structured JSON output for tool calling.
 * Handles multi-turn tool-calling loops by injecting tool instructions
 * only once and appending tool results as user messages.
 */

import config from '../config/env.js';
import { LLMClient } from './LLMClient.js';

/**
 * Build the system prompt addendum describing available tools.
 * Only injected once into the system message, not repeated per turn.
 *
 * @param {import('./LLMClient.js').ToolDefinition[]} tools
 * @returns {string}
 */
function buildToolSystemPrompt(tools) {
  if (!tools || tools.length === 0) return '';

  const toolDescriptions = tools.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  return `\n\nYou have access to the following tools. To use a tool, respond ONLY with a JSON object: {"tool_calls": [{"name": "tool_name", "args": {...}}]}. You MUST respond with valid JSON — no markdown, no extra text.\n\nAvailable tools:\n${toolDescriptions}\n\nIMPORTANT: Respond with ONLY the JSON object. No explanation, no markdown code fences.`;
}

/**
 * Convert our generic messages to Ollama's chat format.
 *
 * - System message: inject tool descriptions once
 * - Assistant with toolCalls: convert to JSON string so Ollama sees the tool call
 * - Tool results: inject as user messages "Tool X returned: ..."
 * - Regular user/assistant: pass through
 *
 * @param {import('./LLMClient.js').Message[]} messages
 * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
 * @returns {Object[]}
 */
function toOllamaMessages(messages, tools) {
  const ollamaMessages = [];
  let toolPromptInjected = false;

  for (const msg of messages) {
    // System message — inject tool descriptions on first occurrence
    if (msg.role === 'system') {
      const toolPrompt = (tools && tools.length > 0) ? buildToolSystemPrompt(tools) : '';
      ollamaMessages.push({
        role: 'system',
        content: msg.content + toolPrompt,
      });
      toolPromptInjected = true;
      continue;
    }

    // Tool result — inject as user message
    if (msg.role === 'tool') {
      ollamaMessages.push({
        role: 'user',
        content: `Tool "${msg.name}" returned: ${msg.content}\n\nNow proceed to the next step based on the result. If you need to call another tool, respond with ONLY a JSON object like {"tool_calls": [{"name": "...", "args": {...}}]}. If all processing is complete, respond with {"text": "your summary"}.`,
      });
      continue;
    }

    // Assistant message with tool calls — convert to JSON string
    let content = msg.content || '';
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      content = JSON.stringify({
        tool_calls: msg.toolCalls.map(tc => ({
          name: tc.name,
          args: tc.args || {},
        })),
      });
    }

    const ollamaMsg = {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content,
    };

    // Multimodal support (images)
    if (msg.media && msg.media.mimeType?.startsWith('image/')) {
      ollamaMsg.images = [msg.media.data];
    }

    ollamaMessages.push(ollamaMsg);
  }

  // If no system message was present but tools exist, inject tool prompt
  if (tools?.length > 0 && !toolPromptInjected) {
    ollamaMessages.unshift({
      role: 'system',
      content: 'You are a helpful assistant.' + buildToolSystemPrompt(tools),
    });
  }

  return ollamaMessages;
}

/**
 * Parse Ollama's response into our standard LLMResponse format.
 * Handles cases where the model wraps JSON in markdown fences.
 *
 * @param {string} content — raw text from Ollama
 * @returns {import('./LLMClient.js').LLMResponse}
 */
function parseOllamaResponse(content) {
  if (!content) return { toolCalls: [], text: '' };

  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try to parse as JSON (tool calls)
  try {
    const parsed = JSON.parse(cleaned);

    if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
      return {
        toolCalls: parsed.tool_calls.map(tc => ({
          name: tc.name,
          args: tc.args || {},
        })),
        text: '',
      };
    }

    if (typeof parsed.text === 'string') {
      return { toolCalls: [], text: parsed.text };
    }

    // Model returned JSON but not in expected shape — treat as text
    return { toolCalls: [], text: cleaned };
  } catch (_) {
    // Not valid JSON — check if it contains a JSON block
    const jsonBlock = cleaned.match(/\{[\s\S]*\}/);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[0]);
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          return {
            toolCalls: parsed.tool_calls.map(tc => ({
              name: tc.name,
              args: tc.args || {},
            })),
            text: '',
          };
        }
      } catch (_) {}
    }

    // Plain text response — treat as final text
    return { toolCalls: [], text: cleaned };
  }
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
        num_predict: 1024,
      },
    };

    // Use JSON format only for the first call (no tool results yet).
    // After tool results exist in history, drop format:json to let the model
    // respond more naturally and avoid JSON parsing failures mid-conversation.
    const hasToolResults = messages.some(m => m.role === 'tool');
    if (tools && tools.length > 0 && !hasToolResults) {
      body.format = 'json';
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API error (${res.status}): ${errText}`);
      }

      const data = await res.json();

      // Log token usage
      if (data.eval_count) {
        console.log(`[Ollama] tokens — eval: ${data.eval_count}, prompt: ${data.prompt_eval_count || '?'}`);
      }

      return parseOllamaResponse(data.message?.content || '');
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`[Ollama] Request timed out or server unreachable at ${this.baseUrl}`);
        throw new Error(`Ollama unreachable at ${this.baseUrl} (timeout). Is 'ollama serve' running and is the model '${this.model}' pulled?`);
      }
      console.error(`[Ollama] Error:`, err.message || err);
      throw err;
    }
  }

  /**
   * Send a multimodal message (text + image/audio/video) for classification.
   * - Images: passed inline as base64 to vision-capable models (llava, gemma3, etc.)
   * - Audio: transcribed first via Ollama's Whisper speech endpoint, then classified as text
   * - Video: falls back to text-only (no inline video support in Ollama)
   *
   * @param {string} text
   * @param {Object} media — { mimeType: string, data: string (base64) }
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chatWithMedia(text, media, tools) {
    if (media && media.mimeType?.startsWith('audio/')) {
      // Transcribe audio via Ollama's Whisper endpoint, then classify
      let transcriptContext = '';
      try {
        const audioBytes = Buffer.from(media.data, 'base64');
        const { Blob: NodeBlob } = await import('node:buffer');
        const audioBlob = new NodeBlob([audioBytes], { type: media.mimeType });

        // Ollama exposes OpenAI-compatible speech endpoint: POST /api/audio/transcriptions
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const resp = await fetch(`${this.baseUrl}/api/audio/transcriptions`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (resp.ok) {
          const result = await resp.json();
          if (result.text) {
            transcriptContext = `\n\nAudio transcript from the voice note: "${result.text}"`;
            console.log('[Ollama] Audio transcribed:', result.text.slice(0, 80));
          }
        } else {
          console.warn(`[Ollama] Whisper endpoint unavailable (${resp.status}) — classifying from text only`);
        }
      } catch (err) {
        console.warn('[Ollama] Audio transcription failed, falling back to text-only classification:', err.message);
      }

      const messages = [{ role: 'user', content: text + transcriptContext }];
      return this.chat(messages, tools);
    }

    // Images: pass base64 inline (supported by llava, gemma3, llama3.2-vision etc.)
    // Video: Ollama has no inline video support — pass text prompt only
    const messages = [{ role: 'user', content: text, media }];
    return this.chat(messages, tools);
  }
}
