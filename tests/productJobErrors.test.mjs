import test from 'node:test';
import assert from 'node:assert/strict';
import { AiError } from '../src/lib/ai/errors.js';
import { describeJobError } from '../src/lib/productJobs/errors.js';
test('safe provider diagnostics distinguish configuration failures from transient failures', () => {
  const missing = describeJobError(new AiError('کلید تنظیم نشده است', 503, 'AI_NOT_CONFIGURED'), 'analyse');
  assert.equal(missing.message, 'کلید تنظیم نشده است'); assert.equal(missing.retryable, false);
  assert.equal(describeJobError(new AiError('invalid', 503, 'GEMINI_KEY_INVALID'), 'analyse').retryable, false);
  assert.equal(describeJobError(new AiError('quota', 429, 'GEMINI_QUOTA'), 'analyse').retryable, true);
  assert.equal(describeJobError(new AiError('timeout', 502, 'AI_TIMEOUT'), 'analyse').retryable, true);
});
test('unknown exceptions never leak raw messages or blame images during analysis', () => {
  const result = describeJobError(new Error('private api key'), 'analyse');
  assert.doesNotMatch(result.message, /private api key|تصویر/);
  assert.equal(result.code, 'JOB_STAGE_FAILED');
});
