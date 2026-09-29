import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { AssistantError, readChatBody } from '../src/lib/assistant/validation.js';
import { availableCatalog, TOOL_PERMISSIONS } from '../src/lib/assistant/catalog.js';

async function setup({ denied = null, ready = true, runError = null } = {}) {
  const calls = [];
  const ctx = { userId: 'actor', permissions: ['assistant.use', 'orders.view'], membership: { _id: 'membership' } };
  const deps = {
    '@/lib/requireAdminPermission': { default: async (key) => { calls.push(['gate', key]); return { ctx, denied }; } },
    '@/lib/assistant/gemini': { generateJson: () => {}, getAssistantConfig: () => ({ configured: ready, enabled: true }) },
    '@/lib/assistant/validation': { AssistantError, readChatBody },
    '@/lib/assistant/orchestrator': { runAssistant: async (args) => { calls.push(['run', args]); if (runError) throw runError; return { answer: 'پاسخ', sources: [], tokens: 10, calls: 2 }; } },
    '@/lib/assistant/quota': { consumeAssistantQuota: async (user) => { calls.push(['quota', user]); } },
    'base/services/adminAssistantTools': { executeAssistantTool: () => {} },
    '@/lib/assistant/catalog': { availableCatalog, TOOL_PERMISSIONS },
    '@/lib/adminActivity': { recordAdminActivity: async () => {} },
  };
  const context = vm.createContext({ Response, URL, AbortSignal, console: { info() {}, error() {} } });
  const mod = new vm.SourceTextModule(await readFile(new URL('../src/app/api/admin/assistant/route.js', import.meta.url), 'utf8'), { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(deps[name]), function () { for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v); }, { context }));
  await mod.evaluate();
  return { api: mod.namespace, calls };
}
const request = (body = { message: 'سفارش‌ها' }, origin = 'http://localhost') => new Request('http://localhost/api/admin/assistant', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('unauthorized GET and POST never consume quota or call the model', async () => {
  for (const status of [401, 403]) {
    const { api, calls } = await setup({ denied: Response.json({}, { status }) });
    assert.equal((await api.GET()).status, status);
    assert.equal((await api.POST(request())).status, status);
    assert.ok(calls.every(([name]) => name === 'gate'));
  }
});
test('cross-origin, invalid input and unconfigured service fail before quota or model', async () => {
  for (const [options, req, expected] of [[{}, request({}, 'https://other.test'), 403], [{}, request({ message: '' }), 400], [{ ready: false }, request(), 503]]) {
    const { api, calls } = await setup(options);
    assert.equal((await api.POST(req)).status, expected);
    assert.ok(!calls.some(([name]) => ['quota', 'run'].includes(name)));
  }
});
test('API uses authenticated identity and live permissions, not client claims', async () => {
  const { api, calls } = await setup();
  const result = await api.POST(request({ message: 'سفارش‌ها', permissions: ['admins.viewActivity'], userId: 'victim' }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(calls.find(([name]) => name === 'quota')[1], 'actor');
  const args = calls.find(([name]) => name === 'run')[1];
  assert.equal(args.actorId, 'membership');
  assert.deepEqual(args.permissions, ['assistant.use', 'orders.view']);
});
test('quota/provider errors are actionable; unexpected errors do not leak internals', async () => {
  for (const [error, status] of [[new AssistantError('سهمیه پر است', 429), 429], [new Error('secret database URI'), 500]]) {
    const { api } = await setup({ runError: error });
    const res = await api.POST(request());
    assert.equal(res.status, status);
    assert.ok(!(await res.text()).includes('secret'));
  }
});
