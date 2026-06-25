/**
 * @module llm/LLMClient
 * @description Abstract interface for LLM backends.
 *
 * Both GeminiClient and OllamaClient implement this contract so the
 * agent orchestrator is backend-agnostic.
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} name — tool / function name
 * @property {Object} args — parsed arguments object
 */

/**
 * @typedef {Object} LLMResponse
 * @property {ToolCall[]} toolCalls — tool calls requested by the model (may be empty)
 * @property {string}     text      — textual response (may be empty when tool calls present)
 */

/**
 * @typedef {Object} Message
 * @property {'system'|'user'|'assistant'|'tool'} role
 * @property {string}  content    — text content
 * @property {string}  [name]     — tool name (for role=tool)
 * @property {Object}  [media]    — { mimeType: string, data: string (base64) }
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {Object} parameters — JSON Schema for the function parameters
 */

/**
 * Abstract LLM client.
 * Subclasses must implement the `chat` method.
 */
export class LLMClient {
  /**
   * Send a conversation to the LLM, optionally with tool definitions.
   *
   * @param {Message[]}        messages — conversation history
   * @param {ToolDefinition[]} [tools]  — available tools the model may call
   * @returns {Promise<LLMResponse>}
   */
  async chat(messages, tools) {
    throw new Error('LLMClient.chat() must be implemented by subclass');
  }

  /**
   * Send a multimodal message (text + image/video) for classification.
   *
   * @param {string} text      — text prompt
   * @param {Object} media     — { mimeType: string, data: string (base64) }
   * @param {ToolDefinition[]} [tools] — available tools
   * @returns {Promise<LLMResponse>}
   */
  async chatWithMedia(text, media, tools) {
    throw new Error('LLMClient.chatWithMedia() must be implemented by subclass');
  }
}
