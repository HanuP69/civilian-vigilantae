import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAgentTrace } from './agentStreamUtils.js';

test('mergeAgentTrace keeps live steps and appends fallback trace', () => {
  const live = [{ step: 'classify_issue', status: 'pending', index: 0 }];
  const merged = mergeAgentTrace(live, [
    { step: 'classify_issue', status: 'success' },
    { step: 'create_ticket', status: 'success' },
  ]);

  assert.equal(merged[0].status, 'success');
  assert.equal(merged[1].step, 'create_ticket');
  assert.equal(merged[0].index, 0);
  assert.equal(merged[1].index, 1);
});
