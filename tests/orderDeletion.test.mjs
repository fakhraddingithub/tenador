/**
 * tests/orderDeletion.test.mjs
 *
 * حذفِ دائمیِ سفارش — روی یک replica setِ واقعی با اسکیماهای واقعی.
 *
 * چرا واقعی: کلِ ادعای این قابلیت «هیچ رکوردِ یتیمی نمی‌ماند» است. با mock،
 * دقیقاً همان چیزی که باید اثبات شود کنار گذاشته می‌شود. اینجا mongod بالا
 * می‌آید، نُه کالکشنِ واقعی پر می‌شوند و بعد از حذف، شمارش می‌شوند.
 *
 * دیتابیسِ انبار اتصالِ دیگری است و در تست بالا نمی‌آید؛ آزادسازیِ بارکد
 * به‌صورت تابع تزریق می‌شود تا هم فراخوانی‌اش اثبات شود و هم اتمی‌بودنِ
 * ترتیبش (شکستِ انبار = هیچ حذفی).
 *
 * اجرا: npm run test:order-deletion
 */

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

const { default: Order } = await import("../models/Order.js");
const { default: Payment } = await import("../models/Payment.js");
const { default: Installment } = await import("../models/Installment.js");
const { default: Notification } = await import("../models/Notification.js");
const { default: Comment } = await import("../models/Comment.js");
const { default: Ticket } = await import("../models/Ticket.js");
const { default: UsedProduct } = await import("../models/UsedProduct.js");
const { default: CoachWalletTransaction } = await import("../models/CoachWalletTransaction.js");
const { default: ReviewCreditTransaction } = await import("../models/ReviewCreditTransaction.js");

const { deleteOrderPermanently } = await import("../services/orderDeletion.js");

const oid = () => new mongoose.Types.ObjectId();

let replSet;

const MODELS = [
  Order, Payment, Installment, Notification, Comment,
  Ticket, UsedProduct, CoachWalletTransaction, ReviewCreditTransaction,
];

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "order-deletion-test" });
  // ⚠️ ساختِ کالکشن‌ها *قبل* از اولین تراکنش. مونگو اجازه‌ی «تغییرِ کاتالوگ»
  // (ساختِ ضمنیِ کالکشن) داخل تراکنش را نمی‌دهد و اولین اجرا با WriteConflict
  // می‌افتد — آرتیفکتِ دیتابیسِ خالیِ تست، نه رفتارِ production که این
  // کالکشن‌ها را از پیش دارد.
  await Promise.all(MODELS.map((m) => m.createCollection()));
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) await c.deleteMany({});
});

/**
 * یک سفارشِ «شلوغ» می‌سازد: هر ارجاعی که در کدبیس به سفارش/پرداخت وجود دارد
 * دست‌کم یک نمونه دارد — به‌علاوه‌ی یک سفارشِ دومِ کاملاً بی‌ربط که هیچ‌کدام
 * از داده‌هایش نباید لمس شود.
 */
async function seed() {
  const user = oid();
  const coach = oid();
  const product = oid();

  const order = await Order.create({
    user,
    items: [{ product, quantity: 1, unitPrice: 1000 }],
    subtotalPrice: 1000,
    totalPrice: 1000,
    paymentMethod: "INSTALLMENT",
  });

  // پرداختِ ۱ — از هر دو طرف دیده می‌شود (حالتِ عادی)
  const linked = await Payment.create({
    order: order._id,
    method: "BANK_RECEIPT",
    amount: 400,
    status: "PAID",
  });
  // پرداختِ ۲ — فقط Payment.order دارد و در order.payments نیست
  const byRefOnly = await Payment.create({
    order: order._id,
    method: "ONLINE",
    amount: 600,
    status: "PENDING",
  });
  // پرداختِ ۳ — فقط در order.payments است و فیلدِ order اش جای دیگری را نشان
  // می‌دهد. داده‌ی واگرا؛ اگر فقط یک طرف پرس‌وجو شود، جا می‌ماند.
  const strayOrder = await Order.create({
    user,
    items: [{ product, quantity: 1, unitPrice: 50 }],
    subtotalPrice: 50,
    totalPrice: 50,
    paymentMethod: "ONLINE",
  });
  const inArrayOnly = await Payment.create({
    order: strayOrder._id,
    method: "ONLINE",
    amount: 10,
    status: "PENDING",
  });
  order.payments = [linked._id, inArrayOnly._id];
  await order.save();

  await Installment.create({
    order: order._id,
    downPayment: linked._id,
    totalAmount: 1000,
    numberOfChecks: 2,
    checks: [
      { amount: 500, dueDate: new Date() },
      { amount: 500, dueDate: new Date() },
    ],
  });

  await Notification.create({
    type: "new_order",
    message: "سفارش جدید",
    order: order._id,
    link: `/p-admin/admin-orders/${order._id}`,
  });
  await Notification.create({
    type: "new_payment",
    message: "پرداخت جدید",
    payment: byRefOnly._id,
    link: `/p-admin/admin-orders/${order._id}`,
  });

  await ReviewCreditTransaction.create({
    order: order._id,
    user,
    comment: oid(),
    granularity: "per-order",
    kind: "amount",
    value: 50000,
    amount: 50000,
  });

  const used = await UsedProduct.create({
    name: "راکت دست دوم",
    baseProduct: product,
    price: 100,
    status: "sold",
    order: order._id,
  });

  const comment = await Comment.create({
    user,
    text: "عالی بود",
    order: order._id,
  });

  const ticket = await Ticket.create({
    user,
    subject: "سؤال درباره سفارش",
    department: "support",
    relatedOrder: order._id,
    relatedPayment: byRefOnly._id,
  });

  const wallet = await CoachWalletTransaction.create({
    coach,
    student: user,
    order: order._id,
    amount: 25000,
    addedBy: oid(),
  });

  // ── کنترلِ ناظر: سفارشِ دومِ کاملاً مستقل ─────────────────────────────
  const other = await Order.create({
    user,
    items: [{ product, quantity: 2, unitPrice: 700 }],
    subtotalPrice: 1400,
    totalPrice: 1400,
    paymentMethod: "ONLINE",
  });
  const otherPayment = await Payment.create({
    order: other._id,
    method: "ONLINE",
    amount: 1400,
    status: "PAID",
  });
  await Notification.create({
    type: "new_order",
    message: "سفارش دیگر",
    order: other._id,
    link: `/p-admin/admin-orders/${other._id}`,
  });

  return {
    order, linked, byRefOnly, inArrayOnly, strayOrder,
    used, comment, ticket, wallet, other, otherPayment,
  };
}

/** آزادسازیِ انبارِ ساختگی — فراخوانی‌هایش ثبت می‌شود. */
function stubTracking(calls) {
  return async (orderId) => {
    calls.push(String(orderId));
    return { itemTracking: 2, usedItemTracking: 1 };
  };
}

test("سفارش و همه‌ی پرداخت‌هایش برای همیشه حذف می‌شوند", async () => {
  const s = await seed();
  const calls = [];

  const summary = await deleteOrderPermanently(s.order._id, stubTracking(calls));

  assert.ok(summary, "خلاصه‌ی حذف برنگشت");
  assert.equal(await Order.countDocuments({ _id: s.order._id }), 0);
  assert.equal(await Payment.countDocuments({ _id: s.linked._id }), 0);
  assert.equal(await Payment.countDocuments({ _id: s.byRefOnly._id }), 0);
  // پرداختی که فقط در order.payments بود هم باید رفته باشد — اجتماعِ دو طرف
  assert.equal(await Payment.countDocuments({ _id: s.inArrayOnly._id }), 0);
  assert.equal(summary.payments, 3);
  assert.equal(summary.trackingCode, s.order.trackingCode);
});

test("هیچ رکوردِ پرداختِ یتیمی باقی نمی‌ماند", async () => {
  const s = await seed();
  await deleteOrderPermanently(s.order._id, stubTracking([]));

  assert.equal(await Payment.countDocuments({ order: s.order._id }), 0);

  // ادعای قوی‌تر: هیچ پرداختی در کلِ کالکشن به سفارشِ ناموجود اشاره نکند.
  const orderIds = new Set((await Order.find().select("_id").lean()).map((o) => String(o._id)));
  const orphans = (await Payment.find().select("order").lean())
    .filter((p) => !orderIds.has(String(p.order)));
  assert.deepEqual(orphans, [], "پرداختِ یتیم پیدا شد");
});

test("ارجاع‌های required حذف و ارجاع‌های اختیاری فقط باز می‌شوند", async () => {
  const s = await seed();
  await deleteOrderPermanently(s.order._id, stubTracking([]));

  // required → حذف
  assert.equal(await Installment.countDocuments({ order: s.order._id }), 0);
  assert.equal(await ReviewCreditTransaction.countDocuments({ order: s.order._id }), 0);
  // اعلانِ سفارش و اعلانِ پرداختِ همان سفارش، هر دو
  assert.equal(await Notification.countDocuments({ order: s.order._id }), 0);
  assert.equal(await Notification.countDocuments({ payment: s.byRefOnly._id }), 0);

  // اختیاری → سند می‌ماند، پیوند باز می‌شود
  const comment = await Comment.findById(s.comment._id).lean();
  assert.ok(comment, "نظر نباید حذف شود");
  assert.equal(comment.order, null);

  const ticket = await Ticket.findById(s.ticket._id).lean();
  assert.ok(ticket, "تیکت نباید حذف شود");
  assert.equal(ticket.relatedOrder, null);
  assert.equal(ticket.relatedPayment, null);

  const wallet = await CoachWalletTransaction.findById(s.wallet._id).lean();
  assert.ok(wallet, "دفترِ کیف پول مربی نباید حذف شود");
  assert.equal(wallet.amount, 25000, "مبلغ نباید تغییر کند");
  assert.equal(wallet.order, null);
});

test("محصول دست دوم آزاد و دوباره قابل فروش می‌شود", async () => {
  const s = await seed();
  await deleteOrderPermanently(s.order._id, stubTracking([]));

  const used = await UsedProduct.findById(s.used._id).lean();
  assert.equal(used.status, "available");
  assert.equal(used.order, null);
});

test("بارکدهای انبار دقیقاً یک بار و برای همین سفارش آزاد می‌شوند", async () => {
  const s = await seed();
  const calls = [];
  const summary = await deleteOrderPermanently(s.order._id, stubTracking(calls));

  assert.deepEqual(calls, [String(s.order._id)]);
  assert.deepEqual(summary.tracking, { itemTracking: 2, usedItemTracking: 1 });
});

test("سفارش‌های دیگر و داده‌هایشان دست‌نخورده می‌مانند", async () => {
  const s = await seed();
  await deleteOrderPermanently(s.order._id, stubTracking([]));

  assert.equal(await Order.countDocuments({ _id: s.other._id }), 1);
  assert.equal(await Payment.countDocuments({ _id: s.otherPayment._id }), 1);
  assert.equal(await Notification.countDocuments({ order: s.other._id }), 1);
  assert.equal(await Order.countDocuments({ _id: s.strayOrder._id }), 1);
});

test("سفارشِ ناموجود null برمی‌گرداند و چیزی را لمس نمی‌کند", async () => {
  const s = await seed();
  const calls = [];

  const summary = await deleteOrderPermanently(oid(), stubTracking(calls));

  assert.equal(summary, null);
  assert.deepEqual(calls, [], "برای سفارشِ ناموجود نباید سراغِ انبار برود");
  assert.equal(await Order.countDocuments({ _id: s.order._id }), 1);
  assert.equal(await Payment.countDocuments({ order: s.order._id }), 2);
});

test("شکستِ آزادسازیِ انبار کلِ حذف را برمی‌گرداند (اتمی)", async () => {
  const s = await seed();
  const boom = async () => { throw new Error("warehouse down"); };

  await assert.rejects(() => deleteOrderPermanently(s.order._id, boom), /warehouse down/);

  // هیچ‌چیز نباید نصفه حذف شده باشد
  assert.equal(await Order.countDocuments({ _id: s.order._id }), 1);
  assert.equal(await Payment.countDocuments({ order: s.order._id }), 2);
  assert.equal(await Installment.countDocuments({ order: s.order._id }), 1);
  const used = await UsedProduct.findById(s.used._id).lean();
  assert.equal(used.status, "sold");
});

/* ── گاردهای سرور: کلیدِ دسترسی و تأییدِ کدِ سفارش ────────────────────── */

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/admin/orders/[orderId]/route.js"),
  "utf8"
);
const deleteHandler = routeSource.slice(routeSource.indexOf("export async function DELETE"));

test("روت DELETE با کلیدِ اختصاصیِ orders.delete گیت شده است", () => {
  assert.match(deleteHandler, /requireAdminPermission\("orders\.delete"\)/);
  // گیت باید اولین کارِ هندلر باشد، پیش از هر خواندنی از دیتابیس
  assert.ok(
    deleteHandler.indexOf("requireAdminPermission") < deleteHandler.indexOf("connectToDB"),
    "گیت باید پیش از اتصال/خواندنِ دیتابیس اجرا شود"
  );
});

test("سرور کدِ سفارش را مستقل و دقیق بررسی می‌کند", () => {
  // تطبیقِ دقیق: نه case-insensitive، نه جزئی
  assert.match(deleteHandler, /confirm !== expected/);
  assert.doesNotMatch(deleteHandler, /toLowerCase|toUpperCase|\.includes\(/);
  assert.ok(
    deleteHandler.indexOf("confirm !== expected") < deleteHandler.indexOf("deleteOrderPermanently"),
    "تأیید باید پیش از حذف بررسی شود"
  );
});

test("کلیدِ orders.delete در رجیستری و در نگاشتِ API ثبت شده است", async () => {
  const { getAllPermissionKeys } = await import("../src/lib/permissions.js");
  const { ADMIN_API_PERMISSIONS } = await import("../src/lib/apiPermissions.js");

  assert.ok(getAllPermissionKeys().includes("orders.delete"));
  assert.equal(ADMIN_API_PERMISSIONS["/admin/orders/[orderId]"].DELETE, "orders.delete");
  // کلیدهای موجود نباید جابه‌جا شده باشند
  assert.equal(ADMIN_API_PERMISSIONS["/admin/orders/[orderId]"].GET, "orders.view");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/orders/[orderId]"].PATCH, "orders.changeStatus");
});

test("هیچ نقشِ موجودی خودبه‌خود کلیدِ حذف را نمی‌گیرد", async () => {
  const { normalizePermissions, hasPermission } = await import("../src/lib/permissions.js");

  // نقشی که همه‌ی کلیدهای قبلیِ سفارشات را دارد
  const legacy = normalizePermissions([
    "orders.view",
    "orders.changeStatus",
    "orders.editItems",
    "orders.adjustDiscount",
    "orders.setCurrency",
    "orders.manageSenders",
  ]);
  assert.equal(hasPermission(legacy, "orders.delete"), false);

  // و گرفتنِ کلیدِ حذف، orders.view را هم با خود می‌آورد (قرارداد وابستگی)
  const withDelete = normalizePermissions(["orders.delete"]);
  assert.equal(hasPermission(withDelete, "orders.delete"), true);
  assert.equal(hasPermission(withDelete, "orders.view"), true);
});

test("منطقه‌ی خطر فقط با کلیدِ حذف رندر می‌شود", () => {
  const ui = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/orders/AdminOrderDetailClient.jsx"),
    "utf8"
  );
  assert.match(ui, /const canDeleteOrder = can\("orders\.delete"\)/);
  // بلوکِ منطقه‌ی خطر باید *داخلِ* شرط باشد، نه فقط دکمه‌اش
  assert.match(ui, /\{canDeleteOrder && \([\s\S]{0,400}منطقه خطر/);
  // و دیالوگ باید ورودیِ تأیید داشته باشد، نه صرفِ دکمه‌ی تأیید
  assert.match(ui, /input: "text"/);
  assert.match(ui, /showValidationMessage/);
});
