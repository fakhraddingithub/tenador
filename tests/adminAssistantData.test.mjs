import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

register('./assistantHooks.mjs', import.meta.url);
await import('../models/auditPlugin.js');
for (const name of ['Admin', 'AdminActivity', 'Order', 'User', 'Product', 'Payment', 'Installment', 'AssistantQuota']) await import(`../models/${name}.js`);
const { executeAssistantTool, queryData } = await import('../services/adminAssistantTools.js');
const { consumeAssistantQuota } = await import('../src/lib/assistant/quota.js');
let db;
const id = () => new mongoose.Types.ObjectId();
const actor = id(), actorUser = id(), productA = id(), productB = id();
const now = new Date('2026-09-29T12:00:00Z');

before(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  process.env.MONGODB_URI_TENADOR = db.getUri();
  global._mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
  await mongoose.model('Admin').collection.insertOne({ _id: actor, user: actorUser, name: 'ادمین احمدی', username: 'ahmadi' });
  const base = { actorAdmin: actor, actorUser, actorSnapshot: { name: 'ادمین احمدی' }, result: 'success', createdAt: new Date('2026-09-29T08:00:00Z') };
  await mongoose.model('AdminActivity').collection.insertMany([
    { ...base, action: 'product.create', resourceType: 'Product', resourceId: String(productA), resourceLabel: 'محصول الف', related: [{ action: 'product.create', type: 'Product', id: String(productB), label: 'محصول ب' }] },
    { ...base, action: 'product.create', resourceType: 'Product', resourceId: String(productA) },
    { ...base, action: 'authz.granted', result: 'attempted', permissions: ['products.create'] },
    { ...base, action: 'product.create', result: 'failure', resourceType: 'Product', resourceId: String(id()) },
    { ...base, action: 'product.create', createdAt: new Date('2026-09-28T20:29:59Z'), resourceType: 'Product', resourceId: String(id()) },
  ]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });

test('counts unique primary and related creations; excludes failed, attempted and yesterday', async () => {
  const output = await executeAssistantTool({ tool: 'activity', actor: 'احمدی', entity: 'product', operation: 'create', range: 'today' }, ['admins.viewActivity', 'products.view'], now);
  assert.equal(output.data.count, 2);
  assert.equal(output.data.byActor[0].count, 2);
  assert.equal(output.data.from, '2026-09-28T20:30:00.000Z');
  assert.equal(output.sources[0].href, '/p-admin/admin-products'); // no edit permission
  assert.equal(await mongoose.model('AdminActivity').countDocuments(), 5);
});

test('ambiguous actor requests clarification instead of merging people', async () => {
  await mongoose.model('Admin').collection.insertOne({ _id: id(), name: 'ادمین احمدی دوم', username: 'ahmadi2' });
  const output = await executeAssistantTool({ tool: 'activity', actor: 'احمدی', range: 'today' }, ['admins.viewActivity'], now);
  assert.equal(output.data.candidates.length, 2);
  assert.ok(output.data.clarification);
});

test('missing audit coverage is marked as incomplete, never an exact total', async () => {
  await mongoose.model('AdminActivity').collection.insertOne({ actorAdmin: actor, actorUser, result: 'success', action: 'product.create', resourceType: 'Product', resourceId: String(id()), createdAt: now, metadata: { relatedOmitted: 2 } });
  const output = await executeAssistantTool({ tool: 'activity', actor: String(actor), range: 'today' }, ['admins.viewActivity'], new Date(+now + 1000));
  assert.equal(output.data.incomplete, true);
});

test('list projections redact secrets, totals are not sampled and order links use real ids', async () => {
  const User = mongoose.model('User'), Order = mongoose.model('Order');
  const user = id();
  await User.collection.insertOne({ _id: user, name: 'تست', password: 'secret', otp: { code: '1234' }, email: 'private@example.com', createdAt: now });
  const people = await queryData({ dataset: 'users', operation: 'list' }, ['users.view']);
  const encoded = JSON.stringify(people);
  assert.ok(!/secret|1234|private@example/.test(encoded));
  await Order.collection.insertMany(Array.from({ length: 12 }, (_, n) => ({ _id: id(), trackingCode: String(n), totalPrice: 100, createdAt: now })));
  const list = await queryData({ dataset: 'orders', operation: 'list', limit: 3 }, ['orders.view']);
  assert.equal(list.data.total, 12); assert.equal(list.data.rows.length, 3);
  assert.match(list.sources[0].href, /^\/p-admin\/admin-orders\/[a-f\d]{24}$/);
  const sum = await queryData({ dataset: 'orders', operation: 'sum', metric: 'totalPrice' }, ['orders.view']);
  assert.equal(sum.data.value, 1200);
});

test('tool access is enforced even when the model asks for a forbidden tool', async () => {
  await assert.rejects(executeAssistantTool({ tool: 'activity' }, ['assistant.use']), (e) => e.status === 403);
  await assert.rejects(executeAssistantTool({ tool: 'finance' }, ['orders.view']), (e) => e.status === 403);
  await assert.rejects(executeAssistantTool({ tool: 'query', dataset: 'users', operation: 'count' }, ['products.view']), (e) => e.status === 403);
});

test('activity reports the full actor count when the displayed list is limited', async () => {
  await mongoose.model('AdminActivity').collection.insertMany(Array.from({ length: 10 }, () => ({
    actorAdmin: id(), result: 'success', action: 'brand.create', resourceType: 'Brand',
    resourceId: String(id()), createdAt: new Date(+now - 1000),
  })));
  const result = await executeAssistantTool({ tool: 'activity', entity: 'brand', range: 'today' }, ['admins.viewActivity'], now);
  assert.equal(result.data.count, 10);
  assert.equal(result.data.totalActors, 10);
  assert.equal(result.data.actorsShown, 8);
});

test('quota is atomic under concurrent requests across instances', async () => {
  const user = String(id());
  const results = await Promise.allSettled(Array.from({ length: 15 }, () => consumeAssistantQuota(user, +now)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 10);
  assert.equal(results.filter((r) => r.status === 'rejected' && r.reason.status === 429).length, 5);
});

test('financial summary reuses paid and cleared amounts, excludes canceled orders and separates EUR', async () => {
  const Order = mongoose.model('Order'), Payment = mongoose.model('Payment'), Installment = mongoose.model('Installment');
  const order = id(), paid = id(), pending = id();
  await Payment.collection.insertMany([{ _id: paid, order, status: 'PAID', amount: 300 }, { _id: pending, order, status: 'PENDING', amount: 200 }]);
  await Installment.collection.insertOne({ order, checks: [{ status: 'CLEARED', amount: 200 }, { status: 'PENDING', amount: 200 }] });
  await Order.collection.insertMany([
    { _id: order, trackingCode: 'finance-test', user: actorUser, totalPrice: 1000, payments: [paid, pending], fulfillmentStatus: 'WAITING', priceEUR: 10, paymentsEUR: [{ amount: 3 }], createdAt: new Date('2026-08-02T12:00:00Z') },
    { _id: id(), trackingCode: 'canceled-test', totalPrice: 9000, fulfillmentStatus: 'CANCELED', createdAt: new Date('2026-08-02T12:00:00Z') },
  ]);
  const args = { tool: 'finance', range: 'custom', from: '2026-08-01T00:00:00Z', to: '2026-08-03T00:00:00Z', currency: 'IRT' };
  const toman = await executeAssistantTool(args, ['analytics.view']);
  assert.equal(toman.data.revenue, 1000); assert.equal(toman.data.collected, 500); assert.equal(toman.data.outstanding, 500);
  const euro = await executeAssistantTool({ ...args, currency: 'EUR' }, ['analytics.view']);
  assert.equal(euro.data.revenue, 10); assert.equal(euro.data.collected, 3); assert.equal(euro.data.outstanding, 7);
});
