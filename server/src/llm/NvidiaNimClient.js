/**
 * @module llm/NvidiaNimClient
 * @description NVIDIA NIM API client implementing the LLMClient interface.
 *
 * Connects to the host's NVIDIA NIM chat completions endpoint.
 * Handles multimodal assets (images/videos) and structured JSON tool calling.
 */

import config from '../config/env.js';
import { LLMClient } from './LLMClient.js';

/**
 * Build the system prompt addendum describing available tools.
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
 * Convert our generic messages to NVIDIA NIM chat format.
 *
 * @param {import('./LLMClient.js').Message[]} messages
 * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
 * @returns {Object[]}
 */
function toNvidiaMessages(messages, tools) {
  const nvidiaMessages = [];
  let toolPromptInjected = false;

  for (const msg of messages) {
    // System message — inject tool descriptions on first occurrence
    if (msg.role === 'system') {
      const toolPrompt = (tools && tools.length > 0) ? buildToolSystemPrompt(tools) : '';
      nvidiaMessages.push({
        role: 'system',
        content: msg.content + toolPrompt,
      });
      toolPromptInjected = true;
      continue;
    }

    // Tool result — inject as user message
    if (msg.role === 'tool') {
      nvidiaMessages.push({
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

    const role = msg.role === 'assistant' ? 'assistant' : 'user';

    // Multimodal support (images or video)
    if (msg.media && (msg.media.mimeType?.startsWith('image/') || msg.media.mimeType?.startsWith('video/'))) {
      const dataUri = `data:${msg.media.mimeType};base64,${msg.media.data}`;
      const contentParts = [];
      if (content) {
        contentParts.push({ type: 'text', text: content });
      }
      if (msg.media.mimeType.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: dataUri } });
      } else if (msg.media.mimeType.startsWith('video/')) {
        contentParts.push({ type: 'video_url', video_url: { url: dataUri } });
      }
      nvidiaMessages.push({
        role,
        content: contentParts,
      });
    } else {
      nvidiaMessages.push({
        role,
        content,
      });
    }
  }

  // If no system message was present but tools exist, inject tool prompt
  if (tools?.length > 0 && !toolPromptInjected) {
    nvidiaMessages.unshift({
      role: 'system',
      content: 'You are a helpful assistant.' + buildToolSystemPrompt(tools),
    });
  }

  return nvidiaMessages;
}

/**
 * Parse NVIDIA NIM's response into our standard LLMResponse format.
 *
 * @param {string} content — raw text from the model
 * @returns {import('./LLMClient.js').LLMResponse}
 */
function parseNvidiaResponse(content) {
  if (!content) return { toolCalls: [], text: '' };

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

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

    return { toolCalls: [], text: cleaned };
  } catch (_) {
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

    return { toolCalls: [], text: cleaned };
  }
}

export class NvidiaNimClient extends LLMClient {
  constructor() {
    super();
    this.invokeUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.model = config.nvidiaModel || 'minimaxai/minimax-m3';
    this.apiKey = config.nvidiaApiKey || process.env.NIM || process.env.NVIDIA_API_KEY;
  }

  /**
   * Send conversation history to NVIDIA NIM chat endpoint.
   *
   * @param {import('./LLMClient.js').Message[]} messages
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chat(messages, tools) {
    if (!this.apiKey) {
      throw new Error('NVIDIA NIM API key is missing. Please set NIM or NVIDIA_API_KEY environment variable.');
    }

    const nvidiaMessages = toNvidiaMessages(messages, tools);

    const payload = {
      model: this.model,
      messages: nvidiaMessages,
      max_tokens: 8192,
      temperature: 0.1,
      top_p: 0.95,
      stream: false,
    };

    try {
      console.log(`[NVIDIA NIM] Sending request to ${this.model}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout

      const res = await fetch(this.invokeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`NVIDIA NIM API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const responseText = data.choices?.[0]?.message?.content || '';

      // Log usage if returned
      if (data.usage) {
        console.log(`[NVIDIA NIM] tokens — prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens}`);
      }

      return parseNvidiaResponse(responseText);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('[NVIDIA NIM] Request timed out.');
        throw new Error('NVIDIA NIM API request timed out.');
      }
      console.error('[NVIDIA NIM] Error:', err.message || err);
      throw err;
    }
  }

  /**
   * Send multimodal classification requests.
   *
   * @param {string} text
   * @param {Object} media — { mimeType: string, data: string (base64) }
   * @param {import('./LLMClient.js').ToolDefinition[]} [tools]
   * @returns {Promise<import('./LLMClient.js').LLMResponse>}
   */
  async chatWithMedia(text, media, tools) {
    const messages = [
      { role: 'user', content: text, media },
    ];
    return this.chat(messages, tools);
  }
}
