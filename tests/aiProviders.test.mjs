import test from 'node:test';
import assert from 'node:assert/strict';
import { AiError, generate, generateJson, getAiConfig, getAiProvider } from '../src/lib/ai/index.js';

const GEMINI = { GEMINI_API_KEY: 'gemini-secret', GEMINI_MODEL: 'gemini-test' };
const OPENAI = { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'openai-secret', OPENAI_MODEL: 'gpt-test' };

function fakeFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return responder(url, init);
  };
  return { fetchImpl, calls };
}
const geminiReply = (text, finishReason = 'STOP') => () =>
  Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason }], usageMetadata: { totalTokenCount: 7 } });
const openAiReply = (content, finish_reason = 'stop') => () =>
  Response.json({ choices: [{ message: { content }, finish_reason }], usage: { total_tokens: 9 } });

const rejects = async (promise, code, status) => {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AiError, `expected AiError, got ${error?.name}`);
    assert.equal(error.code, code);
    if (status) assert.equal(error.status, status);
    assert.ok(!/secret/.test(error.message), 'provider secrets never reach the message');
    return true;
  });
};

test('provider is chosen by configuration; unknown providers fail explicitly', () => {
  assert.equal(getAiProvider({ env: GEMINI }).name, 'gemini');
  assert.equal(getAiProvider({ env: OPENAI }).name, 'openai');
  assert.deepEqual(getAiConfig({ env: OPENAI }), { provider: 'openai', model: 'gpt-test', configured: true });
  assert.deepEqual(getAiConfig({ env: {} }), { provider: 'gemini', model: 'gemini-flash-lite-latest', configured: false });
  assert.throws(() => getAiProvider({ env: { AI_PROVIDER: 'nope' } }), (e) => e.code === 'AI_UNKNOWN_PROVIDER');
  assert.equal(getAiConfig({ env: { AI_PROVIDER: 'nope' } }).configured, false);
});

test('both providers normalize to the same result for the same request', async () => {
  const request = { system: 'sys', prompt: 'make json', json: true, maxTokens: 500 };
  const g = fakeFetch(geminiReply('{"a":1}'));
  const o = fakeFetch(openAiReply('{"a":1}'));
  const fromGemini = await generateJson(request, { env: GEMINI, fetchImpl: g.fetchImpl });
  const fromOpenAi = await generateJson(request, { env: OPENAI, fetchImpl: o.fetchImpl });
  assert.deepEqual(fromGemini.value, fromOpenAi.value);
  assert.deepEqual([fromGemini.provider, fromGemini.model, fromGemini.tokens], ['gemini', 'gemini-test', 7]);
  assert.deepEqual([fromOpenAi.provider, fromOpenAi.model, fromOpenAi.tokens], ['openai', 'gpt-test', 9]);

  // Gemini wire format
  const gc = g.calls[0];
  assert.match(gc.url, /models\/gemini-test:generateContent$/);
  assert.equal(gc.init.headers['x-goog-api-key'], 'gemini-secret');
  assert.equal(gc.body.systemInstruction.parts[0].text, 'sys');
  assert.equal(gc.body.contents[0].parts[0].text, 'make json');
  assert.equal(gc.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(gc.body.generationConfig.maxOutputTokens, 500);
  assert.equal(gc.body.generationConfig.responseSchema, undefined);
  // OpenAI wire format
  const oc = o.calls[0];
  assert.match(oc.url, /\/chat\/completions$/);
  assert.equal(oc.init.headers.Authorization, 'Bearer openai-secret');
  assert.deepEqual(oc.body.messages, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'make json' }]);
  assert.deepEqual(oc.body.response_format, { type: 'json_object' });
  assert.equal(oc.body.max_completion_tokens, 500);
});

test('a JSON schema is translated to each provider’s own form', async () => {
  const schema = { type: 'object', properties: { type: { type: 'string', enum: ['a'] }, list: { type: 'array', items: { type: 'STRING' } } } };
  const g = fakeFetch(geminiReply('{}'));
  const o = fakeFetch(openAiReply('{}'));
  await generateJson({ prompt: 'p', schema }, { env: GEMINI, fetchImpl: g.fetchImpl });
  await generateJson({ prompt: 'p', schema }, { env: OPENAI, fetchImpl: o.fetchImpl });
  assert.deepEqual(g.calls[0].body.generationConfig.responseSchema,
    { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['a'] }, list: { type: 'ARRAY', items: { type: 'STRING' } } } });
  assert.deepEqual(o.calls[0].body.response_format.json_schema.schema,
    { type: 'object', properties: { type: { type: 'string', enum: ['a'] }, list: { type: 'array', items: { type: 'string' } } } });
});

test('incomplete, filtered, empty and non-JSON answers are errors, never data', async () => {
  for (const [env, reply] of [[GEMINI, geminiReply('{"a":', 'MAX_TOKENS')], [OPENAI, openAiReply('{"a":', 'length')]]) {
    await rejects(generate({ prompt: 'p' }, { env, fetchImpl: fakeFetch(reply).fetchImpl }), 'AI_INCOMPLETE', 502);
  }
  await rejects(generate({ prompt: 'p' }, { env: GEMINI, fetchImpl: fakeFetch(geminiReply('x', 'SAFETY')).fetchImpl }), 'AI_INCOMPLETE');
  await rejects(generate({ prompt: 'p' }, { env: OPENAI, fetchImpl: fakeFetch(openAiReply('  ')).fetchImpl }), 'AI_EMPTY');
  await rejects(generateJson({ prompt: 'p' }, { env: GEMINI, fetchImpl: fakeFetch(geminiReply('not json')).fetchImpl }), 'AI_INVALID_JSON');
  const fenced = await generateJson({ prompt: 'p' }, { env: OPENAI, fetchImpl: fakeFetch(openAiReply('```json\n{"ok":true}\n```')).fetchImpl });
  assert.deepEqual(fenced.value, { ok: true });
});

test('provider rejections, rate limits, timeouts and missing keys map to standard errors', async () => {
  const status = (code, body = { error: { message: 'secret-detail' } }) => () => Response.json(body, { status: code });
  await rejects(generate({ prompt: 'p' }, { env: GEMINI, fetchImpl: fakeFetch(status(429)).fetchImpl }), 'GEMINI_QUOTA', 429);
  await rejects(generate({ prompt: 'p' }, { env: GEMINI, fetchImpl: fakeFetch(status(400, { error: { message: 'API key not valid secret' } })).fetchImpl }), 'GEMINI_KEY_INVALID', 503);
  await rejects(generate({ prompt: 'p' }, { env: OPENAI, fetchImpl: fakeFetch(status(429)).fetchImpl }), 'OPENAI_QUOTA', 429);
  await rejects(generate({ prompt: 'p' }, { env: OPENAI, fetchImpl: fakeFetch(status(401)).fetchImpl }), 'OPENAI_KEY_INVALID', 503);
  await rejects(generate({ prompt: 'p' }, { env: OPENAI, fetchImpl: fakeFetch(status(500)).fetchImpl }), 'OPENAI_SERVICE_UNAVAILABLE', 503);

  const timeout = async () => { throw new DOMException('timed out', 'TimeoutError'); };
  const offline = async () => { throw new TypeError('fetch failed'); };
  for (const env of [GEMINI, OPENAI]) {
    await rejects(generate({ prompt: 'p' }, { env, fetchImpl: timeout }), 'AI_TIMEOUT', 504);
    await rejects(generate({ prompt: 'p' }, { env, fetchImpl: offline }), 'AI_UNREACHABLE', 503);
  }

  let called = false;
  const never = async () => { called = true; };
  await rejects(generate({ prompt: 'p' }, { env: {}, fetchImpl: never }), 'AI_NOT_CONFIGURED', 503);
  await rejects(generate({ prompt: 'p' }, { env: { AI_PROVIDER: 'openai' }, fetchImpl: never }), 'AI_NOT_CONFIGURED', 503);
  await rejects(generate({ prompt: 'p' }, { env: { ...GEMINI, GEMINI_MODEL: '../evil' }, fetchImpl: never }), 'AI_NOT_CONFIGURED', 503);
  assert.equal(called, false);
});
