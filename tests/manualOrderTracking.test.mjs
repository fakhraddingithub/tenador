// Real MongoDB schemas/queries in two separate connections; only auth, cache and
// notification delivery are stubbed. Never connects to the project's databases.
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import * as manual from "../src/lib/manualTracking.js";
import * as warehouse from "../src/lib/warehouseDb.js";

for (const name of ["Product", "Variant", "UsedProduct"]) {
  mongoose.model(name, new mongoose.Schema({}, { strict: false }));
}
const { default: Order } = await import("../models/Order.js");
const oid = () => new mongoose.Types.ObjectId();
const adminId = oid();
let server, conn, Tracking, UsedTracking, route, itemsRoute, sync, mutation;
let denied = null, notices = [], warehouseError = false;
const request = (body) => ({ json: async () => body });
const params = (order) => ({ params: Promise.resolve({ orderId: String(order._id) }) });
const read = (order) => Order.findById(order._id).select("+items.manualTrackingHistory +items.flowSelections.manualTrackingHistory").lean();
const asJson = (value) => JSON.parse(JSON.stringify(value));

async function load(relative, deps) {
  const context = vm.createContext({ console, Date });
  const mod = new vm.SourceTextModule(await readFile(new URL(relative, import.meta.url), "utf8"), { context });
  await mod.link((name) => {
    if (!deps[name]) throw new Error(`Missing dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  return mod.namespace;
}

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(server.getUri(), { dbName: "manual-tracking-test" });
  conn = await mongoose.createConnection(server.getUri(), { dbName: "warehouse-tracking-test" }).asPromise();
  Tracking = warehouse.getItemTrackingModel(conn);
  UsedTracking = warehouse.getUsedItemTrackingModel(conn);
  await Promise.all([Order, ...Object.values(mongoose.models), Tracking, UsedTracking].map((model) => model.createCollection()));
  const deps = {
    mongoose: { default: mongoose },
    "node:crypto": await import("node:crypto"),
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    "base/models/registerModels": {},
    "base/models/Order": { default: Order },
    "base/configs/db": { default: async () => {} },
    "@/lib/warehouseDb": { ...warehouse, connectWarehouseDB: async () => { if (warehouseError) throw new Error("warehouse unavailable (test)"); return conn; } },
    "@/lib/manualTracking": manual,
    "@/lib/reviewRequestNotice": { notifyOrderDelivered: (id) => notices.push(id) },
    "@/lib/requireAdminPermission": { default: async () => ({ denied, actor: { userId: String(adminId) } }) },
    "@/lib/revalidate": { revalidateContent() {} },
  };
  mutation = await load("../services/orderTrackingMutation.js", deps);
  deps["base/services/orderTrackingMutation"] = mutation;
  sync = await load("../src/lib/orderFulfillmentSync.js", deps);
  deps["@/lib/orderFulfillmentSync"] = sync;
  route = await load("../src/app/api/admin/orders/[orderId]/tracking/route.js", deps);
  itemsRoute = await load("../src/app/api/admin/orders/[orderId]/items/route.js", {
    ...deps,
    "base/models/Product": { default: mongoose.models.Product },
    "base/models/Variant": { default: mongoose.models.Variant },
    "base/models/UsedProduct": { default: mongoose.models.UsedProduct },
    "base/models/User": { default: {} },
    "base/services/priceEngine": { computeCartPrice: async () => { throw new Error("not used"); } },
    "base/services/orderRecalc": { recalcAndApply: async () => {} },
    "base/services/orderEurRecalc": { applyOrderEurTotal() {} },
    "@/lib/variantImages": { buildVariantSnapshot() {} },
  });
}, { timeout: 180000 });

beforeEach(async () => {
  denied = null;
  notices = [];
  warehouseError = false;
  await Promise.all([Order, Tracking, UsedTracking, ...["Product", "Variant", "UsedProduct"].map((name) => mongoose.models[name])].map((model) => model.deleteMany({})));
});

after(async () => {
  await conn?.close();
  await mongoose.disconnect();
  await server?.stop();
});

async function seed(quantity = 9, overrides = {}) {
  const product = await mongoose.models.Product.create({ name: "راکت تست", sku: "TEST" });
  return Order.create({
    user: oid(), items: [{ product: product._id, quantity, unitPrice: 1000 }],
    subtotalPrice: quantity * 1000, totalPrice: quantity * 1000,
    paymentMethod: "BANK_RECEIPT", fulfillmentStatus: "PROCESSING", ...overrides,
  });
}

async function track(order, { index = 0, node = null, status = "IN_TRANSIT", assigned = true, legacy = false, product = null } = {}) {
  const code = String(oid());
  return Tracking.create({
    productRef: product || order.items[index].product, trackingId: code, barcode: `B-${code}`,
    status, currentWarehouse: oid(), tenadorOrderId: assigned ? String(order._id) : null,
    orderItemIndex: legacy || !assigned ? null : index, flowNodeId: node,
  });
}

const rows = (delivered = 3, transit = 4) => [
  ...(delivered ? [{ status: "DELIVERED", quantity: delivered }] : []),
  ...(transit ? [{ status: "IN_TRANSIT", quantity: transit }] : []),
];

async function save(order, manualTracking = rows(), extra = {}) {
  return route.POST(request({ action: "set_manual", orderItemIndex: 0,
    itemId: String(order.items[0]._id), revision: 0, manualTracking, ...extra }), params(order));
}

test("9 units: 3 delivered, 4 in transit, 2 remaining; audit is saved without creating warehouse records", async () => {
  const order = await seed();
  assert.equal((await save(order)).status, 200);
  const fresh = await read(order);
  assert.equal(fresh.manualTrackingEnabled, true);
  assert.deepEqual(asJson(fresh.items[0].manualTracking), rows());
  assert.equal(String(fresh.items[0].manualTrackingHistory[0].by), String(adminId));
  assert.equal(fresh.items[0].manualTrackingRevision, 1);
  assert.equal(fresh.totalPrice, order.totalPrice);
  assert.equal(fresh.paymentStatus, order.paymentStatus);
  assert.equal(await Tracking.countDocuments(), 0);
  const result = await route.GET(null, params(order));
  assert.equal(result.status, 200);
  assert.equal(result.body.totalManual, 7);
  assert.equal(result.body.totalScanned, 0);
  assert.equal(result.body.itemsWithTracking[0].remainingCount, 2);
  assert.equal(fresh.fulfillmentStatus, "PROCESSING");
});

test("unassigned remainder can be marked for purchase and then scanned without changing manual units", async () => {
  const order = await seed();
  await save(order);
  const base = { orderItemIndex: 0, itemId: String(order.items[0]._id) };
  assert.equal((await route.POST(request({ ...base, action: "mark_purchase" }), params(order))).status, 200);
  assert.equal((await read(order)).fulfillmentStatus, "NEEDS_PURCHASE");
  for (let i = 0; i < 2; i++) {
    const barcode = await track(order, { assigned: false });
    const result = await route.POST(request({ ...base, barcode: barcode.barcode, procurementStatus: "PURCHASED" }), params(order));
    assert.equal(result.status, 200);
    assert.equal(result.body.remainingCount, 1 - i);
    assert.equal((await read(order)).fulfillmentStatus, i === 0 ? "NEEDS_PURCHASE" : "PROCESSING");
  }
  const extra = await track(order, { assigned: false });
  assert.equal((await route.POST(request({ ...base, barcode: extra.barcode }), params(order))).status, 400);
  assert.deepEqual(asJson((await read(order)).items[0].manualTracking), rows());
});

test("legacy warehouse matching consumes quota, including variant references", async () => {
  const order = await seed(2);
  await track(order, { legacy: true });
  assert.equal((await save(order, rows(2, 0))).status, 400);
  assert.equal((await save(order, rows(1, 0))).status, 200);
  const result = await route.GET(null, params(order));
  assert.equal(result.body.itemsWithTracking[0].remainingCount, 0);
});

test("all-manual delivery requires every unit; clearing or returning a unit undoes automatic delivery", async () => {
  const order = await seed(2);
  await save(order, rows(1, 0));
  assert.equal((await read(order)).fulfillmentStatus, "PROCESSING");
  await save(order, rows(2, 0), { revision: 1 });
  assert.equal((await read(order)).fulfillmentStatus, "DELIVERED");
  assert.equal(notices.length, 1);
  await sync.syncOrderFulfillmentFromTracking(order._id);
  assert.equal(notices.length, 1);
  await save(order, [{ status: "RETURNED", quantity: 1 }], { revision: 2 });
  assert.equal((await read(order)).fulfillmentStatus, "PROCESSING");
  await save(order, [], { revision: 3 });
  assert.deepEqual(asJson((await read(order)).items[0].manualTracking), []);
  assert.equal((await read(order)).manualTrackingEnabled, true);
});

test("mixed warehouse/manual delivery counts missing items and physical flow selections", async () => {
  const order = await seed(2);
  const product = await mongoose.models.Product.create({ name: "زه تست" });
  order.items[0].flowSelections.push({ nodeId: "string", nodeType: "category", selectedProduct: product._id });
  await order.save();
  await track(order, { status: "DELIVERED" });
  await save(order, rows(1, 0));
  assert.equal((await read(order)).fulfillmentStatus, "PROCESSING");
  assert.equal((await save(order, rows(2, 0), { flowNodeId: "string" })).status, 200);
  assert.equal((await read(order)).fulfillmentStatus, "DELIVERED");
  const result = await route.GET(null, params(order));
  assert.equal(result.body.totalRequired, 4);
  assert.equal(result.body.totalManual, 3);
  assert.equal(result.body.totalScanned, 1);
  assert.equal(result.body.itemsWithTracking[0].flowTracking[0].remainingCount, 0);
});

test("existing orders retain their original automatic fulfillment behavior", async () => {
  const order = await seed(9);
  await track(order, { status: "DELIVERED" });
  assert.equal(await sync.syncOrderFulfillmentFromTracking(order._id), "DELIVERED");
  const empty = await seed(1, { fulfillmentStatus: "SENT" });
  assert.equal(await sync.syncOrderFulfillmentFromTracking(empty._id), null);
  assert.equal((await read(empty)).fulfillmentStatus, "SENT");
});

test("filling the purchase remainder manually removes obsolete purchase status", async () => {
  const order = await seed(2, { fulfillmentStatus: "NEEDS_PURCHASE" });
  order.items[0].procurementStatus = "TO_PURCHASE";
  await order.save();
  await save(order, rows(0, 2));
  assert.equal((await read(order)).items[0].procurementStatus, null);
  assert.equal((await read(order)).fulfillmentStatus, "PROCESSING");
});

test("stale revisions and changed item identity are rejected without overwriting", async () => {
  const order = await seed();
  await save(order);
  assert.equal((await save(order, rows(9, 0))).status, 409);
  assert.equal((await save(order, [], { revision: 1, itemId: String(oid()) })).status, 409);
  assert.deepEqual(asJson((await read(order)).items[0].manualTracking), rows());
});

test("simultaneous manual saves cannot both succeed", async () => {
  const order = await seed();
  const results = await Promise.all([save(order, rows(9, 0)), save(order, rows(0, 9))]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await read(order)).items[0].manualTrackingHistory.length, 1);
});

test("scan and manual allocation racing for the final unit cannot over-allocate", async () => {
  const order = await seed(1);
  const barcode = await track(order, { assigned: false });
  const results = await Promise.all([
    save(order, rows(1, 0)),
    route.POST(request({ orderItemIndex: 0, barcode: barcode.barcode }), params(order)),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const fresh = await read(order);
  const count = await Tracking.countDocuments({ tenadorOrderId: String(order._id) });
  assert.equal(count + manual.manualTrackingCount(fresh.items[0]), 1);
});

test("an active lock blocks mutations, expired locks recover, and old owners cannot release new locks", async () => {
  const order = await seed();
  const release = await mutation.acquireTrackingMutation(order._id);
  assert.equal((await save(order)).status, 409);
  await Order.updateOne({ _id: order._id }, { $set: { "trackingMutationLock.expiresAt": new Date(0) } });
  const releaseNew = await mutation.acquireTrackingMutation(order._id);
  await assert.rejects(release.assertOwned(), (error) => error.status === 409);
  await release();
  assert.equal((await save(order)).status, 409);
  await releaseNew();
  assert.equal((await save(order)).status, 200);
});

test("audit history and mutation locks are excluded from ordinary order reads", async () => {
  const order = await seed();
  await save(order);
  const release = await mutation.acquireTrackingMutation(order._id);
  try {
    const fresh = await Order.findById(order._id).lean();
    assert.equal(fresh.trackingMutationLock, undefined);
    assert.equal(fresh.items[0].manualTrackingHistory, undefined);
    assert.equal((await read(order)).items[0].manualTrackingHistory.length, 1);
  } finally {
    await release();
  }
});

test("removing a barcode frees only its unit and keeps existing manual statuses", async () => {
  const order = await seed(2);
  const barcode = await track(order, { status: "DELIVERED" });
  await save(order, rows(1, 0));
  assert.equal((await read(order)).fulfillmentStatus, "DELIVERED");
  assert.equal((await route.DELETE(request({ trackingItemId: String(barcode._id) }), params(order))).status, 200);
  const fresh = await read(order);
  assert.equal(fresh.fulfillmentStatus, "PROCESSING");
  assert.deepEqual(asJson(fresh.items[0].manualTracking), rows(1, 0));
  const result = await route.GET(null, params(order));
  assert.equal(result.body.itemsWithTracking[0].remainingCount, 1);
  assert.equal((await Tracking.findById(barcode._id)).tenadorOrderId, null);
});

test("manual edits never change warehouse status, ownership or history", async () => {
  const order = await seed(3);
  const barcode = await track(order);
  const before = asJson(await Tracking.findById(barcode._id).lean());
  await save(order, rows(1, 1));
  await save(order, rows(2, 0), { revision: 1 });
  assert.deepEqual(asJson(await Tracking.findById(barcode._id).lean()), before);
});

test("legacy purchase, scan and detach paths remain available without manual allocations", async () => {
  const order = await seed(2);
  assert.equal((await route.POST(request({ action: "mark_purchase", orderItemIndex: 0 }), params(order))).status, 200);
  const barcode = await track(order, { assigned: false });
  assert.equal((await route.POST(request({ barcode: barcode.barcode, orderItemIndex: 0, procurementStatus: "PURCHASED" }), params(order))).status, 200);
  const fresh = await read(order);
  assert.equal(fresh.manualTrackingEnabled, false);
  assert.equal(fresh.items[0].procurementStatus, "PURCHASED");
  assert.equal(fresh.fulfillmentStatus, "PROCESSING");
  assert.equal((await route.DELETE(request({ trackingItemId: String(barcode._id) }), params(order))).status, 200);
});

test("quantity guard includes physical flow selections and their warehouse allocations", async () => {
  const order = await seed(3);
  order.items[0].flowSelections.push({ nodeId: "extra", nodeType: "category", selectedProduct: order.items[0].product });
  await order.save();
  await track(order, { node: "extra" });
  await save(order, rows(2, 0), { flowNodeId: "extra" });
  const response = await itemsRoute.PATCH(request({ itemId: String(order.items[0]._id), quantity: 2 }), params(order));
  assert.equal(response.status, 409);
  assert.equal((await read(order)).items[0].quantity, 3);
});

test("deleting an earlier item cannot shift warehouse tracking onto the wrong product", async () => {
  const order = await seed(1);
  order.items.push({ product: order.items[0].product, quantity: 1, unitPrice: 1000 });
  await order.save();
  await save(order, rows(1, 0));
  const barcode = await track(order, { index: 1 });
  const remove = () => itemsRoute.DELETE(request({ itemId: String(order.items[0]._id) }), params(order));
  assert.equal((await remove()).status, 409);
  assert.equal((await read(order)).items.length, 2);
  await route.DELETE(request({ trackingItemId: String(barcode._id) }), params(order));
  assert.equal((await remove()).status, 200);
  assert.equal((await read(order)).items.length, 1);
});

test("reducing order quantity below allocations is rejected; valid quantity changes preserve statuses", async () => {
  const order = await seed();
  await save(order);
  const update = (quantity) => itemsRoute.PATCH(request({ itemId: String(order.items[0]._id), quantity }), params(order));
  assert.equal((await update(6)).status, 409);
  assert.equal((await read(order)).items[0].quantity, 9);
  assert.equal((await update(7)).status, 200);
  assert.deepEqual(asJson((await read(order)).items[0].manualTracking), rows());
});

test("used products support manual status only for the unit without a warehouse tracking", async () => {
  const order = await seed(1);
  const used = await mongoose.models.UsedProduct.create({ name: "دست دوم" });
  order.items[0].itemType = "used_product";
  order.items[0].usedProduct = used._id;
  await order.save();
  assert.equal((await save(order, rows(1, 0))).status, 200);
  await save(order, [], { revision: 1 });
  await UsedTracking.create({ usedProductRef: String(used._id), trackingId: "used-code", barcode: "used-barcode", status: "IN_TRANSIT", productSnapshot: { name: "used" } });
  assert.equal((await save(order, rows(1, 0), { revision: 2 })).status, 400);
});

for (const value of [null, {}, [{ status: "INVALID", quantity: 1 }], [{ status: "DELIVERED", quantity: -1 }], [{ status: "DELIVERED", quantity: 1.5 }], [{ status: "DELIVERED", quantity: "2" }], rows(5, 5), [{ status: "DELIVERED", quantity: 1 }, { status: "DELIVERED", quantity: 1 }]]) {
  test(`invalid manual payload is rejected: ${JSON.stringify(value)}`, async () => {
    const order = await seed();
    assert.equal((await save(order, value)).status, 400);
    assert.equal((await read(order)).manualTrackingEnabled, false);
    // A validation failure must release the lock.
    assert.equal((await save(order)).status, 200);
  });
}

test("canceled orders, invalid indices and service nodes cannot be manually changed", async () => {
  const order = await seed();
  assert.equal((await save(order, [], { orderItemIndex: 0.5 })).status, 400);
  assert.equal((await save(order, [], { orderItemIndex: "0" })).status, 400);
  assert.equal((await save(order, [], { flowNodeId: "missing" })).status, 400);
  await Order.updateOne({ _id: order._id }, { $set: { fulfillmentStatus: "CANCELED" } });
  assert.equal((await save(order)).status, 400);
  assert.equal((await read(order)).fulfillmentStatus, "CANCELED");
});

test("warehouse failures never save unchecked counts and the lock is released", async () => {
  const order = await seed();
  warehouseError = true;
  assert.equal((await save(order)).status, 500);
  assert.equal((await read(order)).manualTrackingEnabled, false);
  warehouseError = false;
  assert.equal((await save(order)).status, 200);
});

for (const status of [401, 403]) test(`permission denial (${status}) happens before parsing a request`, async () => {
  denied = { status };
  const req = { json: () => { throw new Error("must not parse"); } };
  assert.equal(await route.POST(req, {}), denied);
  assert.equal(await route.DELETE(req, {}), denied);
  assert.equal(await route.GET(req, {}), denied);
});
