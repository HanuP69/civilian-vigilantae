import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../config/env.js';
import { OllamaClient } from '../OllamaClient.js';

test('OllamaClient dynamic vision model routing and base64 cleaning', async (t) => {
  const originalFetch = globalThis.fetch;
  let lastRequestBody = null;

  // Mock global fetch
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/api/chat')) {
      lastRequestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({ text: 'mock response' }),
          },
          eval_count: 10,
          prompt_eval_count: 5,
        }),
      };
    }
    return { ok: false, text: async () => 'Not found' };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new OllamaClient();

  await t.test('uses default text model when no image media is present', async () => {
    lastRequestBody = null;
    const messages = [{ role: 'user', content: 'Tell me a joke.' }];
    await client.chat(messages);

    assert.ok(lastRequestBody);
    assert.strictEqual(lastRequestBody.model, config.ollamaModel);
    assert.strictEqual(lastRequestBody.messages[0].content, 'Tell me a joke.');
    assert.strictEqual(lastRequestBody.messages[0].images, undefined);
  });

  await t.test('switches to vision model and cleans base64 image prefix when image is present', async () => {
    lastRequestBody = null;
    const messages = [
      {
        role: 'user',
        content: 'What is this?',
        media: {
          mimeType: 'image/png',
          data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        },
      },
    ];
    await client.chat(messages);

    assert.ok(lastRequestBody);
    assert.strictEqual(lastRequestBody.model, config.ollamaVisionModel || 'llava:latest');
    assert.strictEqual(lastRequestBody.messages[0].content, 'What is this?');
    assert.ok(lastRequestBody.messages[0].images);
    assert.strictEqual(lastRequestBody.messages[0].images.length, 1);
    // Verify prefix is stripped
    assert.strictEqual(lastRequestBody.messages[0].images[0], 'iVBORw0KGgoAAAANSUhEUgAA...');
  });

  await t.test('chatWithMedia correctly handles text + image', async () => {
    lastRequestBody = null;
    const media = {
      mimeType: 'image/jpeg',
      data: 'data:image/jpeg;base64,ABCDEF...',
    };

    await client.chatWithMedia('Analyze this pothole', media);

    assert.ok(lastRequestBody);
    assert.strictEqual(lastRequestBody.model, config.ollamaVisionModel || 'llava:latest');
    assert.strictEqual(lastRequestBody.messages[0].content, 'Analyze this pothole');
    assert.ok(lastRequestBody.messages[0].images);
    assert.strictEqual(lastRequestBody.messages[0].images[0], 'ABCDEF...');
  });
});
