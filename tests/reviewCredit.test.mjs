// Real Mongo replica set; no production data, no email/push side effects.
// Run: node --test --test-timeout=180000 tests/reviewCredit.test.mjs
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

register('./aliasHooks.mjs', import.meta.url);
register('./reviewCreditHooks.mjs', import.meta.url);
process.env.MONGODB_URI_TENADOR = 'mongodb://127.0.0.1:1/unused-test-placeholder';
const { moderateCommentWithReviewCredit: moderate } = await import('../services/reviewCredit.service.js');
const { validateReviewCreditConfig } = await import('../src/lib/reviewCreditFinance.js');
const User = mongoose.model('User');
const Order = mongoose.model('Order');
const Comment = mongoose.model('Comment');
const Ledger = mongoose.model('ReviewCreditTransaction');
const Setting = mongoose.model('SiteSetting');
const oid = () => new mongoose.Types.ObjectId();
const config = { enabled: true, kind: 'percent', value: 10, eligibleRoles: ['user'], granularity: 'per-item' };
let replica;

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri(), { dbName: 'review-credit-test', autoIndex: false });
  global._mongooseCache.conn = mongoose;
  for (const model of [User, Order, Comment, Ledger, Setting]) await model.createCollection();
  await Ledger.createIndexes();
  await Setting.createIndexes();
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await replica?.stop();
});

beforeEach(async () => {
  delete process.env.MONGODB_TRANSACTIONS;
  for (const model of [User, Order, Comment, Ledger, Setting]) await model.deleteMany({});
  await Setting.create({ key: 'review_credit_config', value: config });
});

async function seed({ sameProduct = false, used = false, status = 'pending' } = {}) {
  const user = await User.create({ provider: 'local', password: 'not-a-login', role: 'user', walletBalance: 700 });
  const item = oid();
  const item2 = sameProduct ? item : oid();
  const field = used ? 'usedProduct' : 'product';
  const type = used ? 'used_product' : 'product';
  const order = await Order.create({ user: user._id, fulfillmentStatus: 'DELIVERED', paymentStatus: 'PAID', paymentMethod: 'ONLINE',
    subtotalPrice: 2500, totalPrice: 2500,
    items: [
      { [field]: item, itemType: type, variant: oid(), unitPrice: 1000, quantity: 2 },
      { [field]: item2, itemType: type, variant: oid(), unitPrice: 500, quantity: 1 },
    ],
  });
  const comment = await Comment.create({ user: user._id, order: order._id, [field]: item, isVerifiedPurchase: true, text: 'تجربه خرید', status });
  return { user, order, comment, item, item2, field };
}

async function state(s) {
  return {
    balance: (await User.findById(s.user._id).lean()).walletBalance,
    status: (await Comment.findById(s.comment._id).lean()).status,
    count: await Ledger.countDocuments(),
  };
}

test('sums all purchased variants and quantities for this product only', async () => {
  const s = await seed({ sameProduct: true });
  const result = await moderate(s.comment._id, 'approved');
  assert.equal(result.credit.amount, 250);
  assert.deepEqual(await state(s), { balance: 950, status: 'approved', count: 1 });
  assert.equal((await Comment.findById(s.comment._id)).approved, true);
});

test('other products are excluded; fixed reward is once per product, not per unit', async () => {
  const s = await seed();
  assert.equal((await moderate(s.comment._id, 'approved')).credit.amount, 200);
  await Setting.updateOne({}, { value: { ...config, kind: 'amount', value: 75 } });
  const c2 = await Comment.create({ user: s.user._id, order: s.order._id, product: s.item2, isVerifiedPurchase: true, text: 'خرید دوم' });
  assert.equal((await moderate(c2._id, 'approved')).credit.amount, 75);
  assert.equal((await User.findById(s.user._id)).walletBalance, 975);
});

test('used products receive the same verified reward', async () => {
  const s = await seed({ used: true });
  assert.equal((await moderate(s.comment._id, 'approved')).credit.amount, 200);
  assert.equal((await Ledger.findOne()).itemType, 'usedProduct');
});

test('repeated approval, rejection, and approval again never pay twice', async () => {
  const s = await seed();
  await moderate(s.comment._id, 'approved');
  assert.equal((await moderate(s.comment._id, 'approved')).credit.status, 'already_granted');
  await moderate(s.comment._id, 'rejected');
  await moderate(s.comment._id, 'approved');
  assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
});

test('an already-approved comment with no ledger can safely retry payment', async () => {
  const s = await seed({ status: 'approved' });
  assert.equal((await moderate(s.comment._id, 'approved')).credit.amount, 200);
  assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
});

test('concurrent approvals pay once', async () => {
  const s = await seed();
  const results = await Promise.all(Array.from({ length: 8 }, () => moderate(s.comment._id, 'approved')));
  assert.equal(results.filter((r) => r.credit.status === 'granted').length, 1);
  assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
});

test('concurrent reviews for the same product across duplicate comments pay once', async () => {
  const s = await seed();
  const c2 = await Comment.create({ user: s.user._id, order: s.order._id, product: s.item, isVerifiedPurchase: true, text: 'نظر تکراری قدیمی' });
  await Promise.all([moderate(s.comment._id, 'approved'), moderate(c2._id, 'approved')]);
  assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
});

test('per-order reward covers the total once across concurrent product reviews', async () => {
  await Setting.updateOne({}, { value: { ...config, granularity: 'per-order' } });
  const s = await seed();
  const c2 = await Comment.create({ user: s.user._id, order: s.order._id, product: s.item2, isVerifiedPurchase: true, text: 'محصول دوم' });
  await Promise.all([moderate(s.comment._id, 'approved'), moderate(c2._id, 'approved')]);
  assert.deepEqual(await state(s), { balance: 950, status: 'approved', count: 1 });
  assert.equal((await Ledger.findOne()).item, null);
});

for (const scenario of ['wallet-error', 'wallet-no-match', 'ledger-error', 'comment-error', 'settings-error']) {
  test(`${scenario}: failure rolls back approval, ledger and balance; retry succeeds`, async (t) => {
    const s = await seed();
    if (scenario === 'wallet-no-match') t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 0 }));
    else {
      const [target, method] = scenario === 'wallet-error' ? [User, 'updateOne']
        : scenario === 'ledger-error' ? [Ledger, 'create']
        : scenario === 'comment-error' ? [Comment.prototype, 'save'] : [Setting, 'findOne'];
      t.mock.method(target, method, () => { throw new Error('Injected write/read failure'); });
    }
    await assert.rejects(moderate(s.comment._id, 'approved'));
    t.mock.restoreAll();
    assert.deepEqual(await state(s), { balance: 700, status: 'pending', count: 0 });
    await moderate(s.comment._id, 'approved');
    assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
  });
}

test('non-transactional mode never writes money or approves an eligible reward', async () => {
  const s = await seed();
  process.env.MONGODB_TRANSACTIONS = 'disabled';
  await assert.rejects(moderate(s.comment._id, 'approved'), { code: 'REVIEW_CREDIT_TRANSACTION_REQUIRED' });
  assert.deepEqual(await state(s), { balance: 700, status: 'pending', count: 0 });
});

test('disabled rewards can still approve comments without transaction support', async () => {
  const s = await seed();
  await Setting.updateOne({}, { value: { ...config, enabled: false } });
  process.env.MONGODB_TRANSACTIONS = 'disabled';
  assert.equal((await moderate(s.comment._id, 'approved')).credit.status, 'disabled');
  assert.deepEqual(await state(s), { balance: 700, status: 'approved', count: 0 });
});

for (const scenario of ['wrong-owner', 'wrong-product', 'unverified', 'reply', 'canceled', 'not-sent', 'wrong-role']) {
  test(`${scenario} is never credited`, async () => {
    const s = await seed();
    if (scenario === 'wrong-owner') await Order.updateOne({}, { user: oid() });
    if (scenario === 'wrong-product') await Comment.updateOne({}, { product: oid() });
    if (scenario === 'unverified') await Comment.updateOne({}, { isVerifiedPurchase: false });
    if (scenario === 'reply') await Comment.updateOne({}, { parent: oid() });
    if (scenario === 'canceled') await Order.updateOne({}, { fulfillmentStatus: 'CANCELED' });
    if (scenario === 'not-sent') await Order.updateOne({}, { fulfillmentStatus: 'PROCESSING' });
    if (scenario === 'wrong-role') await User.updateOne({}, { role: 'coach' });
    assert.equal((await moderate(s.comment._id, 'approved')).credit.status, 'ineligible');
    assert.deepEqual(await state(s), { balance: 700, status: 'approved', count: 0 });
  });
}

for (const initial of ['per-item', 'per-order']) {
  test(`changing granularity from ${initial} cannot stack rewards`, async () => {
    const s = await seed();
    await Setting.updateOne({}, { value: { ...config, granularity: initial } });
    await moderate(s.comment._id, 'approved');
    await Setting.updateOne({}, { value: { ...config, granularity: initial === 'per-item' ? 'per-order' : 'per-item' } });
    const c2 = await Comment.create({ user: s.user._id, order: s.order._id, product: s.item2, isVerifiedPurchase: true, text: 'محصول دوم' });
    assert.equal((await moderate(c2._id, 'approved')).credit.status, 'already_granted');
    assert.equal(await Ledger.countDocuments(), 1);
  });
}

test('legacy ledger is never automatically repaid even if old wallet state is ambiguous', async () => {
  const s = await seed();
  await Ledger.create({ order: s.order._id, user: s.user._id, comment: s.comment._id, item: s.item, itemType: 'product', ...config, amount: 200 });
  assert.equal((await moderate(s.comment._id, 'approved')).credit.status, 'already_granted');
  assert.equal((await User.findById(s.user._id)).walletBalance, 700);
});

test('invalid configuration is rejected and does not silently approve without credit', async () => {
  const s = await seed();
  await Setting.updateOne({}, { value: { ...config, value: 101 } });
  await assert.rejects(moderate(s.comment._id, 'approved'), { code: 'INVALID_REVIEW_CREDIT_CONFIG' });
  assert.deepEqual(await state(s), { balance: 700, status: 'pending', count: 0 });
  for (const patch of [{ value: NaN }, { value: Infinity }, { value: -1 }, { value: '10' }, { kind: 'bogus' }, { granularity: 'bogus' }, { eligibleRoles: [] }, { eligibleRoles: ['admin'] }, { enabled: 'true' }]) {
    assert.ok(validateReviewCreditConfig({ ...config, ...patch }));
  }
  assert.equal(validateReviewCreditConfig(config), null);
});

test('fractional percentages round exactly at half a toman', async () => {
  const s = await seed();
  await Order.updateOne({}, { 'items.0.quantity': 1 });
  await Setting.updateOne({}, { value: { ...config, value: 0.35 } });
  assert.equal((await moderate(s.comment._id, 'approved')).credit.amount, 4);
});

test('zero reward approves without changing money or recording a paid ledger', async () => {
  const s = await seed();
  await Setting.updateOne({}, { value: { ...config, value: 0 } });
  assert.equal((await moderate(s.comment._id, 'approved')).credit.status, 'zero_amount');
  assert.deepEqual(await state(s), { balance: 700, status: 'approved', count: 0 });
});

test('invalid legacy quantity cannot produce a payout or approve silently', async () => {
  const s = await seed();
  await Order.collection.updateOne({ _id: s.order._id }, { $set: { 'items.0.quantity': 0 } });
  await assert.rejects(moderate(s.comment._id, 'approved'), { code: 'INVALID_REVIEW_CREDIT_AMOUNT' });
  assert.deepEqual(await state(s), { balance: 700, status: 'pending', count: 0 });
});

test('wallet overflow is rejected before any financial write', async () => {
  const s = await seed();
  await User.updateOne({}, { walletBalance: Number.MAX_SAFE_INTEGER });
  await assert.rejects(moderate(s.comment._id, 'approved'), { code: 'INVALID_REVIEW_CREDIT_AMOUNT' });
  assert.equal(await Ledger.countDocuments(), 0);
  assert.equal((await Comment.findById(s.comment._id)).status, 'pending');
});

test('concurrent rewards for distinct products preserve both wallet increments', async () => {
  const s = await seed();
  const c2 = await Comment.create({ user: s.user._id, order: s.order._id, product: s.item2, isVerifiedPurchase: true, text: 'محصول دوم' });
  await Promise.all([moderate(s.comment._id, 'approved'), moderate(c2._id, 'approved')]);
  assert.deepEqual(await state(s), { balance: 950, status: 'approved', count: 2 });
});

test('missing ledger index still cannot duplicate money under concurrent approvals', async () => {
  const s = await seed();
  await Ledger.collection.dropIndex('order_1_item_1');
  try {
    await Promise.all(Array.from({ length: 6 }, () => moderate(s.comment._id, 'approved')));
    assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
  } finally {
    await Ledger.createIndexes();
  }
});

test('transaction retries after a transient write conflict do not duplicate money', async (t) => {
  const s = await seed();
  const update = User.updateOne.bind(User);
  let attempts = 0;
  t.mock.method(User, 'updateOne', (...args) => {
    if (++attempts === 1) {
      const error = new mongoose.mongo.MongoServerError({ message: 'Injected transient conflict', code: 112 });
      error.addErrorLabel('TransientTransactionError');
      throw error;
    }
    return update(...args);
  });
  await moderate(s.comment._id, 'approved');
  assert.ok(attempts >= 2);
  assert.deepEqual(await state(s), { balance: 900, status: 'approved', count: 1 });
});
