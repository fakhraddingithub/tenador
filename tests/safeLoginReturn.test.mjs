import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLoginReturn } from '../utils/safeLoginReturn.js';

test('preserves OAuth state, callback and PKCE query without decoding it again', () => {
  const path = '/api/mcp/oauth/authorize?state=a%26b%2B%252F&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcallback&code_challenge=xyz';
  assert.equal(safeLoginReturn(path), path);
  assert.equal(safeLoginReturn('/p-user/orders'), '/p-user/orders');
});
test('login cannot redirect to an external origin or execute a script', () => {
  for (const path of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\nevil.example', ' /p-user']) {
    assert.equal(safeLoginReturn(path), '/');
  }
});
