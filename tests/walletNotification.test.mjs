import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';

register('./aliasHooks.mjs', import.meta.url);
register('./reviewCreditHooks.mjs', import.meta.url);
register('./walletNotificationHooks.mjs', import.meta.url);
const { adjustUserWallet } = await import('../services/adminWallet.service.js');
const { deliverWalletNotification: deliver, deliverPendingWalletNotifications: drain } = await import('../services/walletNotificationDelivery.js');
await import('../models/CoachWalletTransaction.js');
const User = mongoose.model('User');
const Wallet = mongoose.model('WalletTransaction');
const Coach = mongoose.model('CoachWalletTransaction');
const Review = mongoose.model('ReviewCreditTransaction');
const Inbox = mongoose.model('UserNotification');
const Outbox = mongoose.model('WalletNotification');
const Receipt = mongoose.model('WalletAdjustment');
let replica, user, emailCalls, pushCalls;
const oid = () => new mongoose.Types.ObjectId();
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri(), { dbName: 'wallet-notification-test' });
  for (const model of [User, Wallet, Coach, Review, Inbox, Outbox, Receipt]) await model.init();
});
after(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  for (const model of [User, Wallet, Coach, Review, Inbox, Outbox, Receipt]) await model.deleteMany({});
  user = await User.create({ provider: 'local', password: 'unused', walletBalance: 1000, email: 'wallet-test@example.invalid' });
  emailCalls = []; pushCalls = [];
  globalThis.walletTestEmail = async (tx, email) => { emailCalls.push({ id: tx._id, type: tx.type, description: tx.description, email }); };
  globalThis.walletTestPush = async (id, payload) => { pushCalls.push({ id: String(id), ...payload }); };
});
const adjustment = extra => adjustUserWallet({ userId: user._id, adminId: oid(), amount: 200, type: 'credit', description: 'توضیح ادمین', requestKey: randomUUID(), ...extra });

test('admin credit/debit create a targeted inbox atomically and deliver each email once', async () => {
  await adjustment();
  await adjustment({ type: 'debit', description: 'اصلاح اضافه‌پرداخت' });
  assert.equal(await Inbox.countDocuments({ targetUserIds: user._id }), 2);
  assert.equal(await Inbox.countDocuments({ targetUserIds: oid() }), 0);
  assert.equal(emailCalls.length, 0);
  await drain();
  await drain();
  assert.equal(emailCalls.length, 2);
  assert.equal(pushCalls.length, 2);
  assert.deepEqual(new Set(emailCalls.map(c => c.type)), new Set(['credit', 'debit']));
  assert.ok(emailCalls.every(c => c.email === user.email));
  assert.ok(pushCalls.every(c => c.url === '/p-user/wallet' && c.id === String(user._id)));
});

test('every ledger source gets a receipt, and editing an existing coach entry does not notify again', async () => {
  const session = await mongoose.startSession();
  let coach;
  try {
    await session.withTransaction(async () => {
      [coach] = await Coach.create([{ coach: user._id, amount: 250 }], { session });
      await Review.create([{ user: user._id, order: oid(), item: oid(), itemType: 'product', comment: oid(), amount: 100, granularity: 'per-item', kind: 'amount', value: 100 }], { session });
      await Wallet.create([{ user: user._id, amount: 300, type: 'debit', description: 'پرداخت با کیف پول', trackingCode: 'ORDER-123' }], { session });
    });
    assert.equal(await Outbox.countDocuments(), 3);
    await session.withTransaction(async () => { const doc = await Coach.findById(coach._id).session(session); doc.reversedAmount = 250; await doc.save({ session }); });
    assert.equal(await Outbox.countDocuments(), 3);
    await drain();
    assert.equal(emailCalls.length, 3);
    assert.ok(emailCalls.some(c => c.description === 'پاداش نظر تأییدشده'));
    assert.ok(emailCalls.some(c => c.description === 'واریز از کردیت خرید شاگرد'));
    assert.ok((await Inbox.findOne({ message: /ORDER-123/ })).message.includes('کسر شد'));
  } finally { await session.endSession(); }
});

test('rollback discards both inbox and outbox and cannot send an email', async () => {
  const session = await mongoose.startSession();
  try {
    await assert.rejects(session.withTransaction(async () => {
      await Wallet.create([{ user: user._id, amount: 300, type: 'debit', description: 'لغو شده' }], { session });
      throw new Error('rollback');
    }), /rollback/);
  } finally { await session.endSession(); }
  assert.equal(await Inbox.countDocuments(), 0);
  assert.equal(await Outbox.countDocuments(), 0);
  await drain();
  assert.equal(emailCalls.length, 0);
});

test('failure persisting the notification rolls back the complete financial adjustment', async () => {
  const original = Outbox.create;
  Outbox.create = async () => { throw new Error('outbox write failed'); };
  try { await assert.rejects(adjustment(), /outbox write failed/); }
  finally { Outbox.create = original; }
  assert.equal((await User.findById(user._id)).walletBalance, 1000);
  assert.equal(await Inbox.countDocuments(), 0);
  assert.equal(await Receipt.countDocuments(), 0);
  assert.equal(await Wallet.countDocuments(), 0);
});

test('concurrent delivery callbacks and repeated adjustment requests cannot send twice', async () => {
  const args = { requestKey: randomUUID(), adminId: oid() };
  await adjustment(args);
  await adjustment(args);
  assert.equal(await Outbox.countDocuments(), 1);
  const tx = await Outbox.findOne();
  await Promise.all(Array.from({ length: 8 }, () => deliver(tx._id)));
  assert.equal(emailCalls.length, 1);
  assert.equal(await Inbox.countDocuments(), 1);
});

test('SMTP failure retains a retry receipt without losing inbox or resending successful push', async () => {
  await adjustment();
  const tx = await Outbox.findOne();
  const original = globalThis.walletTestEmail;
  globalThis.walletTestEmail = async () => { throw new Error('SMTP unavailable'); };
  assert.equal(await deliver(tx._id), false);
  assert.equal(await Inbox.countDocuments(), 1);
  assert.equal((await User.findById(user._id)).walletBalance, 1200);
  assert.equal(pushCalls.length, 1);
  globalThis.walletTestEmail = original;
  await Outbox.updateOne({}, { nextAttemptAt: new Date(0) });
  await deliver(tx._id);
  assert.equal(emailCalls.length, 1);
  assert.equal(pushCalls.length, 1);
  assert.ok((await Outbox.findById(tx._id)).completedAt);
});

test('push failure after successful email never resends the successful email', async () => {
  await adjustment();
  const tx = await Outbox.findOne();
  const original = globalThis.walletTestPush;
  globalThis.walletTestPush = async () => { throw new Error('push unavailable'); };
  await deliver(tx._id);
  globalThis.walletTestPush = original;
  await Outbox.updateOne({}, { nextAttemptAt: new Date(0) });
  await deliver(tx._id);
  assert.equal(emailCalls.length, 1);
  assert.equal(pushCalls.length, 1);
});

test('accounts with no email still receive inbox and push without a fabricated recipient', async () => {
  await User.updateOne({ _id: user._id }, { $unset: { email: '' } });
  await adjustment(); await drain();
  assert.equal(emailCalls.length, 0);
  assert.equal(pushCalls.length, 1);
  assert.equal(await Inbox.countDocuments(), 1);
  assert.ok((await Outbox.findOne()).emailSkippedAt);
  assert.equal((await Outbox.findOne()).emailSentAt, null);
});

test('a crashed delivery claim is recovered after lease expiry and survives order/ledger deletion', async () => {
  await adjustment();
  const tx = await Outbox.findOne();
  await Outbox.updateOne({}, { lockedUntil: new Date(Date.now() + 100000), lockToken: 'crashed-worker' });
  assert.equal(await deliver(tx._id), false);
  await Outbox.updateOne({}, { lockedUntil: new Date(0) });
  await Wallet.deleteMany({});
  await drain();
  assert.equal(emailCalls.length, 1);
});
