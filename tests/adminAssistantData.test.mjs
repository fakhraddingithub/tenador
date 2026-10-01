import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

register('./assistantHooks.mjs', import.meta.url);
await import('../models/auditPlugin.js');
for (const name of ['Admin', 'AdminActivity', 'Order', 'User', 'Product', 'Payment', 'Installment', 'AssistantQuota', 'Comment', 'Brand']) await import(`../models/${name}.js`);
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

test('generic analysis compares user growth and never writes business data', async () => {
  const User = mongoose.model('User');
  await User.collection.insertMany([
    { _id: id(), role: 'coach', createdAt: new Date('2026-06-01T10:00:00Z') },
    { _id: id(), role: 'coach', createdAt: new Date('2026-07-01T10:00:00Z') },
    { _id: id(), role: 'coach', createdAt: new Date('2026-07-02T10:00:00Z') },
  ]);
  const before = JSON.stringify(await User.collection.find({}).sort({ _id: 1 }).toArray());
  const result = await executeAssistantTool({ tool: 'analyze', dataset: 'users', metrics: [{ op: 'count' }], filters: [{ field: 'role', op: 'eq', value: 'coach' }], dateField: 'createdAt', periods: [{ from: '2026-06-01T00:00:00Z', to: '2026-07-01T00:00:00Z' }, { from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z' }] }, ['users.view']);
  assert.equal(result.data.comparison[0].difference, 1);
  assert.equal(result.data.comparison[0].percentChange, 100);
  assert.equal(JSON.stringify(await User.collection.find({}).sort({ _id: 1 }).toArray()), before);
});

test('review analysis joins product data, ranks all groups, and enforces both permissions', async () => {
  const Product = mongoose.model('Product'), Comment = mongoose.model('Comment');
  const products = Array.from({ length: 10 }, (_, i) => ({ _id: id(), sku: `analysis-${i}`, slug: `analysis-${i}`, name: `Review product ${i}`, basePrice: i * 10 }));
  await Product.collection.insertMany(products);
  await Comment.collection.insertMany(products.flatMap((p, i) => [{ user: id(), product: p._id, rating: 1 + i % 5, status: 'approved' }, { user: id(), product: p._id, rating: 5, status: 'approved' }]));
  const args = { tool: 'analyze', dataset: 'comments', join: 'products', groupBy: 'related.name', metrics: [{ op: 'avg', field: 'rating' }, { op: 'count' }], limit: 3 };
  await assert.rejects(executeAssistantTool(args, ['comments.view']), e => e.status === 403);
  const result = await executeAssistantTool(args, ['comments.view', 'products.view']);
  assert.equal(result.data.periods[0].totals[1].value, 20);
  assert.equal(result.data.periods[0].totalGroups, 10);
  assert.equal(result.data.periods[0].rows.length, 3);
  assert.equal(result.data.periods[0].rows[0].metrics[0].value, 5);
});

test('check and order-item views calculate exact amounts without array cross products', async () => {
  const order = id();
  await mongoose.model('Order').collection.insertOne({ _id: order, trackingCode: 'analysis-items', fulfillmentStatus: 'WAITING', items: [{ _id: id(), product: productA, quantity: 2, unitPrice: 100, priceEUR: 3 }, { _id: id(), product: productB, quantity: 3, unitPrice: 50 }], paymentsEUR: [{ _id: id(), amount: 4, confirmedAt: now }, { _id: id(), amount: 2, confirmedAt: now }] });
  const filters = [{ field: 'order', op: 'eq', value: String(order) }];
  const result = await executeAssistantTool({ tool: 'analyze', dataset: 'orderItems', filters, metrics: [{ op: 'sum', field: 'lineTotal' }, { op: 'sum', field: 'quantity' }, { op: 'distinct', field: 'order' }, { op: 'sum', field: 'lineTotalEUR' }] }, ['orders.view']);
  assert.deepEqual(result.data.periods[0].totals.map(m => m.value), [350, 5, 1, 6]);
  assert.equal(result.data.periods[0].totals[3].validValues, 1);
  const eur = await executeAssistantTool({ tool: 'analyze', dataset: 'euroPayments', filters, metrics: [{ op: 'sum', field: 'amount' }] }, ['orders.view']);
  assert.equal(eur.data.periods[0].totals[0].value, 6);
  await mongoose.model('Installment').collection.insertOne({ order, checks: [{ _id: id(), amount: 80, status: 'PENDING', dueDate: new Date(+now - 1000) }, { _id: id(), amount: 90, status: 'CLEARED', dueDate: new Date(+now - 1000) }] });
  const checks = await executeAssistantTool({ tool: 'analyze', dataset: 'checks', filters: [...filters, { field: 'status', op: 'ne', value: 'CLEARED' }, { field: 'dueDate', op: 'lt', value: now.toISOString() }], metrics: [{ op: 'sum', field: 'amount' }] }, ['installments.view']);
  assert.equal(checks.data.periods[0].totals[0].value, 80);
  const list = await queryData({ dataset: 'orderItems', operation: 'list', filters }, ['orders.view']);
  assert.equal(list.sources[0].href, `/p-admin/admin-orders/${order}`);
});

test('date grouping uses Tehran and unknown numeric values are not a zero growth rate', async () => {
  const user = id();
  await mongoose.model('Order').collection.insertMany([
    { user, trackingCode: 'date-analysis-1', createdAt: new Date('2026-05-01T20:29:00Z'), totalPrice: 10 },
    { user, trackingCode: 'date-analysis-2', createdAt: new Date('2026-05-01T20:31:00Z'), totalPrice: 20 },
  ]);
  const filters = [{ field: 'user', op: 'eq', value: String(user) }];
  const result = await executeAssistantTool({ tool: 'analyze', dataset: 'orders', filters, groupBy: 'createdAt', bucket: 'day', metrics: [{ op: 'sum', field: 'totalPrice' }] }, ['orders.view']);
  assert.equal(result.data.periods[0].totalGroups, 2);
  assert.equal(result.data.periods[0].totals[0].value, 30);
  const missing = await executeAssistantTool({ tool: 'analyze', dataset: 'orders', filters, metrics: [{ op: 'avg', field: 'priceEUR' }], dateField: 'createdAt', periods: [{ from: '2026-05-01T00:00:00Z', to: '2026-05-02T00:00:00Z' }, { from: '2026-05-02T00:00:00Z', to: '2026-05-03T00:00:00Z' }] }, ['orders.view']);
  assert.equal(missing.data.comparison[0].percentChange, null);
  assert.equal(missing.data.periods[0].totals[0].validValues, 0);
});

test('joining users exposes only catalog fields and rejects hidden-field filters', async () => {
  const user = id(), order = id();
  await mongoose.model('User').collection.insertOne({ _id: user, name: 'کاربر مرتبط', password: 'DO_NOT_EXPOSE_PASSWORD', email: 'DO_NOT_EXPOSE_EMAIL', otp: { code: 'DO_NOT_EXPOSE_OTP' } });
  await mongoose.model('Order').collection.insertOne({ _id: order, user, trackingCode: 'joined-private-test', totalPrice: 12 });
  const query = { dataset: 'orders', operation: 'list', join: 'users', filters: [{ field: '_id', op: 'eq', value: String(order) }] };
  const result = await queryData(query, ['orders.view', 'users.view']);
  assert.equal(result.data.rows[0].related.name, 'کاربر مرتبط');
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  await assert.rejects(queryData({ ...query, filters: [{ field: 'related.password', op: 'contains', value: 'DO_NOT' }] }, ['orders.view', 'users.view']));
});

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
  await Order.collection.insertMany(Array.from({ length: 12 }, (_, n) => ({ _id: id(), user, trackingCode: String(n), totalPrice: 100, createdAt: now })));
  const filters = [{ field: 'user', op: 'eq', value: String(user) }];
  const list = await queryData({ dataset: 'orders', operation: 'list', limit: 3, filters }, ['orders.view']);
  assert.equal(list.data.total, 12); assert.equal(list.data.rows.length, 3);
  assert.match(list.sources[0].href, /^\/p-admin\/admin-orders\/[a-f\d]{24}$/);
  const sum = await queryData({ dataset: 'orders', operation: 'sum', metric: 'totalPrice', filters }, ['orders.view']);
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
