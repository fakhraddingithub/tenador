import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function routes({ denied = null, fail = null, user = { _id: 'user-id', walletBalance: 500 } } = {}) {
  const calls = [];
  const context = vm.createContext({ console: { error() {} } });
  const deps = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    mongoose: { default: { isValidObjectId: id => id === 'user-id' || id === 'comment-id' } },
    'base/models/registerModels': {},
    'base/configs/db': { default: async () => calls.push('connect') },
    'base/models/User': { default: { findById(id) { calls.push(['user', id]); return { select() { return this; }, lean: async () => user }; } } },
    '@/lib/requireAdminPermission': { default: async permission => { calls.push(permission); return { denied, actor: { userId: 'authenticated-admin' } }; } },
    'base/services/walletHistory.service': { getWalletHistory: async id => { calls.push(['history', id]); return []; } },
    'base/services/adminWallet.service': { adjustUserWallet: async payload => { calls.push(['adjust', payload]); if (fail) throw fail; return { balanceAfter: 800, transaction: 'tx' }; } },
    'base/services/reviewCredit.service': { setCommentRewardAmount: async (...args) => { calls.push(['reward', ...args]); if (fail) throw fail; return { amount: 200 }; } },
  };
  async function load(path) {
    const mod = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), { context });
    await mod.link(name => new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
    }, { context }));
    await mod.evaluate();
    return mod.namespace;
  }
  return { calls, wallet: await load('../src/app/api/admin/users/[userId]/wallet/route.js'), reward: await load('../src/app/api/admin/comments/[id]/reward/route.js') };
}
const params = { params: Promise.resolve({ userId: 'user-id', id: 'comment-id' }) };
const request = body => ({ json: async () => body });

for (const status of [401, 403]) test(`wallet read/write and reward override deny ${status} before reading the body or database`, async () => {
  const denied = { status };
  const { wallet, reward, calls } = await routes({ denied });
  const req = { json: () => { throw new Error('must not parse'); } };
  assert.equal(await wallet.GET(req, params), denied);
  assert.equal(await wallet.POST(req, params), denied);
  assert.equal(await reward.PATCH(req, params), denied);
  assert.deepEqual(calls, ['users.view', 'users.adjustWallet', 'comments.adjustReward']);
});

test('wallet uses authenticated actor and route owner, ignoring forged balance or admin fields', async () => {
  const { wallet, calls } = await routes();
  const result = await wallet.POST(request({ amount: 300, type: 'credit', description: 'توضیح', requestKey: 'unique-request-key', adminId: 'forged', userId: 'other', walletBalance: 999999 }), params);
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[2])), ['adjust', { userId: 'user-id', adminId: 'authenticated-admin', amount: 300, type: 'credit', description: 'توضیح', requestKey: 'unique-request-key' }]);
});

test('history is scoped to route owner and is never publicly cached', async () => {
  const { wallet, calls } = await routes();
  const result = await wallet.GET(null, params);
  assert.equal(result.body.wallet.balance, 500);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(calls.at(-1), ['history', 'user-id']);
  const missing = await routes({ user: null });
  assert.equal((await missing.wallet.GET(null, params)).status, 404);
  assert.ok(!missing.calls.some(c => Array.isArray(c) && c[0] === 'history'));
});

test('reward editing passes only amount and authenticated actor to the service', async () => {
  const { reward, calls } = await routes();
  assert.equal((await reward.PATCH(request({ amount: 200, adminId: 'forged', status: 'approved' }), params)).status, 200);
  assert.deepEqual(calls, ['comments.adjustReward', 'connect', ['reward', 'comment-id', 200, 'authenticated-admin']]);
});

test('invalid target IDs never reach money services', async () => {
  const { wallet, reward, calls } = await routes();
  const invalid = { params: Promise.resolve({ userId: 'bad', id: 'bad' }) };
  assert.equal((await wallet.GET(null, invalid)).status, 400);
  assert.equal((await wallet.POST(null, invalid)).status, 400);
  assert.equal((await reward.PATCH(null, invalid)).status, 400);
  assert.deepEqual(calls, ['users.view', 'users.adjustWallet', 'comments.adjustReward']);
});

test('financial conflicts and transaction outages propagate as failures, not success', async () => {
  const blocked = await routes({ fail: Object.assign(new Error('conflict'), { code: 'WALLET_ADJUSTMENT_ERROR', status: 409 }) });
  assert.equal((await blocked.wallet.POST(request({}), params)).status, 409);
  const locked = await routes({ fail: Object.assign(new Error('locked'), { code: 'REVIEW_CREDIT_CONFLICT' }) });
  assert.equal((await locked.reward.PATCH(request({ amount: 200 }), params)).status, 409);
  const unavailable = await routes({ fail: Object.assign(new Error('no transaction'), { code: 'REVIEW_CREDIT_TRANSACTION_REQUIRED' }) });
  assert.equal((await unavailable.reward.PATCH(request({ amount: 200 }), params)).status, 503);
});
