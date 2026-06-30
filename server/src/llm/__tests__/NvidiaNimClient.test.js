process.env.NIM = 'test-nim-token';

import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../config/env.js';
import { NvidiaNimClient } from '../NvidiaNimClient.js';

test('NvidiaNimClient API payload formatting and tool parsing', async (t) => {
  const originalFetch = globalThis.fetch;
  let lastRequestBody = null;
  let lastHeaders = null;

  // Mock global fetch
  globalThis.fetch = async (url, options) => {
    if (url === 'https://integrate.api.nvidia.com/v1/chat/completions') {
      lastRequestBody = JSON.parse(options.body);
      lastHeaders = options.headers;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ text: 'mock response' }),
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
          },
        }),
      };
    }
    return { ok: false, text: async () => 'Not found' };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new NvidiaNimClient();

  await t.test('sends correct headers and basic payload', async () => {
    lastRequestBody = null;
    lastHeaders = null;
    const messages = [{ role: 'user', content: 'Hello' }];
    await client.chat(messages);

    assert.ok(lastRequestBody);
    assert.ok(lastHeaders);
    assert.strictEqual(lastHeaders['Authorization'], 'Bearer test-nim-token');
    assert.strictEqual(lastRequestBody.model, 'minimaxai/minimax-m3');
    assert.strictEqual(lastRequestBody.messages[0].role, 'user');
    assert.strictEqual(lastRequestBody.messages[0].content, 'Hello');
  });

  await t.test('formats multimodal content into parts array', async () => {
    lastRequestBody = null;
    const messages = [
      {
        role: 'user',
        content: 'Identify this hazard',
        media: {
          mimeType: 'image/jpeg',
          data: 'iVBORw0KGgoAAAANSUhEUgAA...',
        },
      },
    ];
    await client.chat(messages);

    assert.ok(lastRequestBody);
    const content = lastRequestBody.messages[0].content;
    assert.ok(Array.isArray(content));
    assert.strictEqual(content[0].type, 'text');
    assert.strictEqual(content[0].text, 'Identify this hazard');
    assert.strictEqual(content[1].type, 'image_url');
    assert.strictEqual(content[1].image_url.url, 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA...');
  });

  await t.test('supports video assets via video_url part type', async () => {
    lastRequestBody = null;
    const media = {
      mimeType: 'video/mp4',
      data: 'AAAAIGZ0eXBtcDQyAAAAAG1wNDJ...',
    };
    await client.chatWithMedia('Analyze this recording', media);

    assert.ok(lastRequestBody);
    const content = lastRequestBody.messages[0].content;
    assert.ok(Array.isArray(content));
    assert.strictEqual(content[0].text, 'Analyze this recording');
    assert.strictEqual(content[1].type, 'video_url');
    assert.strictEqual(content[1].video_url.url, 'data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJ...');
  });
});
