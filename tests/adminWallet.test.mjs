import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

register('./aliasHooks.mjs', import.meta.url);
register('./reviewCreditHooks.mjs', import.meta.url);
process.env.MONGODB_URI_TENADOR = 'mongodb://127.0.0.1:1/unused-test-placeholder';
const { adjustUserWallet: adjust } = await import('../services/adminWallet.service.js');
const { getWalletHistory } = await import('../services/walletHistory.service.js');
const User = mongoose.model('User');
const Ledger = mongoose.model('WalletTransaction');
const Receipt = mongoose.model('WalletAdjustment');
const models = [User, Ledger, Receipt, mongoose.model('ReviewCreditTransaction'), mongoose.model('CoachWalletTransaction')];
let replica, user, admin;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri(), { dbName: 'admin-wallet-test', autoIndex: false });
  for (const model of models) await model.createCollection();
});
after(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  delete process.env.MONGODB_TRANSACTIONS;
  for (const model of models) await model.deleteMany({});
  user = await User.create({ provider: 'local', password: 'unused', role: 'user', walletBalance: 1000 });
  admin = new mongoose.Types.ObjectId();
});
const request = (extra = {}) => ({ userId: user._id, adminId: admin, amount: 300, type: 'credit', description: 'اصلاح مبلغ پرداختی', requestKey: randomUUID(), ...extra });
const balance = async () => (await User.findById(user._id)).walletBalance;

test('credit and debit record actor, snapshots and the same description in user history', async () => {
  await adjust(request());
  await adjust(request({ type: 'debit', amount: 200, description: 'بازگشت واریز اشتباه' }));
  assert.equal(await balance(), 1100);
  const rows = await Ledger.find().sort({ createdAt: 1 }).lean();
  assert.deepEqual(rows.map(row => [row.balanceBefore, row.balanceAfter, String(row.admin)]), [[1000, 1300, String(admin)], [1300, 1100, String(admin)]]);
  const history = await getWalletHistory(user._id);
  assert.equal(history[0].description, 'بازگشت واریز اشتباه');
  assert.equal(history[0].type, 'debit');
  assert.equal(history[0].admin, undefined);
  assert.equal(history[0].balanceBefore, undefined);
  assert.equal((await getWalletHistory(new mongoose.Types.ObjectId())).length, 0);
});

test('duplicate concurrent submissions credit once and receipts survive ledger removal', async () => {
  const input = request();
  await Promise.all(Array.from({ length: 8 }, () => adjust(input)));
  assert.equal(await balance(), 1300);
  assert.equal(await Ledger.countDocuments(), 1);
  assert.equal(await Receipt.countDocuments(), 1);
  await Ledger.deleteMany({});
  assert.equal((await adjust(input)).replayed, true);
  assert.equal(await balance(), 1300);
  await assert.rejects(adjust({ ...input, amount: 301 }), { code: 'WALLET_ADJUSTMENT_ERROR', status: 409 });
});

test('concurrent debits cannot overdraw the wallet', async () => {
  const results = await Promise.allSettled([adjust(request({ type: 'debit', amount: 700 })), adjust(request({ type: 'debit', amount: 700 }))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await balance(), 300);
  assert.equal(await Ledger.countDocuments(), 1);
  assert.equal(await Receipt.countDocuments(), 1);
});

test('concurrent distinct credits and debits preserve every successful movement', async () => {
  await Promise.all(Array.from({ length: 6 }, (_, i) => adjust(request({ amount: 100, type: i % 2 ? 'credit' : 'debit' }))));
  assert.equal(await balance(), 1000);
  assert.equal(await Ledger.countDocuments(), 6);
});

test('invalid amounts, missing description, overdraft and overflow never create receipts or money', async () => {
  for (const amount of [0, -1, 1.5, '500', Infinity, Number.MAX_SAFE_INTEGER]) await assert.rejects(adjust(request({ amount })));
  for (const description of ['', '   ', null, 'x'.repeat(501)]) await assert.rejects(adjust(request({ description })));
  await assert.rejects(adjust(request({ type: 'debit', amount: 1001 })));
  await assert.rejects(adjust(request({ requestKey: 'bad' })));
  await assert.rejects(adjust(request({ type: 'invalid' })));
  assert.equal(await balance(), 1000);
  assert.equal(await Receipt.countDocuments(), 0);
});

test('ledger failure rolls back balance and permanent receipt, allowing a safe retry', async () => {
  const input = request();
  const original = Ledger.prototype.save;
  Ledger.prototype.save = async () => { throw new Error('simulated ledger failure'); };
  try { await assert.rejects(adjust(input), /simulated ledger failure/); }
  finally { Ledger.prototype.save = original; }
  assert.equal(await balance(), 1000);
  assert.equal(await Receipt.countDocuments(), 0);
  await adjust(input);
  assert.equal(await balance(), 1300);
});

test('transactions unavailable and deleted users fail without ledger writes', async () => {
  process.env.MONGODB_TRANSACTIONS = 'disabled';
  await assert.rejects(adjust(request()), { status: 503 });
  delete process.env.MONGODB_TRANSACTIONS;
  await User.deleteOne({ _id: user._id });
  await assert.rejects(adjust(request()), { status: 404 });
  assert.equal(await Receipt.countDocuments(), 0);
  assert.equal(await Ledger.countDocuments(), 0);
});

test('legacy missing or null wallet initializes safely', async () => {
  await User.collection.updateOne({ _id: user._id }, { $unset: { walletBalance: '' } });
  await adjust(request());
  assert.equal(await balance(), 300);
  await User.collection.updateOne({ _id: user._id }, { $set: { walletBalance: null } });
  await adjust(request());
  assert.equal(await balance(), 300);
});

test('corrupt negative balance cannot be silently accepted by an adjustment', async () => {
  await User.collection.updateOne({ _id: user._id }, { $set: { walletBalance: -100 } });
  await assert.rejects(adjust(request()), { status: 409 });
  assert.equal(await balance(), -100);
  assert.equal(await Receipt.countDocuments(), 0);
});
