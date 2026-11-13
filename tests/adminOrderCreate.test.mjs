// Admin "create order for a customer": the real admin route → the real placeOrder
// service (the one the customer checkout uses) → real Order/Payment/Installment/Address
// schemas and the real price engine, on an isolated replica set.
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import * as traversal from "../src/lib/flowTraversal.js";
import * as conditions from "../src/lib/flowConditions.js";
import * as serviceConfig from "../src/lib/serviceConfig.js";
import * as discountWindow from "../utils/discountWindow.js";
import * as discountMatch from "../utils/discountMatch.js";
import * as installmentFinance from "../src/lib/installmentFinance.js";
import * as addressForm from "../src/lib/addressForm.mjs";

for (const name of ["Product", "Variant", "UsedProduct", "Category", "Brand", "Serie", "User", "DiscountRule", "FlashSale", "Coupon", "QuantityDiscount"]) {
  const fields = name === "Variant" ? { productId: mongoose.Schema.Types.ObjectId }
    : name === "Product" ? Object.fromEntries(["category", "brand", "serie"].map((key) => [key, { type: mongoose.Schema.Types.ObjectId, ref: key[0].toUpperCase() + key.slice(1) }])) : {};
  mongoose.model(name, new mongoose.Schema(fields, { strict: false }));
}
const { default: Order } = await import("../models/Order.js");
await import("../models/OrderFlow.js");
const { default: Payment } = await import("../models/Payment.js");
const { default: Installment } = await import("../models/Installment.js");
const { default: Address } = await import("../models/Address.js");
const { Product, Variant, Category, User } = mongoose.models;

let server, route, placeOrder, denied, sideEffects;

async function load(path, deps) {
  const context = vm.createContext({ console: { ...console, error() {}, warn() {} }, Date, URL });
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
  await mongoose.connect(server.getUri(), { dbName: "admin-order-create" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.createCollection()));
  const walletMustNotRun = () => { throw new Error("wallet path must not run for admin-created orders"); };
  const deps = {
    mongoose: { default: mongoose },
    "node:crypto": await import("node:crypto"),
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "@/lib/requireAdminPermission": { default: async (permission) => {
      assert.equal(permission, "orders.create");
      return { denied, actor: { userId: "admin" } };
    } },
    "@/lib/adminAuditScope": { markAuditHandled() { sideEffects.push("audit-suppressed"); } },
    "@/lib/flowTraversal": traversal,
    "@/lib/flowConditions": conditions,
    "@/lib/serviceConfig": serviceConfig,
    "base/utils/discountWindow": discountWindow,
    "base/utils/discountMatch": discountMatch,
    "@/lib/Exchangerate": { getCachedRate: async () => 1000, eurToToman: (price, rate) => price * rate },
    "@/lib/variantImages": { buildVariantSnapshot: (variant) => Object.entries(variant.attributes || {}).map(([name, value]) => ({ name, value })) },
    "@/lib/installmentRateService": { getMonthlyInstallmentRate: async () => 4 },
    "@/lib/installmentFinance": installmentFinance,
    "@/lib/addressForm.mjs": addressForm,
    "@/lib/usedTrackingAuto": { autoAssignUsedProductTracking: async () => {} },
    "@/lib/emailService": { sendOrderConfirmationEmail: async (order, email, installment) => {
      sideEffects.push(["email", String(order._id), email, installment?.numberOfChecks ?? null]);
    } },
    "base/services/notificationService": {
      notifyNewOrder: async (order) => { sideEffects.push(["notify", String(order._id)]); },
      notifyCoachStudentOrder: async () => {},
    },
    "base/services/coachCreditCalculation": { computeCoachCredit() {} },
    "base/services/walletOrder.service": {
      validateWalletAmount() {}, walletCheckoutIdentity: walletMustNotRun,
      findWalletCheckout: walletMustNotRun, createWalletOrder: walletMustNotRun,
    },
  };
  for (const [name, model] of Object.entries(mongoose.models)) deps[`base/models/${name}`] = { default: model };
  deps["base/services/adminOrderItemFlow"] = await load("../services/adminOrderItemFlow.js", deps);
  deps["base/services/priceEngine"] = await load("../services/priceEngine.js", deps);
  const service = await load("../services/placeOrder.js", deps);
  placeOrder = service.placeOrder;
  deps["base/services/placeOrder"] = service;
  route = await load("../src/app/api/admin/orders/route.js", { ...deps, "@/lib/search": { buildSearchFilter: () => ({}) } });
}, { timeout: 180000 });

beforeEach(async () => {
  denied = null;
  sideEffects = [];
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

async function seed() {
  const category = await Category.create({ title: "راکت" });
  const racket = await Product.create({ name: "راکت", basePrice: 100, category: category._id });
  const shoe = await Product.create({ name: "کفش", basePrice: 50, category: category._id });
  const variant = await Variant.create({ productId: shoe._id, price: 60, attributes: { size: "42" } });
  const customer = await User.create({ name: "سارا", phone: "09120000000", email: "sara@example.com", role: "user" });
  const address = await Address.create({ user: customer._id, fullName: "سارا احمدی", phone: "09120000000", city: "تهران", addressLine: "خیابان ولیعصر", postalCode: "1234567890" });
  const body = {
    userId: String(customer._id), addressId: String(address._id), paymentMethod: "BANK_RECEIPT",
    items: [
      { productId: String(racket._id), quantity: 2 },
      { productId: String(shoe._id), variantId: String(variant._id), quantity: 1 },
    ],
  };
  return { racket, shoe, variant, customer, address, body, total: 2 * 100000 + 60000 };
}
const post = (body) => route.POST({ json: async () => body });
const counts = async () => [await Order.countDocuments(), await Payment.countDocuments(), await Installment.countDocuments()];

test("price preview returns the server's prices and writes nothing", async () => {
  const data = await seed();
  const response = await post({ ...data.body, dryRun: true });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(Array.from(response.body.items, (item) => item.unitPrice), [100000, 60000]); // Array.from: the route runs in another realm
  assert.equal(response.body.totalToman, data.total);
  assert.deepEqual(await counts(), [0, 0, 0]);
  assert.deepEqual(sideEffects, ["audit-suppressed"]);
});

test("bank receipt: the order belongs to the customer and looks like one they placed", async () => {
  const data = await seed();
  const response = await post({ ...data.body, expectedTotal: data.total, receiptImageUrls: ["https://ik.example/r.png"], description: " عجله دارم " });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const order = await Order.findById(response.body.orderId).lean();
  assert.equal(String(order.user), String(data.customer._id));
  assert.equal(order.totalPrice, data.total);
  assert.equal(order.paymentMethod, "BANK_RECEIPT");
  assert.equal(order.paymentStatus, "UNPAID");
  assert.equal(order.fulfillmentStatus, "WAITING");
  assert.equal(order.coachCreditEligible, true);
  assert.equal(order.description, "عجله دارم");
  assert.ok(order.trackingCode);
  assert.equal(String(order.address.ref), String(data.address._id));
  assert.equal(order.address.snapshot.addressLine, "خیابان ولیعصر");
  assert.deepEqual(order.items.map((item) => [item.quantity, item.unitPrice]), [[2, 100000], [1, 60000]]);
  assert.equal(String(order.items[1].variant), String(data.variant._id));
  assert.equal(order.items[1].variantSnapshot[0].value, "42");
  const payment = await Payment.findOne({ order: order._id }).lean();
  assert.equal(payment.amount, data.total);
  assert.equal(payment.status, "PENDING");
  assert.deepEqual(payment.bankReceipt.imageUrls, ["https://ik.example/r.png"]);
  assert.deepEqual(order.payments.map(String), [String(payment._id)]);
  // the customer's confirmation email and the panel notification both fire
  assert.deepEqual(sideEffects, [["email", String(order._id), "sara@example.com", null], ["notify", String(order._id)]]);
});

test("bank receipt without a receipt: an unpaid order the customer can pay later, no payment document", async () => {
  const data = await seed();
  const response = await post(data.body);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(await counts(), [1, 0, 0]);
  const order = await Order.findOne().lean();
  assert.equal(order.paymentStatus, "UNPAID");
  assert.deepEqual(order.payments, []);
  assert.equal(sideEffects.length, 2);
});

test("installment: down payment and checks are stored; receipt and check images are optional", async () => {
  const data = await seed();
  const downPaymentAmount = 60000;
  const plan = installmentFinance.computeInstallmentPlan({ principal: data.total - downPaymentAmount, monthlyRatePct: 4, months: 2 });
  const checks = [0, 1].map((i) => ({ amount: plan.grandTotal / 2, dueDate: new Date(2027, i, 1).toISOString(), checkNumber: i ? "777" : null }));
  const installment = { downPaymentAmount, downPaymentReceiptUrls: [], numberOfChecks: 2, checks };
  const response = await post({ ...data.body, paymentMethod: "INSTALLMENT", installment });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const order = await Order.findById(response.body.orderId).lean();
  assert.equal(order.paymentStatus, "PARTIALLY_PAID");
  assert.equal(order.installmentTerms.totalPayable, plan.grandTotal);
  const payment = await Payment.findOne({ order: order._id }).lean();
  assert.equal(payment.amount, downPaymentAmount);
  const doc = await Installment.findOne({ order: order._id }).lean();
  assert.equal(String(doc.downPayment), String(payment._id));
  assert.deepEqual(doc.checks.map((check) => [check.amount, check.checkNumber, check.status]), [[plan.grandTotal / 2, null, "PENDING"], [plan.grandTotal / 2, "777", "PENDING"]]);
  assert.deepEqual(sideEffects[0], ["email", String(order._id), "sara@example.com", 2]);

  // a plan whose checks do not add up is refused whole
  const bad = await post({ ...data.body, paymentMethod: "INSTALLMENT", installment: { ...installment, checks: checks.map((check) => ({ ...check, amount: 1000 })) } });
  assert.equal(bad.status, 400);
  assert.deepEqual(await counts(), [1, 1, 1]);
});

test("installment without a plan is an unpaid installment order", async () => {
  const data = await seed();
  const response = await post({ ...data.body, paymentMethod: "INSTALLMENT" });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(await counts(), [1, 0, 0]);
  assert.equal((await Order.findOne().lean()).paymentMethod, "INSTALLMENT");
});

test("nothing is written for a bad request", async () => {
  const data = await seed();
  const stranger = await Address.create({ user: new mongoose.Types.ObjectId(), fullName: "دیگری", phone: "09120000001", city: "قم", addressLine: "جای دیگر" });
  const cases = [
    [{ ...data.body, addressId: String(stranger._id) }, 404], // another user's address
    [{ ...data.body, expectedTotal: data.total - 1 }, 409], // the price the admin saw is stale
    [{ ...data.body, items: [{ productId: String(data.shoe._id), quantity: 1 }] }, 400], // variant required
    [{ ...data.body, items: [{ productId: String(data.racket._id), variantId: String(data.variant._id), quantity: 1 }] }, 400], // foreign variant
    [{ ...data.body, items: [{ productId: String(data.racket._id), quantity: 0 }] }, 400],
    [{ ...data.body, items: [] }, 400],
    [{ ...data.body, userId: String(new mongoose.Types.ObjectId()) }, 404],
    [{ ...data.body, addressId: undefined }, 400],
    [{ ...data.body, paymentMethod: "ONLINE" }, 400],
    [{ ...data.body, paymentMethod: "WALLET" }, 400],
  ];
  for (const [body, status] of cases) {
    const response = await post(body);
    assert.equal(response.status, status, JSON.stringify([body, response.body]));
  }
  assert.deepEqual(await counts(), [0, 0, 0]);
  assert.deepEqual(sideEffects, []);

  denied = { status: 403 };
  assert.equal((await post(data.body)).status, 403);
});

test("the customer's own checkout keeps its rules: a receipt and a full installment plan stay required", async () => {
  const data = await seed();
  const user = { userId: String(data.customer._id), role: "user" };
  const { userId, ...body } = data.body;
  assert.equal((await placeOrder(user, body)).status, 400);
  assert.equal((await placeOrder(user, { ...body, paymentMethod: "INSTALLMENT" })).status, 400);
  assert.deepEqual(await counts(), [0, 0, 0]);
  assert.equal((await placeOrder(user, { ...body, receiptImageUrls: ["https://ik.example/r.png"] })).status, 201);
  assert.deepEqual(await counts(), [1, 1, 0]);
});
