import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function route({ method = 'GET', auth = { userId: 'coach' }, activeCoach = true, body = {}, issueError = null } = {}) {
  const calls = [];
  const rows = Array.from({ length: 21 }, (_, i) => ({ _id: i, code: `GIFT-${i}` }));
  const deps = {
    'base/models/registerModels': {},
    'next/server': { NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200, headers: opts.headers }) } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
    'base/configs/db': { default: async () => {} },
    'base/utils/auth': { verifyToken: () => auth },
    'base/models/User': { default: { findOne: filter => { calls.push(['auth', filter]); return { select() { return this; }, lean: async () => activeCoach ? { _id: 'coach', walletBalance: 1000 } : null }; } } },
    'base/models/Coupon': { default: { find: filter => { calls.push(['history', filter]); return { select(fields) { calls.push(['fields', fields]); return this; }, sort() { return this; }, skip(n) { calls.push(['skip', n]); return this; }, limit() { return this; }, lean: async () => rows }; } } },
    'base/services/coachWallet.service': {
      coachWalletError: (message, status) => Object.assign(new Error(message), { status, code: 'WALLET_CHECKOUT_ERROR' }),
      issueCoachCoupon: async args => { calls.push(['issue', args]); if (issueError) throw issueError; return { coupon: { code: args.code }, balance: 500, replayed: false }; },
    },
    '@/lib/revalidate': { revalidateContent() {} },
  };
  const context = vm.createContext({ console: { error() {} }, URL });
  const source = await readFile(new URL('../src/app/api/coach/coupons/route.js', import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(name => new vm.SyntheticModule(Object.keys(deps[name]), function () { for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v); }, { context }));
  await mod.evaluate();
  const result = await mod.namespace[method]({ url: 'http://localhost/api/coach/coupons?page=2', json: async () => body });
  return { result, calls };
}

test('unauthenticated and non-coach requests cannot read histories or issue codes', async () => {
  for (const method of ['GET', 'POST']) {
    for (const options of [{ auth: null }, { activeCoach: false }]) {
      const { result, calls } = await route({ method, ...options });
      assert.ok([401, 403].includes(result.status));
      assert.ok(!calls.some(c => ['history', 'issue'].includes(c[0])));
    }
  }
});
test('history is scoped to the current coach and paginated without buyer contact details', async () => {
  const { result, calls } = await route();
  assert.equal(result.body.coupons.length, 20); assert.equal(result.body.hasMore, true);
  assert.equal(calls.find(c => c[0] === 'history')[1].createdByCoach, 'coach');
  assert.equal(calls.find(c => c[0] === 'skip')[1], 20);
  assert.ok(!/phone|email|usedBy\s/.test(calls.find(c => c[0] === 'fields')[1]));
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});
test('client cannot choose another coach or override coupon scope, limits or discount type', async () => {
  const { result, calls } = await route({ method: 'POST', body: { coachId: 'victim', amount: 500, code: 'GIFT', requestKey: 'retry-key', usageLimit: null, discount: { kind: 'percent', value: 100 }, active: false } });
  assert.equal(result.status, 201);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(c => c[0] === 'issue')[1])), { coachId: 'coach', amount: 500, code: 'GIFT', requestKey: 'retry-key' });
});
test('financial service conflicts return their status without claiming success', async () => {
  const { result } = await route({ method: 'POST', issueError: Object.assign(new Error('Insufficient wallet'), { status: 409, code: 'WALLET_CHECKOUT_ERROR' }) });
  assert.equal(result.status, 409); assert.equal(result.body.message, 'Insufficient wallet');
});
