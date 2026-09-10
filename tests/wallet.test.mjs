// Run: node --experimental-vm-modules --test tests/wallet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app/api/wallet/route.js', import.meta.url), 'utf8');

async function walletRoute({ token = 'valid', user = { _id: 'me', walletBalance: 7500 }, reviews = [], coaches = [], fail = false } = {}) {
  const calls = [];
  const context = vm.createContext({ console: { error() {} } });
  const ledger = (name, rows) => ({
    find(filter) {
      calls.push([name, filter]);
      let limit;
      return {
        select() { return this; },
        sort() { return this; },
        limit(value) { limit = value; return this; },
        async lean() {
          if (fail) throw new Error('Database unavailable');
          return rows.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
        },
      };
    },
  });
  const deps = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    'base/configs/db': { default: async () => { calls.push(['connect']); } },
    'base/models/registerModels': {},
    'base/models/User': { default: { findById(id) {
      calls.push(['user', id]);
      return { select() { return this; }, lean: async () => user };
    } } },
    'base/models/ReviewCreditTransaction': { default: ledger('reviews', reviews) },
    'base/models/CoachWalletTransaction': { default: ledger('coaches', coaches) },
    'base/utils/auth': { verifyToken: (value) => value === 'valid' ? { userId: 'me' } : false },
  };
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(deps[name]), function () {
    for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
  }, { context }));
  await mod.evaluate();
  const response = await mod.namespace.GET();
  return { ...JSON.parse(JSON.stringify(response)), calls };
}

for (const token of [null, 'expired']) {
  test(`rejects ${token || 'missing'} token before database access`, async () => {
    const result = await walletRoute({ token });
    assert.equal(result.status, 401);
    assert.deepEqual(result.calls, []);
  });
}

test('rejects a deleted user without reading transaction histories', async () => {
  const result = await walletRoute({ user: null });
  assert.equal(result.status, 401);
  assert.equal(result.calls.length, 2);
});

test('returns stored balance and only the authenticated user’s credits, newest first', async () => {
  const result = await walletRoute({
    reviews: [
      { _id: 'r1', user: 'me', amount: 100, createdAt: '2026-01-01' },
      { _id: 'private', user: 'other', amount: 999, createdAt: '2026-01-03' },
    ],
    coaches: [
      { _id: 'c1', coach: 'me', amount: 200, createdAt: '2026-01-02' },
      { _id: 'private-coach', coach: 'other', amount: 999, createdAt: '2026-01-04' },
    ],
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.wallet.balance, 7500);
  assert.deepEqual(result.body.transactions.map((tx) => tx._id), ['c1', 'r1']);
  assert.ok(result.body.transactions.every((tx) => tx.type === 'credit' && tx.description));
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
});

test('an old account without a balance or transactions opens with zero balance', async () => {
  const result = await walletRoute({ user: { _id: 'me' } });
  assert.deepEqual(result.body, { wallet: { balance: 0 }, transactions: [] });
});

test('limits combined recent history to the newest 50 entries', async () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ _id: `r${i}`, user: 'me', amount: 1, createdAt: new Date(2026, 0, i + 1).toISOString() }));
  const result = await walletRoute({ reviews: rows });
  assert.equal(result.body.transactions.length, 50);
  assert.equal(result.body.transactions[0]._id, 'r59');
});

test('database failure returns an error instead of a misleading zero balance', async () => {
  const result = await walletRoute({ fail: true });
  assert.equal(result.status, 500);
  assert.equal(result.body.wallet, undefined);
});
