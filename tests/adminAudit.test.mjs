/**
 * tests/adminAudit.test.mjs
 *
 * دفترِ فعالیتِ تفصیلی — تستِ سرتاسری روی یک replica setِ واقعی.
 *
 * چرا واقعی و نه mock: کلِ ادعای این سیستم این است که «رکورد از خودِ نوشتنِ
 * دیتابیس ساخته می‌شود، نه از دکمه‌ای که فشرده شد». با mock کردنِ Mongoose
 * دقیقاً همان چیزی که باید اثبات شود کنار گذاشته می‌شود. اینجا mongod بالا
 * می‌آید، مدل‌های *واقعیِ* پروژه بار می‌شوند، و رکوردها از دیتابیس خوانده
 * می‌شوند.
 *
 * ⚠️ ترتیبِ ایمپورت مهم است: auditPlugin باید پیش از هر مدلی بار شود، وگرنه
 * اسکیماها بدونِ هوک کامپایل می‌شوند (همان تله‌ای که در production با
 * src/instrumentation.js بسته شده).
 *
 * اجرا: npm run test:admin-audit
 */

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// اسمِ مستعارِ `base/*` و `@/*` باید پیش از هر ماژولِ اپ ثبت شود، و
// auditPlugin پیش از هر مدل — پس همه‌ی اینها ایمپورتِ پویا هستند.
register("./aliasHooks.mjs", import.meta.url);

await import("../models/auditPlugin.js"); // ← باید پیش از مدل‌ها باشد

const { default: AdminActivity } = await import("../models/AdminActivity.js");
const { default: Order } = await import("../models/Order.js");
const { default: Payment } = await import("../models/Payment.js");
const { default: Product } = await import("../models/Product.js");
const { default: User } = await import("../models/User.js");
const { default: Notification } = await import("../models/Notification.js");

const { withAuditScope, markAuditHandled } = await import("../src/lib/adminAuditScope.js");
const { buildActivityFromScope, flushAuditScope } = await import("../src/lib/adminAuditFlush.js");
const { REDACTED } = await import("../src/lib/auditRedaction.js");
const { ACTIVITY_ACTIONS, activityHeadline } = await import("../src/lib/activityLabels.js");
const { AUDIT_ENTITIES, describeMutation, entityName } = await import("../src/lib/auditEntities.js");

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "audit-test" });
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  // نگهبانِ فقط‌افزودنی متدهای مدل را می‌بندد؛ پاک‌سازیِ تست از خودِ درایور
  // انجام می‌شود تا آن نگهبان دست‌نخورده بماند.
  await AdminActivity.collection.deleteMany({});
});

/** آخرین رکوردِ دفتر. */
const lastRecord = () => AdminActivity.findOne({}).sort({ createdAt: -1 }).lean();

/* ── نمونه‌سازها ────────────────────────────────────────────────────────────
   مدل‌های واقعیِ پروژه اعتبارسنجیِ واقعی دارند؛ نمونه‌ها همه‌ی فیلدهای الزامی
   را پر می‌کنند تا آنچه تست می‌شود خودِ ممیزی باشد، نه ساختنِ سند. */

const oid = () => new mongoose.Types.ObjectId();

let skuCounter = 0;
const makeProduct = (overrides = {}) =>
  Product.create({
    name: "کالای آزمایشی",
    shortDescription: "کوتاه",
    longDescription: "بلند",
    category: oid(),
    sku: `SKU-${++skuCounter}`,
    mainImage: "https://example.test/a.jpg",
    brand: oid(),
    sport: oid(),
    basePrice: 100,
    ...overrides,
  });

const makeOrder = (overrides = {}) =>
  Order.create({
    user: oid(),
    items: [],
    subtotalPrice: 100,
    totalPrice: 100,
    paymentMethod: "BANK_RECEIPT",
    ...overrides,
  });

/* ══════════════════════════════════════════════════════════════════════════
 * ۱. پوشش: بدونِ دامنه هیچ چیزی ثبت نمی‌شود
 * ══════════════════════════════════════════════════════════════════════════ */

test("نوشتنِ بدونِ دامنه‌ی ادمین هیچ رکوردی نمی‌سازد", async () => {
  await makeProduct({ name: "کالای عمومی" });
  assert.equal(await AdminActivity.countDocuments({}), 0);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۲. جزئیاتِ واقعی به‌جای «اقدامِ نوشتنیِ مجاز»
 * ══════════════════════════════════════════════════════════════════════════ */

test("تغییر قیمت محصول → اقدامِ دقیق، نامِ محصول، و قبل/بعد", async () => {
  const product = await makeProduct({ name: "Wilson Blade 100", basePrice: 199 });

  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    const doc = await Product.findById(product._id);
    doc.basePrice = 189;
    await doc.save();
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "product.price.change");
  assert.match(record.description, /Wilson Blade 100/);
  assert.equal(record.resourceType, "Product");
  assert.equal(record.resourceId, String(product._id));
  assert.equal(record.resourceLabel, "Wilson Blade 100");
  assert.deepEqual(record.changes.basePrice, { from: 199, to: 189 });
  assert.equal(record.result, "success");
  // هیچ رکوردِ عمومیِ دومی ساخته نشده است
  assert.equal(await AdminActivity.countDocuments({}), 1);
});

test("ایجاد و حذف محصول، هر کدام اقدامِ خودش", async () => {
  let created;
  await withAuditScope({ permissions: ["products.create"] }, async (scope) => {
    created = await makeProduct({ name: "Babolat Pure Drive", basePrice: 250 });
    await flushAuditScope(scope);
  });

  let record = await lastRecord();
  assert.equal(record.action, "product.create");
  assert.match(record.description, /ایجاد محصول/);
  assert.match(record.description, /Babolat Pure Drive/);

  await AdminActivity.collection.deleteMany({});

  await withAuditScope({ permissions: ["products.delete"] }, async (scope) => {
    await Product.findOneAndDelete({ _id: created._id });
    await flushAuditScope(scope);
  });

  record = await lastRecord();
  assert.equal(record.action, "product.delete");
  assert.match(record.description, /Babolat Pure Drive/);
});

test("مسیرِ کوئری (findOneAndUpdate) هم قبل/بعد می‌دهد", async () => {
  const order = await makeOrder({
    trackingCode: "TR-9001",
    fulfillmentStatus: "PROCESSING",
    totalPrice: 1000,
  });

  await withAuditScope({ permissions: ["orders.edit"] }, async (scope) => {
    await Order.findOneAndUpdate(
      { _id: order._id },
      { $set: { fulfillmentStatus: "SENT" } }
    );
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "order.status.change");
  assert.match(record.description, /TR-9001/);
  assert.deepEqual(record.changes.fulfillmentStatus, { from: "PROCESSING", to: "SENT" });
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۳. یک اقدامِ ادمین = یک ردیف، با موجودیت‌های مرتبط
 * ══════════════════════════════════════════════════════════════════════════ */

test("تأیید پرداخت: یک رکورد، با سفارشِ مرتبط", async () => {
  const order = await makeOrder({
    trackingCode: "TR-5150",
    paymentStatus: "UNPAID",
    totalPrice: 500,
  });
  const payment = await Payment.create({
    order: order._id,
    method: "BANK_RECEIPT",
    amount: 500,
    status: "PENDING",
  });

  await withAuditScope({ permissions: ["payments.approve"] }, async (scope) => {
    const p = await Payment.findById(payment._id);
    p.status = "PAID";
    await p.save();

    const o = await Order.findById(order._id);
    o.paymentStatus = "PAID";
    await o.save();

    await flushAuditScope(scope);
  });

  assert.equal(await AdminActivity.countDocuments({}), 1);
  const record = await lastRecord();

  // پرداخت priority بالاتری دارد، پس تیترِ رکورد «تأیید پرداخت» است و تغییرِ
  // سفارش به‌عنوان موجودیتِ مرتبط می‌آید.
  assert.equal(record.resourceType, "Payment");
  assert.equal(record.action, "payment.approve");
  assert.match(record.description, /TR-5150/);
  assert.equal(record.related.length, 1);
  assert.equal(record.related[0].type, "Order");
  assert.match(record.related[0].description, /TR-5150/);
  assert.equal(record.metadata.mutations, 2);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۴. عملیاتِ شکست‌خورده «موفق» ثبت نمی‌شود
 * ══════════════════════════════════════════════════════════════════════════ */

test("تراکنشِ برگشت‌خورده هیچ رکوردی نمی‌سازد", async () => {
  const order = await makeOrder({
    trackingCode: "TR-ROLLBACK",
    fulfillmentStatus: "PROCESSING",
  });

  await withAuditScope({ permissions: ["orders.edit"] }, async (scope) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const doc = await Order.findById(order._id).session(session);
    doc.fulfillmentStatus = "CANCELED";
    await doc.save({ session });
    await session.abortTransaction();
    await session.endSession();

    // هوکِ post اجرا شده است…
    assert.equal(scope.events.length, 1);
    await flushAuditScope(scope);
  });

  // …ولی چون تراکنش برگشت خورد، رکوردی ساخته نمی‌شود.
  assert.equal(await AdminActivity.countDocuments({ result: "success" }), 0);

  const fresh = await Order.findById(order._id).lean();
  assert.equal(fresh.fulfillmentStatus, "PROCESSING");
});

test("تراکنشِ commit‌شده ثبت می‌شود", async () => {
  const order = await makeOrder({
    trackingCode: "TR-COMMIT",
    fulfillmentStatus: "PROCESSING",
  });

  await withAuditScope({ permissions: ["orders.edit"] }, async (scope) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const doc = await Order.findById(order._id).session(session);
    doc.fulfillmentStatus = "DELIVERED";
    await doc.save({ session });
    await session.commitTransaction();
    await session.endSession();
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "order.status.change");
  assert.deepEqual(record.changes.fulfillmentStatus, {
    from: "PROCESSING",
    to: "DELIVERED",
  });
});

test("درخواستِ مجاز بدونِ هیچ نوشتنی، همان رکوردِ attempted را می‌گیرد", async () => {
  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "authz.granted");
  assert.equal(record.result, "attempted");
  assert.equal(record.description, "");
});

test("ذخیره‌ی بدونِ تغییر رویداد نمی‌سازد", async () => {
  const product = await makeProduct({ name: "بدون تغییر", basePrice: 10 });

  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    const doc = await Product.findById(product._id);
    await doc.save();
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "authz.granted");
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۵. اسرار هرگز وارد دفتر نمی‌شوند
 * ══════════════════════════════════════════════════════════════════════════ */

test("رمز عبور در دفتر ثبت نمی‌شود ولی «عوض شد» ثبت می‌شود", async () => {
  const user = await User.create({
    provider: "local",
    phone: "09120000001",
    password: "hash-اول",
    name: "علی",
    lastName: "رضایی",
  });

  await withAuditScope({ permissions: ["users.edit"] }, async (scope) => {
    const doc = await User.findById(user._id);
    doc.password = "hash-دوم";
    doc.isBanned = true;
    await doc.save();
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "user.ban");
  assert.match(record.description, /علی رضایی/);
  assert.deepEqual(record.changes.password, { from: REDACTED, to: REDACTED });
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes("hash-دوم"), false);
  assert.equal(serialized.includes("hash-اول"), false);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۶. نویز
 * ══════════════════════════════════════════════════════════════════════════ */

test("مدل‌های زیرساخت/اعلان ثبت نمی‌شوند", async () => {
  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    await Notification.create({
      type: "new_order",
      title: "نویز",
      message: "x",
      link: "/p-admin/admin-orders",
    });
    assert.equal(scope.events.length, 0);
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "authz.granted");
});

test("روتی که خودش رکورد می‌نویسد، رکوردِ خودکارِ دوم نمی‌گیرد", async () => {
  const product = await makeProduct({ name: "دستی", basePrice: 5 });

  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    const doc = await Product.findById(product._id);
    doc.basePrice = 6;
    await doc.save();
    markAuditHandled();
    const written = await flushAuditScope(scope);
    assert.equal(written, false);
  });

  assert.equal(await AdminActivity.countDocuments({}), 0);
});

test("عملیاتِ گروهی یک رکوردِ شمارشی می‌سازد", async () => {
  await makeProduct({ name: "گروهی ۱", isActive: false });
  await makeProduct({ name: "گروهی ۲", isActive: false });

  await withAuditScope({ permissions: ["products.edit"] }, async (scope) => {
    await Product.updateMany({ name: /^گروهی/ }, { $set: { isActive: true } });
    await flushAuditScope(scope);
  });

  const record = await lastRecord();
  assert.equal(record.action, "product.updateMany");
  assert.match(record.description, /ویرایش گروهی/);
  assert.equal(record.metadata.affected, 2);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۷. ماندگاریِ ردِ ممیزی پس از حذفِ موجودیت
 * ══════════════════════════════════════════════════════════════════════════ */

test("حذفِ موجودیت، ردِ ممیزی‌اش را از بین نمی‌برد", async () => {
  const product = await makeProduct({ name: "حذف‌شدنی", basePrice: 77, sku: "SKU-DEL" });

  await withAuditScope({ permissions: ["products.delete"] }, async (scope) => {
    await Product.findOneAndDelete({ _id: product._id });
    await flushAuditScope(scope);
  });

  await Product.deleteMany({ _id: product._id });

  const record = await lastRecord();
  assert.equal(await Product.countDocuments({ _id: product._id }), 0);
  // نام و مقادیرِ کلیدی داخلِ خودِ رکورد مانده‌اند، نه در موجودیتِ حذف‌شده.
  assert.equal(record.resourceLabel, "حذف‌شدنی");
  assert.equal(record.resourceId, String(product._id));
  assert.deepEqual(record.changes.basePrice, { from: 77, to: null });
  assert.deepEqual(record.changes.sku, { from: "SKU-DEL", to: null });
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۸. سازگاری با رکوردهای قدیمی
 * ══════════════════════════════════════════════════════════════════════════ */

test("رکوردِ قدیمی بدونِ description همچنان عنوانِ خوانا دارد", () => {
  const legacy = { action: "authz.granted", description: undefined };
  assert.equal(activityHeadline(legacy), "اقدامِ نوشتنیِ مجاز");
  assert.equal(activityHeadline({ action: "order.status.change" }), "تغییر وضعیت سفارش");
  // شناسه‌ی کاملاً ناشناخته → خودِ شناسه، نه رشته‌ی خالی
  assert.equal(activityHeadline({ action: "legacy.unknown" }), "legacy.unknown");
});

test("برچسب‌های تاریخیِ فاز ۶ عوض نشده‌اند", () => {
  assert.equal(ACTIVITY_ACTIONS["authz.granted"].label, "اقدامِ نوشتنیِ مجاز");
  assert.equal(ACTIVITY_ACTIONS["authz.denied"].label, "رد دسترسی");
  assert.equal(ACTIVITY_ACTIONS["payment.approve"].label, "تأیید رسید پرداخت");
  assert.equal(ACTIVITY_ACTIONS["order.status.change"].label, "تغییر وضعیت سفارش");
});

/* ══════════════════════════════════════════════════════════════════════════
 * ۹. رجیستری
 * ══════════════════════════════════════════════════════════════════════════ */

test("هر شناسه‌ی اقدامی که رجیستری تولید می‌کند، برچسب دارد", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/auditEntities.js"),
    "utf8"
  );
  // شناسه‌هایی که داخلِ refine دستی نوشته شده‌اند
  const ids = [...source.matchAll(/action:\s*"([a-z][\w.]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 10, "انتظار می‌رفت refineها چند شناسه بسازند");

  const missing = ids.filter((id) => !ACTIVITY_ACTIONS[id]);
  assert.deepEqual(missing, [], `شناسه‌های بدونِ برچسب: ${missing.join(", ")}`);
});

test("هیچ موجودیتی بدونِ برچسب یا اولویت نیست", () => {
  for (const [model, descriptor] of Object.entries(AUDIT_ENTITIES)) {
    assert.ok(descriptor.key, `${model}: key ندارد`);
    assert.ok(descriptor.label, `${model}: label ندارد`);
    assert.equal(typeof descriptor.priority, "number", `${model}: priority ندارد`);
  }
});

test("مدلِ ثبت‌نشده هم توصیف می‌شود (پوشش به رجیستری وابسته نیست)", () => {
  const described = describeMutation({
    model: "SomeBrandNewModel",
    op: "create",
    name: entityName("SomeBrandNewModel", { name: "نمونه" }),
    changes: null,
  });
  assert.equal(described.action, "someBrandNewModel.create");
  assert.match(described.description, /نمونه/);
});

test("buildActivityFromScope بدونِ رویداد null می‌دهد", () => {
  assert.equal(buildActivityFromScope({ events: [], permissions: [] }), null);
});
