import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
register('./aliasHooks.mjs', import.meta.url);
register('./walletOrderHooks.mjs', import.meta.url);
const { createWalletOrder, walletCheckoutIdentity, refundOrderWallet, updateOrderWithWallet, validateWalletAmount } = await import('../services/walletOrder.service.js');
const { recalcAndApply } = await import('../services/orderRecalc.js');
const { runWithOptionalTransaction } = await import('../utils/mongoTransactions.js');
const User = mongoose.model('User'), Order = mongoose.model('Order'), Payment = mongoose.model('Payment'), Installment = mongoose.model('Installment');
const Ledger = mongoose.model('WalletTransaction'), Attempt = mongoose.model('WalletCheckout'), Used = mongoose.model('UsedProduct');
let replica;
const oid = () => new mongoose.Types.ObjectId();
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri(), { dbName: 'wallet-orders-test', autoIndex: false });
  for (const model of [User, Order, Payment, Installment, Ledger, Attempt, Used]) await model.createCollection();
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  delete process.env.MONGODB_TRANSACTIONS;
  for (const model of [User, Order, Payment, Installment, Ledger, Attempt, Used]) await model.deleteMany({});
});

async function seed({ balance = 700, amount = 200, total = 1000, method = 'BANK_RECEIPT', key = 'checkout-request-00001' } = {}) {
  const user = await User.create({ provider: 'local', password: 'not-a-login', walletBalance: balance });
  return { user, args: {
    identity: walletCheckoutIdentity(user._id, key, { amount, total, method }), amount, bankImages: ['https://example.invalid/receipt.png'],
    draft: { user: user._id, items: [{ product: oid(), quantity: 2, unitPrice: total / 2 }], subtotalPrice: total + 100,
      discountAmount: 50, couponDiscount: 50, totalPrice: total, paymentMethod: method, address: { snapshot: {} } },
  } };
}
const balance = async (s) => (await User.findById(s.user._id)).walletBalance;

test('partial wallet payment keeps order price and pays only the bank remainder', async () => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  assert.equal(await balance(s), 500);
  assert.equal(r.order.totalPrice, 1000);
  assert.equal(r.order.walletPaid, 200);
  assert.equal(r.order.paymentStatus, 'PARTIALLY_PAID');
  assert.equal(r.payment.amount, 800);
  assert.equal((await Payment.findOne({ method: 'WALLET' })).status, 'PAID');
  assert.equal((await Ledger.findOne()).type, 'debit');
});
test('fully wallet-funded order requires no bank receipt or installment documents', async () => {
  const s = await seed({ balance: 1500, amount: 1000, method: 'INSTALLMENT' });
  s.args.bankImages = [];
  const r = await createWalletOrder(s.args);
  assert.equal(r.order.paymentMethod, 'WALLET');
  assert.equal(r.order.paymentStatus, 'PAID');
  assert.equal(r.order.fulfillmentStatus, 'PROCESSING');
  assert.equal(await balance(s), 500);
  assert.equal(await Payment.countDocuments(), 1);
  assert.equal(await Installment.countDocuments(), 0);
});
test('wallet and installment deposit are separate; checks cover the external balance', async () => {
  const s = await seed({ method: 'INSTALLMENT' });
  s.args.installmentData = { downPaymentAmount: 300, downPaymentImages: ['receipt'], numberOfChecks: 1,
    checks: [{ amount: 550, dueDate: new Date(Date.now() + 86400000) }] };
  const r = await createWalletOrder(s.args);
  assert.equal(r.installment.totalAmount, 800);
  assert.equal(r.payment.amount, 300);
  assert.equal(r.order.walletPaid, 200);
});
test('concurrent identical requests create one order and one debit', async () => {
  const s = await seed();
  const results = await Promise.all(Array.from({ length: 8 }, () => createWalletOrder(s.args)));
  assert.equal(new Set(results.map((r) => String(r.receipt.orderId))).size, 1);
  assert.equal(await balance(s), 500);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await Ledger.countDocuments(), 1);
});
test('concurrent different orders cannot overspend the wallet', async () => {
  const s = await seed({ amount: 500 });
  const other = { ...s.args, identity: walletCheckoutIdentity(s.user._id, 'checkout-request-00002', { amount: 500 }) };
  const results = await Promise.allSettled([createWalletOrder(s.args), createWalletOrder(other)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await balance(s), 200);
  assert.equal(await Order.countDocuments(), 1);
});
test('changing payload with a committed retry key is rejected', async () => {
  const s = await seed(); await createWalletOrder(s.args);
  await assert.rejects(createWalletOrder({ ...s.args, identity: { ...s.args.identity, requestHash: 'changed' } }));
  assert.equal(await balance(s), 500);
});
test('insufficient funds, disabled account and unsupported transactions never leave orders', async () => {
  const s = await seed({ balance: 100 });
  await assert.rejects(createWalletOrder(s.args));
  await User.updateOne({}, { walletBalance: 700, isBanned: true });
  await assert.rejects(createWalletOrder(s.args));
  await User.updateOne({}, { isBanned: false });
  process.env.MONGODB_TRANSACTIONS = 'disabled';
  await assert.rejects(createWalletOrder(s.args));
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Attempt.countDocuments(), 0);
  assert.equal(await Ledger.countDocuments(), 0);
});
for (const stage of ['payment', 'ledger', 'order', 'receipt']) {
  test(`failure writing ${stage} rolls back wallet and every document`, async (t) => {
    const s = await seed();
    const [model, method] = stage === 'payment' ? [Payment, 'create'] : stage === 'ledger' ? [Ledger, 'create'] : stage === 'order' ? [Order.prototype, 'save'] : [Attempt, 'updateOne'];
    t.mock.method(model, method, () => { throw new Error('Injected failure'); });
    await assert.rejects(createWalletOrder(s.args)); t.mock.restoreAll();
    assert.equal(await balance(s), 700);
    for (const model of [Order, Payment, Ledger, Attempt]) assert.equal(await model.countDocuments(), 0);
    await createWalletOrder(s.args);
    assert.equal(await balance(s), 500);
  });
}
test('cancellation refunds once even under concurrent calls; reactivation never re-debits', async () => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  await Promise.all(Array.from({ length: 5 }, () => updateOrderWithWallet(r.order._id, { fulfillmentStatus: 'CANCELED' })));
  assert.equal(await balance(s), 700);
  assert.equal(await Ledger.countDocuments({ type: 'credit' }), 1);
  assert.equal((await Order.findById(r.order._id)).walletPaid, 0);
  await updateOrderWithWallet(r.order._id, { fulfillmentStatus: 'WAITING' });
  assert.equal(await balance(s), 700);
});
test('reducing order below wallet portion refunds only excess and preserves arithmetic', async () => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  await runWithOptionalTransaction(async (session) => {
    const order = await Order.findById(r.order._id).session(session);
    order.items = [{ product: oid(), unitPrice: 100, quantity: 1 }]; order.couponDiscount = 0;
    await recalcAndApply(order, session); await order.save({ session });
  });
  assert.equal(await balance(s), 600);
  const order = await Order.findById(r.order._id);
  assert.equal(order.totalPrice, 100); assert.equal(order.walletPaid, 100); assert.equal(order.paymentStatus, 'PAID');
});
test('cash already collected is counted when refunding excess wallet after edits', async () => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  await Payment.updateOne({ _id: r.payment._id }, { status: 'PAID', amount: 950 });
  await runWithOptionalTransaction(async (session) => {
    const order = await Order.findById(r.order._id).session(session);
    order.couponDiscount = 0;
    await recalcAndApply(order, session); await order.save({ session });
  });
  assert.equal(await balance(s), 650);
  assert.equal((await Order.findById(r.order._id)).walletPaid, 50);
});
test('refund failure leaves cancellation and wallet unchanged', async (t) => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  t.mock.method(Ledger, 'create', () => { throw new Error('Refund ledger failed'); });
  await assert.rejects(updateOrderWithWallet(r.order._id, { fulfillmentStatus: 'CANCELED' }));
  assert.equal(await balance(s), 500);
  const order = await Order.findById(r.order._id);
  assert.equal(order.walletPaid, 200); assert.equal(order.fulfillmentStatus, 'WAITING');
});
test('deletion refund keeps ledger and retry tombstone to prevent accidental recreation', async () => {
  const s = await seed(); const r = await createWalletOrder(s.args);
  await runWithOptionalTransaction(async (session) => {
    const order = await Order.findById(r.order._id).session(session);
    await refundOrderWallet(order, 0, session);
    await Order.deleteOne({ _id: order._id }, { session });
    await Payment.deleteMany({ order: order._id }, { session });
  });
  assert.equal(await balance(s), 700);
  assert.equal((await createWalletOrder(s.args)).replayed, true);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Ledger.countDocuments(), 2);
});
test('unavailable used product rolls back wallet and idempotency receipt', async () => {
  const s = await seed();
  s.args.draft.items = [{ itemType: 'used_product', usedProduct: oid(), quantity: 1, unitPrice: 1000 }];
  await assert.rejects(createWalletOrder(s.args));
  assert.equal(await balance(s), 700); assert.equal(await Order.countDocuments(), 0);
});
test('amounts must be nonnegative integer tomans; over-order debit is rejected', async () => {
  for (const amount of [-1, 0.5, NaN, Infinity, '20', null, true, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateWalletAmount(amount));
  const s = await seed({ amount: 1100, balance: 2000 });
  await assert.rejects(createWalletOrder(s.args));
  assert.equal(await balance(s), 2000);
});
