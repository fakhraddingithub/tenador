/**
 * scripts/verifyAuditTrail.mjs
 *
 * راستی‌آزماییِ سرتاسریِ دفترِ فعالیتِ تفصیلی، با HTTPِ واقعی.
 *
 * تستِ واحد ثابت می‌کند پلاگین درست کار می‌کند. این اسکریپت چیزِ دیگری را
 * ثابت می‌کند: که در یک اپلیکیشنِ *ساخته‌شده*، وقتی یک ادمینِ واقعی از مسیرِ
 * واقعیِ ورود وارد می‌شود و روت‌های واقعی را صدا می‌زند، رکوردهایی که در دفتر
 * می‌نشینند دقیق‌اند — یعنی `after()`، AsyncLocalStorage و پلاگین در محیطِ
 * واقعیِ Next با هم کار می‌کنند. هیچ‌کدام از اینها را تستِ درون‌فرایندی نشان
 * نمی‌دهد.
 *
 * ⚠️ روی دیتابیسِ *موقتِ در حافظه* اجرا می‌شود. هیچ نوشتنی به production
 * نمی‌رود؛ متغیرِ MONGODB_URI_TENADOR فقط برای همین فرایندِ فرزند بازنویسی
 * می‌شود.
 *
 *   node scripts/verifyAuditTrail.mjs           # اجرا و خروج
 *   node scripts/verifyAuditTrail.mjs --keep    # سرور را برای بررسیِ مرورگر باز نگه می‌دارد
 *
 * پیش‌نیاز: یک بیلدِ تازه (`npx next build`).
 */

import { spawn } from "node:child_process";
import path from "node:path";

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// utils/auth.js از تستِ node قابل بارگذاری نیست (ایمپورتِ named از یک ماژول CJS)؛
// همان bcryptjs با همان cost مستقیم استفاده می‌شود.
import bcrypt from "bcryptjs";
import { SUPER_ADMIN_ROLE_NAME, SUPER_ADMIN_SYSTEM_KEY } from "../src/lib/permissions.js";

const PORT = Number(process.env.AUDIT_VERIFY_PORT || 4200);
const BASE = `http://localhost:${PORT}`;
const DB_NAME = "tenador-audit";
const KEEP = process.argv.includes("--keep");

const PHONE = "09121110000";
const SECOND_PHONE = "09121110002";
const PASSWORD = "Verify@12345";

/* ────────────────────────────────────────────────────────────────────────────
 * seed
 * ──────────────────────────────────────────────────────────────────────────── */

async function seed(db) {
  const now = new Date();
  const oid = () => new mongoose.Types.ObjectId();

  const user = await db.collection("users").insertOne({
    provider: "local",
    name: "صالح",
    lastName: "کمالی",
    phone: PHONE,
    email: "owner@audit.test",
    password: await bcrypt.hash(PASSWORD, 12),
    role: "user",
    isBanned: false,
    createdAt: now,
    updatedAt: now,
  });

  const role = await db.collection("adminroles").insertOne({
    name: SUPER_ADMIN_ROLE_NAME,
    systemKey: SUPER_ADMIN_SYSTEM_KEY,
    description: "راستی‌آزمایی",
    permissions: [],
    isSystem: true,
    isFullAccess: true,
    createdAt: now,
    updatedAt: now,
  });

  const admin = await db.collection("admins").insertOne({
    user: user.insertedId,
    name: "صالح کمالی",
    username: "owner",
    email: "owner@audit.test",
    title: "",
    role: role.insertedId,
    permissionGrants: [],
    permissionDenials: [],
    permissions: [],
    isActive: true,
    activatedAt: now,
    lastLoginAt: null,
    source: "panel",
    createdAt: now,
    updatedAt: now,
  });

  const second = await db.collection("users").insertOne({
    provider: "local",
    name: "نازنین",
    lastName: "همکار",
    phone: SECOND_PHONE,
    email: "second@audit.test",
    password: await bcrypt.hash(PASSWORD, 12),
    role: "user",
    isBanned: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("admins").insertOne({
    user: second.insertedId,
    name: "نازنین همکار",
    username: "second",
    email: "second@audit.test",
    title: "",
    role: role.insertedId,
    permissionGrants: [],
    permissionDenials: [],
    permissions: [],
    isActive: true,
    activatedAt: now,
    lastLoginAt: null,
    source: "panel",
    createdAt: now,
    updatedAt: now,
  });

  // کاربرِ هدف برای مسدودسازی
  const target = await db.collection("users").insertOne({
    provider: "local",
    name: "مهمان",
    lastName: "آزمایشی",
    phone: "09121110001",
    password: "x".repeat(20),
    role: "user",
    isBanned: false,
    createdAt: now,
    updatedAt: now,
  });

  const order = await db.collection("orders").insertOne({
    trackingCode: "TEN-24680",
    user: target.insertedId,
    items: [],
    subtotalPrice: 4500000,
    totalPrice: 4500000,
    paymentMethod: "BANK_RECEIPT",
    paymentStatus: "UNPAID",
    fulfillmentStatus: "WAITING",
    payments: [],
    createdAt: now,
    updatedAt: now,
  });

  const payment = await db.collection("payments").insertOne({
    order: order.insertedId,
    method: "BANK_RECEIPT",
    amount: 4500000,
    status: "PENDING",
    bankReceipt: { imageUrls: ["https://example.test/receipt.jpg"], reviewStatus: "PENDING" },
    createdAt: now,
    updatedAt: now,
  });

  await db
    .collection("orders")
    .updateOne({ _id: order.insertedId }, { $set: { payments: [payment.insertedId] } });

  // تاکسونومیِ واقعی، تا ساختنِ محصول/مقاله از راهِ API کار کند
  const sport = await db.collection("sports").insertOne({
    name: "تنیس",
    slug: "tennis",
    order: 1,
    createdAt: now,
    updatedAt: now,
  });
  const brand = await db.collection("brands").insertOne({
    name: "Wilson",
    slug: "wilson",
    order: 1,
    createdAt: now,
    updatedAt: now,
  });
  const category = await db.collection("categories").insertOne({
    title: "راکت",
    name: "racket",
    slug: "racket",
    sport: sport.insertedId,
    order: 1,
    createdAt: now,
    updatedAt: now,
  });

  // سفارش و پرداختِ دوم — برای آزمودنِ *رد* پرداخت
  const order2 = await db.collection("orders").insertOne({
    trackingCode: "TEN-13579",
    user: target.insertedId,
    items: [],
    subtotalPrice: 900000,
    totalPrice: 900000,
    paymentMethod: "BANK_RECEIPT",
    paymentStatus: "UNPAID",
    fulfillmentStatus: "WAITING",
    payments: [],
    createdAt: now,
    updatedAt: now,
  });
  const payment2 = await db.collection("payments").insertOne({
    order: order2.insertedId,
    method: "BANK_RECEIPT",
    amount: 900000,
    status: "PENDING",
    bankReceipt: { imageUrls: ["https://example.test/r2.jpg"], reviewStatus: "PENDING" },
    createdAt: now,
    updatedAt: now,
  });
  await db
    .collection("orders")
    .updateOne({ _id: order2.insertedId }, { $set: { payments: [payment2.insertedId] } });

  /**
   * یک رکوردِ *به‌شکلِ قدیم*: نه description دارد، نه related.
   *
   * مستقیم با درایور نوشته می‌شود تا دقیقاً همان شکلی باشد که فاز ۶ تولید
   * می‌کرد. هدف این است که ثابت شود رکوردهای موجودِ دیتابیس بعد از این تغییر
   * هم سالم خوانده و رندر می‌شوند.
   */
  await db.collection("adminactivities").insertOne({
    actorUser: user.insertedId,
    actorAdmin: admin.insertedId,
    actorSnapshot: {
      name: "صالح کمالی",
      username: "owner",
      roleName: SUPER_ADMIN_ROLE_NAME,
      roleId: role.insertedId,
      isFullAccess: true,
      source: "membership",
      permissionCount: 132,
    },
    action: "authz.granted",
    permissions: ["products.edit"],
    method: "",
    route: "",
    resourceType: "",
    resourceId: "",
    resourceLabel: "",
    result: "attempted",
    statusCode: 200,
    reason: "",
    requestId: "legacy-record",
    ip: "",
    userAgent: "",
    metadata: null,
    changes: null,
    expiresAt: null,
    createdAt: new Date(now.getTime() - 86400000),
  });

  const product = await db.collection("products").insertOne({
    name: "راکت تنیس Wilson Blade 100",
    shortDescription: "کوتاه",
    longDescription: "بلند",
    sku: "WB-100",
    mainImage: "https://example.test/p.jpg",
    category: oid(),
    brand: oid(),
    sport: oid(),
    basePrice: 19900000,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    sportId: String(sport.insertedId),
    brandId: String(brand.insertedId),
    categoryId: String(category.insertedId),
    order2Id: String(order2.insertedId),
    payment2Id: String(payment2.insertedId),
    secondUserId: String(second.insertedId),
    userId: String(user.insertedId),
    adminId: String(admin.insertedId),
    targetId: String(target.insertedId),
    orderId: String(order.insertedId),
    paymentId: String(payment.insertedId),
    productId: String(product.insertedId),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * ابزارِ HTTP
 * ──────────────────────────────────────────────────────────────────────────── */

/** هر هویت جارِ کوکیِ خودش را دارد — لازمه‌ی تستِ همروندی. */
const jars = { main: "", second: "" };

async function call(method, url, body, who = "main") {
  const res = await fetch(`${BASE}${url}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(jars[who] ? { cookie: jars[who] } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) {
    const jar = new Map(
      jars[who]
        .split("; ")
        .filter(Boolean)
        .map((pair) => [pair.split("=")[0], pair])
    );
    for (const cookie of setCookie) {
      const first = cookie.split(";")[0];
      jar.set(first.split("=")[0], first);
    }
    jars[who] = [...jar.values()].join("; ");
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* پاسخِ غیرِ JSON */
  }
  return { status: res.status, body: json };
}

const waitFor = async (url, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      await fetch(url, { method: "HEAD" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
};

/* ────────────────────────────────────────────────────────────────────────────
 * گزارش
 * ──────────────────────────────────────────────────────────────────────────── */

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** آخرین رکوردها را می‌خواند (خودِ این خواندن یک رکوردِ authz.read می‌سازد). */
async function ledger(params = "") {
  const { body } = await call("GET", `/api/admin/activity?limit=50${params}`);
  return body?.items || [];
}

/* ────────────────────────────────────────────────────────────────────────────
 * اجرا
 * ──────────────────────────────────────────────────────────────────────────── */

async function main() {
  console.log("\n▸ بالا آوردنِ دیتابیسِ موقت…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  // getUri(dbName) نامِ دیتابیس را *داخلِ* مسیر می‌گذارد؛ چسباندنِ دستی آن به
  // انتهای URI پارامترِ replicaSet را خراب می‌کند.
  const uri = replSet.getUri(DB_NAME);
  await mongoose.connect(uri);
  const ids = await seed(mongoose.connection.db);
  await mongoose.disconnect();
  console.log("✓ داده‌ی آزمایشی seed شد (production دست‌نخورده)\n");

  console.log(`▸ اجرای اپلیکیشنِ ساخته‌شده روی ${BASE}…`);
  const server = spawn(
    process.execPath,
    [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI_TENADOR: uri },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  server.stdout.on("data", () => {});
  server.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (/Error|error/.test(text)) process.stderr.write(text);
  });

  const stop = async () => {
    server.kill();
    await replSet.stop();
  };

  try {
    if (!(await waitFor(`${BASE}/api/navbar`))) throw new Error("سرور بالا نیامد");
    console.log("✓ سرور آماده است\n");

    /* ── ۱) ورودِ واقعی ───────────────────────────────────────────────── */
    console.log("▸ ورود از مسیرِ واقعیِ /api/auth/login");
    const login = await call("POST", "/api/auth/login", { phone: PHONE, password: PASSWORD });
    check("ورود موفق", login.status === 200, `status=${login.status}`);

    const adminDoc = await call("GET", `/api/admin/admins/${ids.adminId}`);
    const lastLoginAt = adminDoc.body?.admin?.lastLoginAt || null;
    check(
      "آخرین ورود روی عضویتِ ادمین ثبت شد",
      !!lastLoginAt && Date.now() - new Date(lastLoginAt).getTime() < 120000,
      lastLoginAt ? new Date(lastLoginAt).toISOString() : "خالی"
    );

    /* ── ۲) تغییر وضعیت سفارش ────────────────────────────────────────── */
    console.log("\n▸ اقدام: تغییر وضعیت سفارش");
    const statusRes = await call("PATCH", `/api/admin/orders/${ids.orderId}`, {
      fulfillmentStatus: "SENT",
    });
    check("درخواست موفق", statusRes.status === 200, `status=${statusRes.status}`);

    let items = await ledger("&action=order.status.change");
    const statusRecord = items[0];
    check("رکوردِ order.status.change ساخته شد", !!statusRecord);
    check(
      "توضیح شاملِ کدِ سفارش است",
      !!statusRecord?.description?.includes("TEN-24680"),
      statusRecord?.description || "—"
    );
    check(
      "قبل/بعدِ وضعیت ثبت شده",
      statusRecord?.changes?.fulfillmentStatus?.from === "WAITING" &&
        statusRecord?.changes?.fulfillmentStatus?.to === "SENT",
      JSON.stringify(statusRecord?.changes?.fulfillmentStatus)
    );
    check("نتیجه موفق است", statusRecord?.result === "success");
    check(
      "برچسبِ موجودیت ذخیره شده",
      statusRecord?.resourceType === "Order" && statusRecord?.resourceLabel === "#TEN-24680",
      `${statusRecord?.resourceType} / ${statusRecord?.resourceLabel}`
    );

    /* ── ۳) عملیاتِ شکست‌خورده ────────────────────────────────────────── */
    console.log("\n▸ اقدامِ شکست‌خورده: وضعیتِ نامعتبر");
    const badRes = await call("PATCH", `/api/admin/orders/${ids.orderId}`, {
      fulfillmentStatus: "NOT_A_STATUS",
    });
    check("درخواست رد شد", badRes.status === 400, `status=${badRes.status}`);

    items = await ledger();
    const successAfterFailure = items.filter(
      (item) => item.result === "success" && item.action === "order.status.change"
    );
    check(
      "اقدامِ ناموفق به‌عنوان موفق ثبت نشد",
      successAfterFailure.length === 1,
      `${successAfterFailure.length} رکوردِ موفق`
    );
    check(
      "ولی خودِ تلاش ثبت شده است",
      items.some((item) => item.action === "authz.granted" && item.result === "attempted")
    );

    /* ── ۴) تأیید پرداخت: یک اقدام، چند موجودیت ──────────────────────── */
    console.log("\n▸ اقدام: تأیید پرداخت");
    const approve = await call("POST", `/api/admin/payments/${ids.paymentId}/approve`, {
      confirmedAmount: 4500000,
    });
    check("درخواست موفق", approve.status === 200, `status=${approve.status}`);

    items = await ledger();
    const paymentRecord = items.find((item) => item.action === "payment.approve");
    check("یک رکورد برای کلِ اقدام ساخته شد", !!paymentRecord);
    check(
      "تیترِ رکورد سفارش را نام می‌برد",
      !!paymentRecord?.description?.includes("TEN-24680"),
      paymentRecord?.description || "—"
    );
    check(
      "سفارش به‌عنوان موجودیتِ مرتبط ثبت شده",
      !!paymentRecord?.related?.some((rel) => rel.type === "Order"),
      JSON.stringify((paymentRecord?.related || []).map((r) => r.action))
    );
    check(
      "تغییرِ وضعیتِ پرداختِ سفارش ثبت شده",
      paymentRecord?.related?.some((rel) => rel.changes?.paymentStatus?.to === "PAID"),
      JSON.stringify(paymentRecord?.related?.[0]?.changes?.paymentStatus)
    );

    /* ── ۵) مسیرِ رکوردِ دست‌نویس (کاربران) ───────────────────────────── */
    console.log("\n▸ اقدام: مسدودسازی کاربر (روتی که خودش رکورد می‌نویسد)");
    const ban = await call("PATCH", `/api/admin/users/${ids.targetId}`, { isBanned: true });
    check("درخواست موفق", ban.status === 200, `status=${ban.status}`);

    items = await ledger();
    const banRecords = items.filter((item) => item.action === "user.ban");
    check("دقیقاً یک رکوردِ user.ban", banRecords.length === 1, `${banRecords.length} رکورد`);
    check(
      "برچسبِ کاربر ذخیره شده",
      banRecords[0]?.resourceLabel?.includes("مهمان"),
      banRecords[0]?.resourceLabel || "—"
    );

    /* ── ۶) ایجاد و حذفِ یک موجودیتِ عمومی ───────────────────────────── */
    console.log("\n▸ اقدام: ایجاد و آرشیوِ برچسبِ مقاله");
    const tag = await call("POST", "/api/admin/article-tags", { name: "برچسبِ آزمایشی" });
    check("ایجاد موفق", tag.status === 201, `status=${tag.status}`);
    const tagId = tag.body?.tag?._id;

    items = await ledger();
    const createRecord = items.find((item) => item.action === "articleTag.create");
    check("رکوردِ ایجاد ساخته شد", !!createRecord, createRecord?.description || "—");
    check(
      "نامِ موجودیت در رکورد است",
      !!createRecord?.description?.includes("برچسبِ آزمایشی"),
      createRecord?.description || "—"
    );

    if (tagId) {
      await call("DELETE", `/api/admin/article-tags/${tagId}`);
      items = await ledger();
      const archiveRecord = items.find(
        (item) => item.resourceType === "ArticleTag" && item.resourceId === String(tagId) && item.changes?.status
      );
      check(
        "آرشیوِ برچسب با قبل/بعد ثبت شد",
        !!archiveRecord,
        JSON.stringify(archiveRecord?.changes?.status)
      );
      check(
        "پس از حذف هم نامِ موجودیت در دفتر مانده",
        archiveRecord?.resourceLabel === "برچسبِ آزمایشی",
        archiveRecord?.resourceLabel || "—"
      );
    }

    /* ── ۷) محصول: ایجاد، تغییر قیمت، غیرفعال‌سازی، حذف ─────────────── */
    console.log("\n▸ اقدام: چرخه‌ی کاملِ محصول");
    const productBody = {
      name: "راکت Babolat Pure Aero",
      shortDescription: "راکتِ قدرتی",
      longDescription: "توضیحِ کاملِ راکت",
      basePrice: 21500000,
      category: ids.categoryId,
      brand: ids.brandId,
      sport: ids.sportId,
      mainImage: "https://example.test/pa.jpg",
      isActive: true,
    };
    const createdProduct = await call("POST", "/api/product/create", productBody);
    check("ایجاد محصول موفق", createdProduct.status < 300, `status=${createdProduct.status}`);
    const newProductId =
      createdProduct.body?.product?._id || createdProduct.body?._id || createdProduct.body?.data?._id;

    items = await ledger();
    const productCreate = items.find((item) => item.action === "product.create");
    check("رکوردِ ایجادِ محصول", !!productCreate, productCreate?.description || "—");

    if (newProductId) {
      await call("PUT", `/api/product/${newProductId}`, {
        ...productBody,
        basePrice: 19900000,
      });
      items = await ledger();
      const priceRecord = items.find((item) => item.action === "product.price.change");
      check("رکوردِ تغییر قیمت", !!priceRecord, priceRecord?.description || "—");
      check(
        "قبل/بعدِ قیمت درست است",
        priceRecord?.changes?.basePrice?.from === 21500000 &&
          priceRecord?.changes?.basePrice?.to === 19900000,
        JSON.stringify(priceRecord?.changes?.basePrice)
      );

      await call("PUT", `/api/product/${newProductId}`, { ...productBody, basePrice: 19900000, isActive: false });
      items = await ledger();
      const deactivate = items.find((item) => item.action === "product.deactivate");
      check("رکوردِ غیرفعال‌سازی محصول", !!deactivate, deactivate?.description || "—");

      await call("DELETE", `/api/product/${newProductId}`);
      items = await ledger();
      const productDelete = items.find((item) => item.action === "product.delete");
      check("رکوردِ حذفِ محصول", !!productDelete, productDelete?.description || "—");
      check(
        "نامِ محصولِ حذف‌شده در دفتر مانده",
        productDelete?.resourceLabel === productBody.name,
        productDelete?.resourceLabel || "—"
      );
      check(
        "مقادیرِ کلیدیِ محصولِ حذف‌شده در دفتر مانده",
        productDelete?.changes?.basePrice?.from === 19900000,
        JSON.stringify(productDelete?.changes?.basePrice)
      );
    }

    /* ── ۸) مقاله: دسته، ایجاد، انتشار، زباله‌دان ────────────────────── */
    console.log("\n▸ اقدام: چرخه‌ی مقاله");
    const artCat = await call("POST", "/api/admin/article-categories", {
      name: "راهنمای خرید",
      slug: "buying-guide",
      status: "active",
    });
    check("ایجاد دسته‌بندی مقاله", artCat.status === 201, `status=${artCat.status}`);
    const artCatId = artCat.body?.category?._id;

    items = await ledger();
    const artCatRecord = items.find((item) => item.action === "articleCategory.create");
    check("رکوردِ ایجادِ دسته‌بندی مقاله", !!artCatRecord, artCatRecord?.description || "—");

    let articleId = null;
    if (artCatId) {
      const article = await call("POST", "/api/admin/articles", {
        title: "چگونه راکت مناسب انتخاب کنیم",
        category: artCatId,
        excerpt: "خلاصه",
        blocks: [],
        tags: [],
        status: "draft",
      });
      check("ایجاد مقاله", article.status === 201, `status=${article.status}`);
      articleId = article.body?.article?._id;

      items = await ledger();
      const articleCreate = items.find((item) => item.action === "article.create");
      check("رکوردِ ایجادِ مقاله", !!articleCreate, articleCreate?.description || "—");
    }

    if (articleId) {
      await call("PATCH", `/api/admin/articles/${articleId}`, { status: "published" });
      items = await ledger();
      const publish = items.find((item) => item.action === "article.publish");
      check("رکوردِ انتشارِ مقاله", !!publish, publish?.description || "—");
      check(
        "قبل/بعدِ وضعیتِ مقاله",
        publish?.changes?.status?.from === "draft" && publish?.changes?.status?.to === "published",
        JSON.stringify(publish?.changes?.status)
      );

      await call("DELETE", `/api/admin/articles/${articleId}`);
      items = await ledger();
      const trashed = items.find(
        (item) => item.resourceType === "Article" && /trash|archive|delete/.test(item.action)
      );
      check("رکوردِ حذف/زباله‌دانِ مقاله", !!trashed, trashed ? `${trashed.action} — ${trashed.description}` : "—");
    }

    /* ── ۹) دسته‌بندیِ کاتالوگ ────────────────────────────────────────── */
    console.log("\n▸ اقدام: دسته‌بندیِ کاتالوگ");
    const cat = await call("POST", "/api/categories/create", {
      title: "کفش تنیس",
      name: "tennis-shoes",
      sport: ids.sportId,
      icon: "",
      image: "",
    });
    check("ایجاد دسته‌بندی", cat.status < 300, `status=${cat.status}`);
    items = await ledger();
    const catRecord = items.find((item) => item.action === "category.create");
    check("رکوردِ ایجادِ دسته‌بندی", !!catRecord, catRecord?.description || "—");

    /* ── ۱۰) اقدامِ مالی ──────────────────────────────────────────────── */
    console.log("\n▸ اقدام: مالی");
    const rate = await call("POST", "/api/admin/exchange-rate", { rateToToman: 92000, note: "به‌روزرسانی" });
    check("ثبت نرخ ارز", rate.status < 300, `status=${rate.status}`);
    items = await ledger();
    const rateRecord = items.find((item) => item.resourceType === "ExchangeRate");
    check("رکوردِ نرخ ارز", !!rateRecord, rateRecord?.description || "—");

    const setting = await call("PUT", "/api/admin/site-settings", {
      key: "monthly_installment_rate",
      value: 4.5,
    });
    check("تغییر تنظیماتِ مالی", setting.status < 300, `status=${setting.status}`);
    items = await ledger();
    const settingRecord = items.find((item) => item.resourceType === "SiteSetting");
    check("رکوردِ تنظیماتِ سایت", !!settingRecord, settingRecord?.description || "—");

    /* ── ۱۱) ردِ پرداخت ───────────────────────────────────────────────── */
    console.log("\n▸ اقدام: رد پرداخت");
    const reject = await call("POST", `/api/admin/payments/${ids.payment2Id}/reject`, {
      rejectReason: "مبلغِ فیش با سفارش نمی‌خواند",
    });
    check("درخواست موفق", reject.status === 200, `status=${reject.status}`);
    items = await ledger();
    const rejectRecord = items.find((item) => item.action === "payment.reject");
    check("رکوردِ ردِ پرداخت", !!rejectRecord, rejectRecord?.description || "—");
    check(
      "دلیلِ رد در جزئیات هست",
      JSON.stringify(rejectRecord?.changes || {}).includes("نمی‌خواند") ||
        JSON.stringify(rejectRecord?.related || []).includes("نمی‌خواند"),
      JSON.stringify(rejectRecord?.changes)
    );

    /* ── ۱۲) نقشِ ادمین ───────────────────────────────────────────────── */
    console.log("\n▸ اقدام: ایجاد نقشِ ادمین");
    const role = await call("POST", "/api/admin/roles", {
      name: "ناظرِ آزمایشی",
      description: "فقط خواندنی",
      permissions: ["dashboard.view", "orders.view"],
    });
    check("ایجاد نقش", role.status < 300, `status=${role.status}`);
    items = await ledger();
    const roleRecord = items.find((item) => item.action === "role.create");
    check("رکوردِ ایجادِ نقش", !!roleRecord, roleRecord?.resourceLabel || "—");

    /* ── ۱۳) رکوردِ قدیمی و سقف‌های اندازه ────────────────────────────── */
    console.log("\n▸ سازگاری و مهارِ اندازه");
    items = await ledger();
    const legacy = items.find((item) => item.requestId === "legacy-record");
    check("رکوردِ به‌شکلِ قدیم هنوز از API برمی‌گردد", !!legacy);
    check(
      "رکوردِ قدیمی نه description دارد نه related — و خطا هم نمی‌دهد",
      !!legacy && !legacy.description && (!legacy.related || legacy.related.length === 0),
      `description=${JSON.stringify(legacy?.description)} related=${JSON.stringify(legacy?.related)}`
    );

    const longest = items.reduce((max, item) => Math.max(max, (item.description || "").length), 0);
    check("هیچ توصیفی از ۳۰۰ نویسه بلندتر نیست", longest <= 300, `بلندترین=${longest}`);

    const widest = items.reduce((max, item) => {
      const fields = Object.keys(item.changes || {}).length;
      return Math.max(max, fields);
    }, 0);
    check("هیچ رکوردی بیش از ۲۶ فیلدِ تغییرکرده ندارد", widest <= 26, `بیشترین=${widest}`);

    const longestValue = items.reduce((max, item) => {
      for (const change of Object.values(item.changes || {})) {
        for (const side of [change?.from, change?.to]) {
          if (typeof side === "string") max = Math.max(max, side.length);
        }
      }
      return max;
    }, 0);
    check("هیچ مقداری از ۱۷۰ نویسه بلندتر نیست", longestValue <= 170, `بلندترین=${longestValue}`);

    /* ── ۱۴) همروندی: دو ادمین هم‌زمان ────────────────────────────────────
       این خطرناک‌ترین بخشِ طراحی است. دامنه با `enterWith` روی فریمِ async
       درخواست می‌نشیند؛ اگر آن فریم بین درخواست‌ها مشترک بود، اقدامِ یک ادمین
       به نامِ دیگری ثبت می‌شد — بدترین باگِ ممکن برای یک دفترِ ممیزی. اینجا
       دو ادمینِ متفاوت هم‌زمان دو کارِ متفاوت می‌کنند. */
    console.log("\n▸ همروندی: دو ادمینِ متفاوت، هم‌زمان");
    const secondLogin = await call(
      "POST",
      "/api/auth/login",
      { phone: SECOND_PHONE, password: PASSWORD },
      "second"
    );
    check("ورودِ ادمینِ دوم", secondLogin.status === 200, `status=${secondLogin.status}`);

    const [byMain, bySecond] = await Promise.all([
      call("PATCH", `/api/admin/orders/${ids.orderId}`, { fulfillmentStatus: "DELIVERED" }, "main"),
      call("POST", "/api/admin/article-tags", { name: "برچسبِ همروند" }, "second"),
    ]);
    check(
      "هر دو درخواست موفق",
      byMain.status === 200 && bySecond.status === 201,
      `${byMain.status} / ${bySecond.status}`
    );

    // مهلتِ کوتاه: رکوردها در after() یعنی پس از ارسالِ پاسخ نوشته می‌شوند.
    await new Promise((r) => setTimeout(r, 1500));

    items = await ledger();
    const deliveredRecord = items.find(
      (item) => item.resourceType === "Order" && item.changes?.fulfillmentStatus?.to === "DELIVERED"
    );
    const concurrentTag = items.find(
      (item) => item.resourceType === "ArticleTag" && item.resourceLabel === "برچسبِ همروند"
    );

    check("اقدامِ ادمینِ اول ثبت شد", !!deliveredRecord, deliveredRecord?.description || "—");
    check("اقدامِ ادمینِ دوم ثبت شد", !!concurrentTag, concurrentTag?.description || "—");
    check(
      "اقدامِ اول به نامِ خودِ ادمینِ اول است",
      deliveredRecord?.actorSnapshot?.username === "owner",
      deliveredRecord?.actorSnapshot?.username || "—"
    );
    check(
      "اقدامِ دوم به نامِ خودِ ادمینِ دوم است",
      concurrentTag?.actorSnapshot?.username === "second",
      concurrentTag?.actorSnapshot?.username || "—"
    );
    check(
      "هیچ رکوردی هر دو موجودیت را قاتی نکرده",
      !(deliveredRecord?.related || []).some((rel) => rel.type === "ArticleTag") &&
        !(concurrentTag?.related || []).some((rel) => rel.type === "Order"),
      `${(deliveredRecord?.related || []).length} / ${(concurrentTag?.related || []).length}`
    );

    /* ── ۱۵) هیچ رازی در دفتر نیست ────────────────────────────────────── */
    console.log("\n▸ بازرسیِ نهاییِ دفتر");
    items = await ledger();
    const dump = JSON.stringify(items);
    check("رمز عبورِ آزمایشی در دفتر نیست", !dump.includes(PASSWORD));
    check("توکنِ نشست در دفتر نیست", !dump.includes("accessToken="));
    check(
      "همه‌ی رکوردها بازیگرِ مشخص دارند",
      items.every((item) => item.actorSnapshot?.name),
      `${items.length} رکورد`
    );

    const withDescription = items.filter((item) => item.description);
    console.log(
      `\n  ${withDescription.length} از ${items.length} رکورد جمله‌ی توصیفِ اختصاصی دارند؛` +
        " بقیه رکوردهای دسترسی/خواندن‌اند."
    );
    for (const item of withDescription.slice(0, 12)) {
      console.log(`    • ${item.description}`);
    }

    /* ── خلاصه ───────────────────────────────────────────────────────── */
    const failed = results.filter((r) => !r.ok);
    console.log(
      `\n${"─".repeat(72)}\n${failed.length ? `✗ ${failed.length} بررسی رد شد` : "✓ همه‌ی بررسی‌ها گذشت"}\n`
    );

    if (KEEP) {
      console.log(`سرور برای بررسیِ مرورگر باز است: ${BASE}`);
      console.log(`ورود: ${PHONE} / ${PASSWORD}`);
      console.log(`صفحه‌ی تاریخچه: ${BASE}/p-admin/users/admins/${ids.adminId}`);
      console.log("برای بستن Ctrl+C بزنید.\n");
      process.on("SIGINT", async () => {
        await stop();
        process.exit(0);
      });
      await new Promise(() => {});
    }

    await stop();
    process.exit(failed.length ? 1 : 0);
  } catch (error) {
    console.error("\n✗ خطا:", error?.message || error);
    await stop();
    process.exit(1);
  }
}

main();
