import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function review(action, { canceled = false, paidMeanwhile = false, wallet = 200, confirmedAmount = 800 } = {}) {
  const calls = [];
  const session = { startTransaction() {}, async commitTransaction() { calls.push('commit'); }, async abortTransaction() { calls.push('abort'); }, async endSession() {} };
  const order = { _id: 'order', payments: ['wallet', 'bank'], totalPrice: 1000, walletPaidOriginal: 200, fulfillmentStatus: 'WAITING', async save(opts) { assert.equal(opts.session, session); calls.push('order-save'); } };
  const payment = { _id: 'bank', order: 'order', method: 'BANK_RECEIPT', status: 'PENDING', bankReceipt: {}, async save(opts) { assert.equal(opts.session, session); calls.push('payment-save'); } };
  let orderReads = 0, paymentReads = 0;
  const query = (value) => ({ session(s) { assert.equal(s, session); calls.push('snapshot'); return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  const deps = {
    'base/models/registerModels': {},
    'base/services/coachWallet.service': { grantAutomaticCoachCredit: async () => {} },
    'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts.status }) } },
    'base/configs/db': { default: async () => {} },
    'base/models/Order': { default: { findById: () => { orderReads++; return query(orderReads > 1 && canceled ? { ...order, fulfillmentStatus: 'CANCELED' } : order); } } },
    'base/models/Payment': { default: {
      findById: () => { paymentReads++; return query(paymentReads > 1 && paidMeanwhile ? { ...payment, status: 'PAID' } : payment); },
      find: () => query([{ method: 'WALLET', amount: wallet }]),
    } },
    mongoose: { default: { startSession: async () => session } },
    '@/lib/requireAdminPermission': { default: async () => ({ actor: { userId: 'admin' } }) },
    '@/lib/usedProductOrderStatus': { markOrderUsedProductsSold: async () => {} },
    'base/services/notificationService': { notifyNewPayment: async () => {} },
  };
  const context = vm.createContext({ console, Date, process: { env: {} }, fetch: async () => ({}) });
  const source = await readFile(new URL(`../src/app/api/admin/payments/[id]/${action}/route.js`, import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(name => new vm.SyntheticModule(Object.keys(deps[name]), function () { for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v); }, { context }));
  await mod.evaluate();
  const result = await mod.namespace.POST({ json: async () => ({ confirmedAmount }) }, { params: Promise.resolve({ id: 'bank' }) });
  return { result, calls, order };
}

test('bank approval includes wallet in the transaction snapshot exactly once', async () => {
  const { result, calls } = await review('approve');
  assert.equal(result.status, 200);
  assert.equal(result.body.totalPaid, 1000);
  assert.equal(result.body.paymentStatus, 'PAID');
  assert.equal(calls.filter(c => c === 'snapshot').length, 3);
  assert.ok(calls.includes('commit'));
});

test('bank approval cannot reactivate an order canceled after the initial read', async () => {
  const { result, calls } = await review('approve', { canceled: true });
  assert.equal(result.status, 409);
  assert.ok(calls.includes('abort'));
  assert.ok(!calls.includes('payment-save'));
});

test('bank rejection preserves a confirmed wallet payment as partially paid', async () => {
  const { result, calls } = await review('reject');
  assert.equal(result.status, 200);
  assert.equal(result.body.paymentStatus, 'PARTIALLY_PAID');
  assert.equal(calls.filter(c => c === 'snapshot').length, 3);
});

test('neither review path overwrites a payment approved after its initial read', async () => {
  for (const action of ['approve', 'reject']) {
    const { result, calls } = await review(action, { paidMeanwhile: true });
    assert.equal(result.status, 409);
    assert.ok(!calls.includes('payment-save'));
  }
});
