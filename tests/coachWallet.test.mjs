import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
register('./aliasHooks.mjs', import.meta.url);
register('./walletOrderHooks.mjs', import.meta.url);
const { issueCoachCoupon, addCoachCredit, grantAutomaticCoachCredit } = await import('../services/coachWallet.service.js');
const { createWalletOrder, walletCheckoutIdentity, updateOrderWithWallet } = await import('../services/walletOrder.service.js');
const { runWithOptionalTransaction } = await import('../utils/mongoTransactions.js');
const { couponDisplayCode } = await import('../src/lib/couponLabel.js');
const User = mongoose.model('User'), Coupon = mongoose.model('Coupon'), Ledger = mongoose.model('WalletTransaction');
const Issue = mongoose.model('CoachCouponIssue'), Order = mongoose.model('Order'), Payment = mongoose.model('Payment');
const Credit = mongoose.model('CoachWalletTransaction'), Rule = mongoose.model('CoachCredit');
const oid = () => new mongoose.Types.ObjectId();
let replica;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri(), { dbName: 'coach-wallet-test', autoIndex: false });
  for (const m of Object.values(mongoose.models)) await m.createCollection();
  await Coupon.createIndexes();
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  delete process.env.MONGODB_TRANSACTIONS;
  for (const m of Object.values(mongoose.models)) await m.deleteMany({});
});
const user = (fields = {}) => User.create({ provider: 'local', password: 'test', walletBalance: 1000, ...fields });
const issue = (coach, patch = {}) => issueCoachCoupon({ coachId: coach._id, code: 'COACH-GIFT', amount: 400, requestKey: 'coach-issue-request-0001', ...patch });
async function checkoutArgs(buyer, coupon, { amount = 0, total = 600, key = 'redeem-coupon-request-0001' } = {}) {
  const draft = { user: buyer._id, items: [{ product: oid(), quantity: 1, unitPrice: total + coupon.discount.value }],
    subtotalPrice: total + coupon.discount.value, couponDiscount: coupon.discount.value, totalPrice: total,
    paymentMethod: 'BANK_RECEIPT', coupon: { _id: coupon._id, code: coupon.code, createdByCoach: coupon.createdByCoach, coachName: coupon.coachName } };
  return { draft, amount, identity: walletCheckoutIdentity(buyer._id, key, draft), bankImages: ['receipt'] };
}

test('issuance debits the shared wallet and creates an unrestricted one-use amount coupon', async () => {
  const coach = await user({ role: 'coach', name: 'مربی', lastName: 'نمونه' });
  const result = await issue(coach);
  assert.equal(result.balance, 600);
  assert.equal(result.coupon.usageLimit, 1);
  assert.equal(result.coupon.perUserLimit, null);
  assert.equal(result.coupon.startAt, null); assert.equal(result.coupon.endAt, null);
  assert.equal(result.coupon.minCartValue, 0); assert.equal(result.coupon.applicableTo, 'all');
  assert.equal(couponDisplayCode(result.coupon), 'COACH-GIFT — مربی نمونه');
  assert.equal((await Ledger.findOne()).amount, 400);
  assert.equal(await Credit.countDocuments(), 0);
});

test('concurrent identical issuance requests debit once and return the same coupon', async () => {
  const coach = await user({ role: 'coach' });
  const results = await Promise.all(Array.from({ length: 8 }, () => issue(coach)));
  assert.equal(new Set(results.map(r => String(r.coupon._id))).size, 1);
  assert.equal((await User.findById(coach._id)).walletBalance, 600);
  assert.equal(await Ledger.countDocuments(), 1); assert.equal(await Issue.countDocuments(), 1);
});

test('concurrent different codes cannot spend beyond the shared balance', async () => {
  const coach = await user({ role: 'coach', walletBalance: 500 });
  const results = await Promise.allSettled([issue(coach), issue(coach, { code: 'SECOND', requestKey: 'second-request-00001' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await User.findById(coach._id)).walletBalance, 100);
});

test('duplicate admin/coach code and changed retry payload never debit money', async () => {
  const coach = await user({ role: 'coach' });
  await Coupon.create({ code: 'ADMIN', discount: { kind: 'amount', value: 50 } });
  await assert.rejects(issue(coach, { code: 'ADMIN' }), /قبلاً/);
  assert.equal((await User.findById(coach._id)).walletBalance, 1000);
  await issue(coach);
  await assert.rejects(issue(coach, { amount: 500 }), /اطلاعات دیگری/);
  assert.equal((await User.findById(coach._id)).walletBalance, 600);
});

test('only active coaches and positive integer amounts can create codes', async () => {
  for (const fields of [{ role: 'user' }, { role: 'coach', isBanned: true }]) await assert.rejects(issue(await user(fields)), /مربی فعال/);
  const coach = await user({ role: 'coach' });
  for (const amount of [-1, 0, 1.5, NaN, '400', Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(issue(coach, { amount }));
  for (const code of ['x', '<script>', 'CODE SPACE', 'الف']) await assert.rejects(issue(coach, { code }));
  process.env.MONGODB_TRANSACTIONS = 'disabled';
  await assert.rejects(issue(coach), /تراکنش/);
  assert.equal(await Coupon.countDocuments(), 0);
});

for (const failure of ['coupon', 'ledger']) test(`failure writing ${failure} rolls back issuance and allows safe retry`, async () => {
  const coach = await user({ role: 'coach' });
  const target = failure === 'coupon' ? Coupon.prototype : Ledger;
  const method = failure === 'coupon' ? 'save' : 'create';
  const original = target[method]; target[method] = async () => { throw new Error('injected failure'); };
  try { await assert.rejects(issue(coach), /injected/); } finally { target[method] = original; }
  assert.equal((await User.findById(coach._id)).walletBalance, 1000);
  assert.equal(await Issue.countDocuments(), 0);
  await issue(coach); assert.equal((await User.findById(coach._id)).walletBalance, 600);
});

test('two users racing to redeem the same code can create only one order', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach);
  const buyers = await Promise.all([user({ name: 'خریدار اول' }), user({ name: 'خریدار دوم' })]);
  const args = await Promise.all(buyers.map(buyer => checkoutArgs(buyer, coupon)));
  const results = await Promise.allSettled(args.map(createWalletOrder));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await Order.countDocuments(), 1);
  const consumed = await Coupon.findById(coupon._id);
  assert.ok(consumed.usedAt); assert.ok(consumed.usedByName); assert.ok(consumed.usedTrackingCode);
  assert.equal(consumed.appliedAmount, 400);
});

test('a coupon may cover the whole order without requiring a bank receipt', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach);
  const args = await checkoutArgs(await user(), coupon, { total: 0 }); args.bankImages = [];
  const result = await createWalletOrder(args);
  assert.equal(result.order.totalPrice, 0); assert.equal(result.order.paymentStatus, 'PAID');
  assert.equal(await Payment.countDocuments(), 0);
  assert.equal((await createWalletOrder(args)).replayed, true);
});

test('wallet plus coach coupon creates correct pending balance and cannot double-spend either', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach); const buyer = await user();
  const args = await checkoutArgs(buyer, coupon, { total: 600, amount: 200 });
  const result = await createWalletOrder(args);
  assert.equal(result.payment.amount, 400); assert.equal(result.order.walletPaid, 200);
  assert.equal((await User.findById(buyer._id)).walletBalance, 800);
  await createWalletOrder(args);
  assert.equal((await User.findById(buyer._id)).walletBalance, 800);
});

test('failed order write leaves the coupon valid and wallet untouched', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach); const buyer = await user();
  const args = await checkoutArgs(buyer, coupon, { amount: 200 });
  const original = Payment.create; Payment.create = async () => { throw new Error('payment failure'); };
  try { await assert.rejects(createWalletOrder(args), /payment failure/); } finally { Payment.create = original; }
  assert.equal((await Coupon.findById(coupon._id)).usedAt, null);
  assert.equal((await User.findById(buyer._id)).walletBalance, 1000);
  await createWalletOrder(args);
});

test('cancellation and physical order deletion cannot restore a consumed code', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach); const buyer = await user();
  const args = await checkoutArgs(buyer, coupon);
  const result = await createWalletOrder(args);
  await updateOrderWithWallet(result.order._id, { fulfillmentStatus: 'CANCELED' });
  await Order.deleteOne({ _id: result.order._id });
  const freshArgs = await checkoutArgs(buyer, coupon, { key: 'new-coupon-request-0002' });
  await assert.rejects(createWalletOrder(freshArgs), /مصرف شده/);
  assert.ok((await Coupon.findById(coupon._id)).usedByName);
});

test('manual coach credit and its reporting ledger are atomic in the same user wallet', async () => {
  const coach = await user({ role: 'coach' });
  await addCoachCredit({ coachId: coach._id, amount: 250, addedBy: oid() });
  assert.equal((await User.findById(coach._id)).walletBalance, 1250);
  assert.equal((await Credit.findOne()).amount, 250);
  const original = Credit.create; Credit.create = async () => { throw new Error('credit ledger failed'); };
  try { await assert.rejects(addCoachCredit({ coachId: coach._id, amount: 250, addedBy: oid() }), /ledger failed/); } finally { Credit.create = original; }
  assert.equal((await User.findById(coach._id)).walletBalance, 1250);
});

test('automatic rewards respect coach/date scope and repeated payment events credit once', async () => {
  const coach = await user({ role: 'coach' }), buyer = await user({ coach: coach._id });
  await Rule.create({ title: 'Test rule', scope: 'all_coaches', targetType: 'all', credit: { kind: 'percent', value: 10 }, active: true });
  await Rule.create({ title: 'Test rule', scope: 'specific_coach', coach: oid(), targetType: 'all', credit: { kind: 'percent', value: 99 }, priority: 100, active: true });
  await Rule.create({ title: 'Test rule', scope: 'all_coaches', targetType: 'all', credit: { kind: 'percent', value: 90 }, priority: 99, active: true, endAt: new Date('2020-01-01') });
  const order = await Order.create({ user: buyer._id, items: [{ product: oid(), unitPrice: 1000, quantity: 1 }], subtotalPrice: 1000, totalPrice: 1000, paymentMethod: 'BANK_RECEIPT', paymentStatus: 'PAID', coachCreditEligible: true });
  const grant = () => runWithOptionalTransaction(async session => { const doc = await Order.findById(order._id).session(session); await grantAutomaticCoachCredit(doc, session); await doc.save({ session }); });
  await Promise.all(Array.from({ length: 5 }, grant));
  assert.equal((await User.findById(coach._id)).walletBalance, 1100);
  assert.equal(await Credit.countDocuments({ source: 'automatic' }), 1);
  await updateOrderWithWallet(order._id, { fulfillmentStatus: 'CANCELED' });
  assert.equal((await User.findById(coach._id)).walletBalance, 1000);
  assert.equal((await Credit.findOne()).reversedAmount, 100);
  await updateOrderWithWallet(order._id, { fulfillmentStatus: 'CANCELED' });
  assert.equal((await User.findById(coach._id)).walletBalance, 1000);
});


test('unused face value returns to the creator once with the coupon consumption', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach); const buyer = await user();
  const args = await checkoutArgs(buyer, coupon, { total: 0 });
  args.draft.couponDiscount = 250; args.draft.subtotalPrice = 250; args.draft.items[0].unitPrice = 250;
  args.identity = walletCheckoutIdentity(buyer._id, 'partial-face-request-0001', args.draft);
  await createWalletOrder(args);
  assert.equal((await User.findById(coach._id)).walletBalance, 750);
  assert.equal((await Coupon.findById(coupon._id)).returnedAmount, 150);
  await createWalletOrder(args);
  assert.equal((await User.findById(coach._id)).walletBalance, 750);
  assert.equal(await Ledger.countDocuments({ coupon: coupon._id, type: 'credit' }), 1);
});

test('remainder refund failure rolls back coupon consumption and order creation', async () => {
  const coach = await user({ role: 'coach' }); const { coupon } = await issue(coach); const buyer = await user();
  const args = await checkoutArgs(buyer, coupon, { total: 0 });
  args.draft.couponDiscount = 250; args.draft.subtotalPrice = 250; args.draft.items[0].unitPrice = 250;
  await User.updateOne({ _id: coach._id }, { walletBalance: Number.MAX_SAFE_INTEGER });
  await assert.rejects(createWalletOrder(args), /باقیمانده/);
  assert.equal((await Coupon.findById(coupon._id)).usedAt, null);
  assert.equal(await Order.countDocuments(), 0);
});


test('first-purchase and minimum-purchase rules are enforced across concurrent orders', async () => {
  const coach = await user({ role: 'coach' }), buyer = await user({ coach: coach._id, walletBalance: 3000 });
  const rule = await Rule.create({ title: 'First purchase', scope: 'all_coaches', targetType: 'all', credit: { kind: 'amount', value: 100 }, conditions: { onlyNewStudents: true, minPurchaseAmount: 900 } });
  const build = (key, total) => ({ amount: total, bankImages: [], identity: walletCheckoutIdentity(buyer._id, key, { total }), draft: { user: buyer._id, items: [{ product: oid(), unitPrice: total, quantity: 1 }], subtotalPrice: total, totalPrice: total, paymentMethod: 'BANK_RECEIPT', coachCreditEligible: true } });
  await Promise.all([createWalletOrder(build('first-purchase-request-01', 1000)), createWalletOrder(build('first-purchase-request-02', 1000))]);
  assert.equal((await User.findById(coach._id)).walletBalance, 1100);
  assert.equal((await Rule.findById(rule._id)).totalCreditPaid, 100);
  assert.equal((await Rule.findById(rule._id)).triggerCount, 1);
  const smallBuyer = await user({ coach: coach._id });
  const small = build('small-purchase-request-01', 500); small.draft.user = smallBuyer._id;
  await createWalletOrder(small);
  assert.equal((await User.findById(coach._id)).walletBalance, 1100);
});

test('automatic credit ledger failure rolls back buyer debit and paid order', async () => {
  const coach = await user({ role: 'coach' }), buyer = await user({ coach: coach._id });
  await Rule.create({ title: 'Credit', scope: 'all_coaches', targetType: 'all', credit: { kind: 'amount', value: 100 } });
  const args = { amount: 1000, identity: walletCheckoutIdentity(buyer._id, 'auto-failure-request-01', {}), draft: { user: buyer._id, items: [{ product: oid(), quantity: 1, unitPrice: 1000 }], subtotalPrice: 1000, totalPrice: 1000, paymentMethod: 'BANK_RECEIPT', coachCreditEligible: true } };
  const original = Credit.create; Credit.create = async () => { throw new Error('automatic ledger failure'); };
  try { await assert.rejects(createWalletOrder(args), /automatic ledger/); } finally { Credit.create = original; }
  assert.equal((await User.findById(buyer._id)).walletBalance, 1000);
  assert.equal((await User.findById(coach._id)).walletBalance, 1000);
  assert.equal(await Order.countDocuments(), 0);
});


test('first issuance safely creates its retry collection inside an empty deployment', async () => {
  const coach = await user({ role: 'coach' });
  await Issue.collection.drop();
  const result = await issue(coach);
  assert.equal(result.balance, 600);
  assert.equal(await Issue.countDocuments(), 1);
});
