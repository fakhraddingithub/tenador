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

let server, route, eurRoute, perms, events;

async function load(path, deps) {
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
  const mod = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), "utf8"), { context });
  await mod.link(dependency);
  await mod.evaluate();
  return mod.namespace;
}

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(server.getUri(), { dbName: "installment-check-eur" });
  await Promise.all([Order, Payment, Installment].map((m) => m.createCollection()));

  const userId = String(new mongoose.Types.ObjectId());
  const deps = {
    mongoose: { default: mongoose },
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/models/Installment.js": { default: Installment },
    "base/models/Payment.js": { default: Payment },
    "base/models/Order.js": { default: Order },
    "base/models/Payment": { default: Payment },
    "base/models/Order": { default: Order },
    "base/models/User.js": { default: mongoose.models.User },
    "base/services/orderEurRecalc": eurRecalc,
    "base/services/coachWallet.service": {
      grantAutomaticCoachCredit: async () => { events.push("grant"); },
      reverseAutomaticCoachCredit: async () => { events.push("reverse"); },
    },
    "@/lib/emailService": {
      sendInstallmentCheckClearedEmail: async () => { events.push("mail:cleared"); },
      sendInstallmentCompletedEmail: async () => { events.push("mail:completed"); },
    },
    "@/lib/requireAdminPermission": { default: async (key) => {
      assert.ok(["installments.edit", "orders.setCurrency"].includes(key), key);
      if (!perms.includes(key)) return { denied: { status: 403 } };
      return { denied: null, actor: { userId }, ctx: { userId, can: (k) => perms.includes(k) } };
    } },
  };
  route = await load("../src/app/api/installments/checks/[checkId]/status/route.js", deps);
  eurRoute = await load("../src/app/api/admin/orders/[orderId]/eur/route.js", deps);
}, { timeout: 180000 });

beforeEach(async () => {
  perms = ["installments.edit", "orders.setCurrency"];
  events = [];
  await Promise.all([Order, Payment, Installment, mongoose.models.User].map((m) => m.deleteMany({})));
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

async function seed({ priceEUR = 300 } = {}) {
  const user = await mongoose.models.User.create({ email: "buyer@example.com" });
  const order = await Order.create({
    user: user._id, subtotalPrice: 3000, totalPrice: 3000,
    paymentMethod: "INSTALLMENT", priceEUR, paymentsEUR: [{ amount: 60, note: "پیش‌پرداخت" }],
  });
  const down = await Payment.create({ order: order._id, method: "BANK_RECEIPT", amount: 600, status: "PAID" });
  const inst = await Installment.create({
    order: order._id, downPayment: down._id, totalAmount: 3000, numberOfChecks: 2,
    checks: [
      { amount: 1200, dueDate: new Date("2026-12-01"), checkNumber: "111" },
      { amount: 1200, dueDate: new Date("2027-01-01") },
    ],
  });
  return { order, down, checks: inst.checks.map((c) => String(c._id)) };
}

const patch = (checkId, body) =>
  route.PATCH({ json: async () => body }, { params: Promise.resolve({ checkId }) });
const postEur = (orderId, body) =>
  eurRoute.POST({ json: async () => body }, { params: Promise.resolve({ orderId: String(orderId) }) });
const linked = async (orderId, field) =>
  eurRecalc.eurPaidByLink((await Order.findById(orderId).lean()).paymentsEUR, field);

test("یوروی چکِ پاس‌شده بعداً ثبت/ویرایش (با تاریخچه) و با ۰ حذف می‌شود، بدون ایمیلِ دوباره", async () => {
  const { order, checks } = await seed({ priceEUR: null }); // پاس‌شدن بدون یورو، مثل چک‌های قدیمی
  await patch(checks[0], { status: "CLEARED" });
  await patch(checks[1], { status: "CLEARED" });
  assert.deepEqual(events.filter((e) => e.startsWith("mail")), ["mail:cleared", "mail:completed"]);
  events = [];

  assert.equal((await patch(checks[0], { amountEUR: 100 })).status, 200);
  assert.deepEqual(await linked(order._id, "installmentCheck"), { [checks[0]]: 100 });
  assert.equal((await patch(checks[0], { amountEUR: 110 })).status, 200);
  const row = (await Order.findById(order._id).lean()).paymentsEUR.find((p) => p.installmentCheck);
  assert.equal(row.amount, 110);
  assert.deepEqual(row.editHistory.map((h) => [h.oldAmount, h.newAmount]), [[100, 110]]);
  assert.equal((await patch(checks[0], { notes: "یادداشت" })).status, 200);
  assert.deepEqual(events, [], "ویرایشِ اقساطِ تکمیل‌شده ایمیل نمی‌فرستد");

  assert.equal((await patch(checks[0], { amountEUR: 0 })).status, 200);
  assert.deepEqual(await linked(order._id, "installmentCheck"), {});
  assert.equal((await Order.findById(order._id).lean()).paymentsEUR.length, 1, "ردیفِ دستیِ قبلی می‌ماند");
});

test("یورو برای چکِ پاس‌نشده ۴۰۰ است", async () => {
  const { checks } = await seed();
  assert.equal((await patch(checks[0], { amountEUR: 10 })).status, 400);
});

test("برگرداندنِ چکِ پاس‌شده: یورویش حذف، سفارش از PAID به پرداخت ناقص، کردیتِ مربی برگشت؛ پاسِ دوباره همه را برمی‌گرداند", async () => {
  const { order, checks } = await seed();
  await patch(checks[0], { status: "CLEARED", amountEUR: 120 });
  await patch(checks[1], { status: "CLEARED", amountEUR: 120 });
  assert.equal((await Order.findById(order._id).lean()).paymentStatus, "PAID");
  events = [];

  const res = await patch(checks[1], { status: "BOUNCED", bounceReason: "کسر موجودی" });
  assert.equal(res.status, 200);
  assert.equal(res.body.installmentStatus, "DEFAULTED");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.paymentStatus, "PARTIALLY_PAID");
  assert.equal(saved.coachCreditProcessedAt, null);
  assert.deepEqual(eurRecalc.eurPaidByLink(saved.paymentsEUR, "installmentCheck"), { [checks[0]]: 120 });
  const inst = await Installment.findOne({ order: order._id }).lean();
  assert.equal(inst.checks[1].paidAt, undefined);
  assert.deepEqual(events, ["reverse"]);

  // برگشت‌خورده دوباره پاس می‌شود → PAID و یوروی تازه
  assert.equal((await patch(checks[1], { status: "CLEARED", amountEUR: 130 })).status, 200);
  const again = await Order.findById(order._id).lean();
  assert.equal(again.paymentStatus, "PAID");
  assert.deepEqual(eurRecalc.eurPaidByLink(again.paymentsEUR, "installmentCheck"), { [checks[0]]: 120, [checks[1]]: 130 });
});

test("یوروی رسید: POST /eur با payment ثبت/ویرایش/حذف می‌کند و رسیدِ سفارشِ دیگر را نمی‌پذیرد", async () => {
  const { order, down } = await seed();
  assert.equal((await postEur(order._id, { payment: String(down._id), amount: 50 })).status, 200);
  assert.equal((await postEur(order._id, { payment: String(down._id), amount: 55 })).status, 200);
  assert.deepEqual(await linked(order._id, "payment"), { [String(down._id)]: 55 });
  const res = await postEur(order._id, { payment: String(down._id), amount: 0 });
  assert.equal(res.status, 200);
  assert.equal(res.body.totalPaidEUR, 60, "فقط ردیفِ دستی می‌ماند");

  const other = await seed();
  assert.equal((await postEur(order._id, { payment: String(other.down._id), amount: 5 })).status, 404);
  assert.equal((await postEur(order._id, { payment: String(down._id), amount: -1 })).status, 400);
  // POSTِ معمولی (بدون payment) همان رفتارِ قبلی: افزودن
  assert.equal((await postEur(order._id, { amount: 7 })).status, 200);
  assert.equal((await Order.findById(order._id).lean()).paymentsEUR.length, 2);
});

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
  assert.deepEqual(eurRecalc.eurSummary(saved), { priceEUR: 300, paidEUR: 180, remainingEUR: 120, unlinkedCount: 1 });
});

test("چکِ آخر: هم paymentStatus=PAID و هم ردیفِ یورو در یک تراکنش می‌مانند", async () => {
  const { order, checks } = await seed();
  await patch(checks[0], { status: "CLEARED", amountEUR: 120 });
  const res = await patch(checks[1], { status: "CLEARED", amountEUR: 120 });
  assert.equal(res.status, 200);
  assert.equal(res.body.installmentStatus, "COMPLETED");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.paymentStatus, "PAID");
  assert.deepEqual(eurRecalc.eurPaidByLink(saved.paymentsEUR, "installmentCheck"), { [checks[0]]: 120, [checks[1]]: 120 });
  assert.equal(eurRecalc.eurSummary(saved).remainingEUR, 0);
});

test("۰ یورو مجاز است و ردیفی ثبت نمی‌کند؛ سفارشِ بدون مبلغ کلِ یورو یورو را اختیاری می‌کند", async () => {
  const a = await seed();
  assert.equal((await patch(a.checks[0], { status: "CLEARED", amountEUR: 0 })).status, 200);
  assert.equal((await Order.findById(a.order._id).lean()).paymentsEUR.length, 1);

  await Promise.all([Order, Payment, Installment, mongoose.models.User].map((m) => m.deleteMany({})));
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
