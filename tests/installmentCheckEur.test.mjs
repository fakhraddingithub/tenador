// یوروی چک‌های اقساطی: مسیرِ واقعیِ PATCH /api/installments/checks/[checkId]/status
// → اسکیمای واقعیِ Order/Installment/Payment روی replica set (تراکنش واقعی).
// قاعده: هر چکی که پاس می‌شود مبلغ یورویی‌اش را به‌صورت یک ردیفِ paymentsEUR
// (installmentCheck = همان چک) ثبت می‌کند تا از مانده‌ی یوروی سفارش کسر شود.
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import * as eurRecalc from "../services/orderEurRecalc.js";

mongoose.model("User", new mongoose.Schema({}, { strict: false }));
const { default: Order } = await import("../models/Order.js");
const { default: Payment } = await import("../models/Payment.js");
const { default: Installment } = await import("../models/Installment.js");

let server, route, perms;

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(server.getUri(), { dbName: "installment-check-eur" });
  await Promise.all([Order, Payment, Installment].map((m) => m.createCollection()));

  const deps = {
    mongoose: { default: mongoose },
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/models/Installment.js": { default: Installment },
    "base/models/Payment.js": { default: Payment },
    "base/models/Order.js": { default: Order },
    "base/models/User.js": { default: mongoose.models.User },
    "base/services/orderEurRecalc": eurRecalc,
    "base/services/coachWallet.service": { grantAutomaticCoachCredit: async () => {} },
    "@/lib/emailService": { sendInstallmentCheckClearedEmail: async () => {}, sendInstallmentCompletedEmail: async () => {} },
    "@/lib/requireAdminPermission": { default: async (key) => {
      assert.equal(key, "installments.edit");
      const userId = String(new mongoose.Types.ObjectId());
      return { denied: null, ctx: { userId, can: (k) => perms.includes(k) } };
    } },
  };
  const context = vm.createContext({ console: { ...console, error() {} }, Date, URL });
  const dependency = async (name) => {
    if (!deps[name]) throw new Error(`Missing dependency: ${name}`);
    const m = new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [k, v] of Object.entries(deps[name])) this.setExport(k, v);
    }, { context });
    await m.link(() => {});
    await m.evaluate();
    return m;
  };
  const src = await readFile(new URL("../src/app/api/installments/checks/[checkId]/status/route.js", import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(src, { context });
  await mod.link(dependency);
  await mod.evaluate();
  route = mod.namespace;
}, { timeout: 180000 });

beforeEach(async () => {
  perms = ["installments.edit", "orders.setCurrency"];
  await Promise.all([Order, Payment, Installment].map((m) => m.deleteMany({})));
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

async function seed({ priceEUR = 300 } = {}) {
  const order = await Order.create({
    user: new mongoose.Types.ObjectId(), subtotalPrice: 3000, totalPrice: 3000,
    paymentMethod: "INSTALLMENT", priceEUR, paymentsEUR: [{ amount: 60, note: "پیش‌پرداخت" }],
  });
  const down = await Payment.create({ order: order._id, method: "BANK_RECEIPT", amount: 600 });
  const inst = await Installment.create({
    order: order._id, downPayment: down._id, totalAmount: 3000, numberOfChecks: 2,
    checks: [
      { amount: 1200, dueDate: new Date("2026-12-01"), checkNumber: "111" },
      { amount: 1200, dueDate: new Date("2027-01-01") },
    ],
  });
  return { order, checks: inst.checks.map((c) => String(c._id)) };
}

const patch = (checkId, body) =>
  route.PATCH({ json: async () => body }, { params: Promise.resolve({ checkId }) });

test("پاس‌کردنِ چک بدون یورو روی سفارشِ یورویی ۴۰۰ می‌دهد و هیچ چیز را تغییر نمی‌دهد", async () => {
  const { order, checks } = await seed();
  const res = await patch(checks[0], { status: "CLEARED" });
  assert.equal(res.status, 400);
  const inst = await Installment.findOne({ order: order._id }).lean();
  assert.equal(inst.checks[0].status, "PENDING");
  assert.equal((await Order.findById(order._id).lean()).paymentsEUR.length, 1);
});

test("یوروی چک ثبت و از مانده کسر می‌شود؛ پاس‌کردنِ دوباره ردیفِ تکراری نمی‌سازد", async () => {
  const { order, checks } = await seed();
  assert.equal((await patch(checks[0], { status: "CLEARED", amountEUR: 120 })).status, 200);
  assert.equal((await patch(checks[0], { status: "CLEARED", amountEUR: 120 })).status, 200);

  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.paymentsEUR.length, 2);
  const row = saved.paymentsEUR[1];
  assert.equal(row.amount, 120);
  assert.equal(String(row.installmentCheck), checks[0]);
  assert.match(row.note, /قسط 1 — چک 111/);
  assert.deepEqual(eurRecalc.eurSummary(saved), { priceEUR: 300, paidEUR: 180, remainingEUR: 120 });
});

test("چکِ آخر: هم paymentStatus=PAID و هم ردیفِ یورو در یک تراکنش می‌مانند", async () => {
  const { order, checks } = await seed();
  await patch(checks[0], { status: "CLEARED", amountEUR: 120 });
  const res = await patch(checks[1], { status: "CLEARED", amountEUR: 120 });
  assert.equal(res.status, 200);
  assert.equal(res.body.installmentStatus, "COMPLETED");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.paymentStatus, "PAID");
  assert.deepEqual(eurRecalc.eurPaidByCheck(saved.paymentsEUR), { [checks[0]]: 120, [checks[1]]: 120 });
  assert.equal(eurRecalc.eurSummary(saved).remainingEUR, 0);
});

test("۰ یورو مجاز است و ردیفی ثبت نمی‌کند؛ سفارشِ بدون مبلغ کلِ یورو یورو را اختیاری می‌کند", async () => {
  const a = await seed();
  assert.equal((await patch(a.checks[0], { status: "CLEARED", amountEUR: 0 })).status, 200);
  assert.equal((await Order.findById(a.order._id).lean()).paymentsEUR.length, 1);

  await Promise.all([Order, Payment, Installment].map((m) => m.deleteMany({})));
  const b = await seed({ priceEUR: null });
  assert.equal((await patch(b.checks[0], { status: "CLEARED" })).status, 200);
  assert.equal((await Order.findById(b.order._id).lean()).paymentsEUR.length, 1);
});

test("بدون orders.setCurrency: یورو اجباری نیست، ولی فرستادنش ۴۰۳ است", async () => {
  perms = ["installments.edit"];
  const { order, checks } = await seed();
  assert.equal((await patch(checks[0], { status: "CLEARED", amountEUR: 50 })).status, 403);
  assert.equal((await patch(checks[0], { status: "CLEARED" })).status, 200);
  assert.equal((await Order.findById(order._id).lean()).paymentsEUR.length, 1);
});
