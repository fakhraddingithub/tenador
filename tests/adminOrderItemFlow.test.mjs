// Isolated replica set: real order persistence, transactions, pricing and flow
// validation. No project database, network pricing or notifications are used.
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import * as traversal from "../src/lib/flowTraversal.js";
import * as conditions from "../src/lib/flowConditions.js";
import * as serviceConfig from "../src/lib/serviceConfig.js";
import * as eur from "../services/orderEurRecalc.js";
import * as discountWindow from "../utils/discountWindow.js";
import * as discountMatch from "../utils/discountMatch.js";

for (const name of ["Product", "Variant", "UsedProduct", "Category", "Brand", "Serie", "User", "DiscountRule", "FlashSale", "Coupon", "QuantityDiscount"]) {
  const fields = name === "Variant" ? { productId: mongoose.Schema.Types.ObjectId }
    : name === "Product" ? Object.fromEntries(["category", "brand", "serie"].map((key) => [key, { type: mongoose.Schema.Types.ObjectId, ref: key[0].toUpperCase() + key.slice(1) }])) : {};
  mongoose.model(name, new mongoose.Schema(fields, { strict: false }));
}
const { default: Order } = await import("../models/Order.js");
const { default: OrderFlow } = await import("../models/OrderFlow.js");
const oid = () => new mongoose.Types.ObjectId();
const actor = oid();
let server, route, optionsRoute, flowHelpers, denied, pricingFailure;
const plain = (value) => JSON.parse(JSON.stringify(value));

async function load(path, deps) {
  const context = vm.createContext({ console, Date, URL });
  const modules = new Map();
  const dependency = async (name) => {
    if (modules.has(name)) return modules.get(name);
    if (!deps[name]) throw new Error(`Missing dependency: ${name}`);
    const dependencyModule = new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
    }, { context });
    modules.set(name, dependencyModule);
    await dependencyModule.link(() => {});
    await dependencyModule.evaluate();
    return dependencyModule;
  };
  const sourceModule = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), "utf8"), { context, importModuleDynamically: dependency });
  await sourceModule.link(dependency);
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(server.getUri(), { dbName: "admin-item-flow" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.createCollection()));
  const deps = {
    mongoose: { default: mongoose },
    "node:crypto": await import("node:crypto"),
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "@/lib/requireAdminPermission": { default: async (permission) => {
      assert.equal(permission, "orders.editItems");
      return { denied, actor: { userId: String(actor) } };
    } },
    "@/lib/flowTraversal": traversal,
    "@/lib/flowConditions": conditions,
    "@/lib/serviceConfig": serviceConfig,
    "base/utils/discountWindow": discountWindow,
    "base/utils/discountMatch": discountMatch,
    "@/lib/Exchangerate": { getCachedRate: async () => 1000, eurToToman: (price, rate) => price * rate },
    "base/services/coachCreditCalculation": { computeCoachCredit() {} },
    "base/services/walletOrder.service": { refundOrderWallet: async () => 0 },
    "base/services/coachWallet.service": { grantAutomaticCoachCredit: async () => {} },
    "base/models/Payment": { default: { find: () => ({ session: () => ({ lean: async () => [] }) }) } },
    "@/lib/variantImages": { buildVariantSnapshot: (variant) => Object.entries(variant.attributes || {}).map(([name, value]) => ({ name, value })) },
    "@/lib/manualTracking": await import("../src/lib/manualTracking.js"),
    "@/lib/warehouseDb": { connectWarehouseDB() { throw new Error("warehouse must not be used"); }, getItemTrackingModel() {} },
    "@/lib/productSearch": { rankProducts: (_, products) => products, withProductSearch: async (_, query) => ({ name: query }) },
  };
  for (const [name, model] of Object.entries(mongoose.models)) deps[`base/models/${name}`] = { default: model };
  flowHelpers = await load("../services/adminOrderItemFlow.js", deps);
  deps["base/services/adminOrderItemFlow"] = flowHelpers;
  deps["base/services/orderTrackingMutation"] = await load("../services/orderTrackingMutation.js", deps);
  deps["base/services/orderRecalc"] = await load("../services/orderRecalc.js", deps);
  deps["base/services/orderEurRecalc"] = eur;
  const engine = await load("../services/priceEngine.js", deps);
  deps["base/services/priceEngine"] = { computeCartPrice: (...args) => pricingFailure ? Promise.resolve({ flowConfigErrors: ["پیکربندی تغییر کرده است"] }) : engine.computeCartPrice(...args) };
  route = await load("../src/app/api/admin/orders/[orderId]/items/route.js", deps);
  optionsRoute = await load("../src/app/api/admin/orders/item-options/route.js", deps);
}, { timeout: 180000 });

beforeEach(async () => {
  denied = null;
  pricingFailure = false;
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

async function seed({ required = true } = {}) {
  const category = await mongoose.models.Category.create({ title: "راکت" });
  const addonCategory = await mongoose.models.Category.create({ title: "زه" });
  const product = await mongoose.models.Product.create({ name: "راکت", basePrice: 100, category: category._id });
  const addon = await mongoose.models.Product.create({ name: "زه", basePrice: 10, category: addonCategory._id });
  const variant = await mongoose.models.Variant.create({ productId: addon._id, price: 12, attributes: { size: "125" } });
  const flow = await OrderFlow.create({ name: "فرایند", title: "فرایند", rootCategory: category._id, isActive: true, nodes: [
    { id: "strings", type: "category", label: "زه", categoryId: addonCategory._id, required },
    { id: "service", type: "service", label: "زه‌کشی", serviceName: "زه‌کشی", required: true, servicePrice: 2000,
      visibleWhen: { conditions: [{ type: "answered", nodeId: "strings" }] },
      options: [{ key: "tension", title: "تنش", inputType: "range", range: { min: 20, max: 30, step: 1, defaultValue: 25, basePrice: 100, pricePerStep: 10, unit: "kg" } }],
    },
  ] });
  const order = await Order.create({ user: oid(), items: [{ product: product._id, quantity: 1, unitPrice: 9000, priceEUR: 9 }],
    totalPrice: 9000, subtotalPrice: 9000, paymentMethod: "BANK_RECEIPT", priceEUR: 9, paymentsEUR: [{ amount: 3 }] });
  const selections = [
    { nodeId: "strings", nodeType: "category", selectedProductId: String(addon._id), selectedVariantId: String(variant._id), selectedVariantLabel: "forged", addonToman: 1 },
    { nodeId: "service", nodeType: "service", serviceConfig: [{ optionKey: "tension", value: 26, priceModifier: 1, title: "forged" }] },
  ];
  return { product, addon, variant, category, flow, order, selections };
}
const post = (data, overrides = {}) => route.POST({ json: async () => ({ productId: String(data.product._id), quantity: 2, flowSelections: data.selections, ...overrides }) }, { params: Promise.resolve({ orderId: String(data.order._id) }) });

test("persists server-priced flow snapshots, quantity totals and existing EUR/payment data", async () => {
  const data = await seed();
  const previous = plain(await Order.findById(data.order._id).lean());
  const response = await post(data);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const saved = await Order.findById(data.order._id).lean();
  assert.equal(saved.items.length, 2);
  assert.deepEqual(plain(saved.items[0]), previous.items[0]);
  const item = saved.items[1];
  assert.equal(item.unitPrice, 114160); // 100000 + 12000 + 2000 + 160
  assert.equal(item.basePriceToman, 114160);
  assert.equal(saved.totalPrice, 9000 + 2 * 114160);
  assert.equal(item.flowSelections[0].selectedProductName, "زه");
  assert.equal(item.flowSelections[0].selectedVariantLabel, "size: 125");
  assert.equal(String(item.flowSelections[0].selectedVariant), String(data.variant._id));
  assert.equal(item.flowSelections[1].serviceConfig.find((option) => option.optionKey === "tension").title, "تنش");
  assert.equal(item.flowSelections[1].addonToman, 2160);
  assert.equal(saved.priceEUR, 9);
  assert.deepEqual(plain(saved.paymentsEUR), previous.paymentsEUR);
  await OrderFlow.updateOne({ _id: data.flow._id }, { $set: { "nodes.1.servicePrice": 99000 } });
  assert.equal((await Order.findById(data.order._id)).items[1].unitPrice, 114160);
});

test("no flow remains a normal item; optional skipped and hidden steps are not charged", async () => {
  const data = await seed({ required: false });
  assert.equal((await post(data, { flowSelections: [data.selections[1]] })).status, 200);
  let saved = await Order.findById(data.order._id);
  assert.equal(saved.items[1].unitPrice, 100000);
  assert.equal(saved.items[1].flowSelections.length, 0);
  await OrderFlow.deleteMany({});
  assert.equal((await post(data, { flowSelections: [] })).status, 200);
  saved = await Order.findById(data.order._id);
  assert.equal(saved.items[2].flowSelections.length, 0);
});

test("required services without a submitted row still get their server defaults and fee", async () => {
  const data = await seed();
  assert.equal((await post(data, { flowSelections: [data.selections[0]] })).status, 200);
  const item = (await Order.findById(data.order._id)).items[1];
  assert.equal(item.unitPrice, 114150);
  assert.equal(item.flowSelections[1].serviceConfig.find((option) => option.optionKey === "tension").value, 25);
});

test("buyer-specific discounts apply to the main item without discounting flow additions again", async () => {
  const data = await seed();
  await mongoose.models.User.create({ _id: data.order.user, role: "coach", level: 2 });
  await mongoose.models.DiscountRule.create({ active: true, type: "userRole", targetRoles: ["coach"], discount: { kind: "percent", value: 10 } });
  const response = await post(data);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const saved = await Order.findById(data.order._id);
  assert.equal(saved.items[1].unitPrice, 104160);
  assert.equal(saved.items[1].unitDiscount, 10000);
  assert.equal(saved.items[1].basePriceToman, 114160);
  assert.equal(saved.discountAmount, 20000);
  assert.equal(saved.totalPrice, 9000 + 2 * 104160);
});

test("invalid required/category/variant/service selections never change the order", async () => {
  const data = await seed();
  const invalid = [
    [], null, {},
    [...data.selections, data.selections[0]],
    [{ ...data.selections[0], nodeType: "service" }],
    [{ ...data.selections[0], nodeId: "deleted" }],
    [{ ...data.selections[0], selectedProductId: String(data.product._id) }],
    [{ ...data.selections[0], selectedProductId: "bad-id" }],
    [{ ...data.selections[0], selectedProductId: String(oid()) }],
    [{ ...data.selections[0], selectedVariantId: null }],
    [{ ...data.selections[0], selectedVariantId: String(oid()) }],
    [data.selections[0], { ...data.selections[1], serviceConfig: [{ optionKey: "tension", value: 999 }] }],
  ];
  for (const flowSelections of invalid) {
    const response = await post(data, { flowSelections });
    assert.equal(response.status, 400, JSON.stringify({ flowSelections, response }));
    assert.equal((await Order.findById(data.order._id)).items.length, 1);
  }
});

test("a flow category that disables variant selection accepts its product base price", async () => {
  const data = await seed();
  await OrderFlow.updateOne({ _id: data.flow._id }, { $set: { "nodes.0.allowVariantSelection": false } });
  const response = await post(data, { flowSelections: [{ ...data.selections[0], selectedVariantId: null }, data.selections[1]] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const item = (await Order.findById(data.order._id)).items[1];
  assert.equal(item.unitPrice, 112160);
  assert.equal(item.flowSelections[0].selectedVariant, null);
});

test("main variant is required and must belong to the main product; quantity must be integral", async () => {
  const data = await seed();
  const main = await mongoose.models.Variant.create({ productId: data.product._id, price: 110, attributes: { grip: "L2" } });
  assert.equal((await post(data)).status, 400);
  assert.equal((await post(data, { variantId: String(data.variant._id) })).status, 400);
  assert.equal((await post(data, { variantId: String(main._id), quantity: 1.5 })).status, 400);
  assert.equal((await post(data, { variantId: String(main._id) })).status, 200);
  assert.equal((await Order.findById(data.order._id)).items[1].unitPrice, 124160);
});

test("pricing errors and denied permissions do not persist an item", async () => {
  const data = await seed();
  pricingFailure = true;
  assert.equal((await post(data)).status, 400);
  denied = { status: 403 };
  assert.equal((await post(data)).status, 403);
  assert.equal((await optionsRoute.GET({ url: `http://test/api?productId=${data.product._id}` })).status, 403);
  assert.equal((await Order.findById(data.order._id)).items.length, 1);
});

test("order item options returns variants and only the active flow using the order permission", async () => {
  const data = await seed();
  const result = await optionsRoute.GET({ url: `http://test/api?productId=${data.product._id}` });
  assert.equal(result.status, 200);
  assert.equal(String(result.body.flow._id), String(data.flow._id));
  assert.equal(result.body.flow.nodes[0].categoryId.title, "زه");
  assert.deepEqual(plain(result.body.items), []);
  await OrderFlow.updateOne({ _id: data.flow._id }, { isActive: false });
  assert.equal((await optionsRoute.GET({ url: `http://test/api?productId=${data.product._id}` })).body.flow, null);
  assert.equal((await optionsRoute.GET({ url: "http://test/api?productId=bad-id" })).status, 400);
  assert.equal((await optionsRoute.GET({ url: `http://test/api?productId=${oid()}` })).status, 404);
});
