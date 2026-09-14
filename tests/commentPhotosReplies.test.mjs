/**
 * tests/commentPhotosReplies.test.mjs
 *
 * تصویرِ نظر (برای محصول نو و دست دوم) و پاسخ‌دادن به نظر — روی یک mongodb
 * واقعی با اسکیمای واقعیِ Comment.
 *
 * چرا واقعی: دو ادعای اصلی اینجا فقط با دیتابیس قابل اثبات‌اند — «دو ثبتِ
 * هم‌زمان به یک نظر تکراری ختم نمی‌شود» (که ایندکسِ یکتای partial تضمینش
 * می‌کند) و «هیچ پاسخی بدون والد باقی نمی‌ماند». هر دو با mock ناپدید می‌شوند.
 *
 * روت‌ها و سرویس داخل vm بارگذاری می‌شوند تا وابستگی‌های Next (next/server،
 * next/cache، cookies) جایگزین‌پذیر باشند، ولی مدل‌های تزریق‌شده واقعی‌اند.
 *
 * اجرا: npm run test:comment-photos-replies
 */

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import vm from "node:vm";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

const { default: Comment } = await import("../models/Comment.js");
const { default: Product } = await import("../models/Product.js");
const { default: UsedProduct } = await import("../models/UsedProduct.js");
const { default: Order } = await import("../models/Order.js");
await import("../models/User.js");
const { getUserFullName } = await import("../utils/userName.js");

const IMAGEKIT = "https://ik.imagekit.io/tenador";
process.env.IMAGEKIT_URL_ENDPOINT = IMAGEKIT;
const img = (name) => `${IMAGEKIT}/reviews/${name}.jpg`;

/* ── بارگذاری ماژول با وابستگی‌های جایگزین ─────────────────────────────── */

async function load(relative, deps) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  // URL/URLSearchParams گلوبالِ Node هستند، نه intrinsic موتور: یک vm context
  // تازه آن‌ها را ندارد و بدون تزریقشان هر new URL داخل روت throw می‌کند.
  const context = vm.createContext({
    console: { warn() {}, error() {}, log() {} },
    process,
    URL,
    URLSearchParams,
  });
  const loaded = new vm.SourceTextModule(source, { context });
  await loaded.link(
    (name) =>
      new vm.SyntheticModule(
        Object.keys(deps[name] ?? {}),
        function () {
          for (const [key, value] of Object.entries(deps[name] ?? {})) {
            this.setExport(key, value);
          }
        },
        { context },
      ),
  );
  await loaded.evaluate();
  return loaded.namespace;
}

const NextResponse = {
  json: (body, options) => ({ body, status: options?.status ?? 200 }),
};

let notifications = [];
let revalidated = [];
let authUserId = null;

function postRoute() {
  return load("../src/app/api/comments/route.js", {
    "next/server": { NextResponse },
    "next/headers": {
      cookies: async () => ({
        get: (key) =>
          key === "accessToken" && authUserId ? { value: "token" } : undefined,
      }),
    },
    mongoose: { default: mongoose },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/utils/auth": { verifyToken: () => (authUserId ? { userId: authUserId } : null) },
    "base/models/Comment": { default: Comment },
    "base/models/Product": { default: Product },
    "base/models/UsedProduct": { default: UsedProduct },
    "base/models/Order": { default: Order },
    "@/lib/revalidate": { revalidateContent: (tags) => revalidated.push(...tags) },
    "base/services/notificationService": {
      notifyNewComment: async (comment, meta) =>
        notifications.push({ id: String(comment._id), reply: !!meta?.reply }),
    },
  });
}

function adminListRoute() {
  return load("../src/app/api/admin/comments/route.js", {
    "base/services/reviewCredit.service": { getCommentRewardPreviews: async comments => comments.map(() => ({ amount: 0, status: "ineligible", canEdit: false })) },
    "next/server": { NextResponse },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/models/Comment": { default: Comment },
    "@/lib/requireAdminPermission": { default: async () => ({ denied: null }) },
  });
}

function adminItemRoute() {
  return load("../src/app/api/admin/comments/[id]/route.js", {
    "next/server": { NextResponse },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/models/Comment": { default: Comment },
    "base/models/Notification": { default: { deleteMany: async () => {} } },
    "@/lib/revalidate": { revalidateContent: (tags) => revalidated.push(...tags) },
    "@/lib/requireAdminPermission": { default: async () => ({ denied: null }) },
    "@/lib/reviewCreditGranting": { notifyReviewCreditGranted: async () => {} },
    "base/services/reviewCredit.service": { moderateCommentWithReviewCredit: async () => null },
  });
}

function reviewService() {
  return load("../services/comment.service.js", {
    // unstable_cache بیرون از Next اجرا نمی‌شود؛ اینجا فقط شفاف رد می‌شود.
    "next/cache": { unstable_cache: (fn) => fn },
    "base/configs/db": { default: async () => {} },
    "base/models/registerModels": {},
    "base/models/Comment": { default: Comment },
    "base/utils/userName": { getUserFullName },
  });
}

const body = (payload) => ({ json: async () => payload });

/* ── داده‌ی ثابتِ هر تست ────────────────────────────────────────────────── */

let mongod;
let POST;
let adminGET;
let adminDELETE;
let getApprovedReviews;
let buyer;
let stranger;
let product;
let usedProduct;
let order;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "comment-photos-replies-test" });
  // ایندکسِ یکتای partial باید واقعاً ساخته شود، وگرنه مسیر E11000 آزمایش نمی‌شود
  await Comment.syncIndexes();

  ({ POST } = await postRoute());
  ({ GET: adminGET } = await adminListRoute());
  ({ DELETE: adminDELETE } = await adminItemRoute());
  ({ getApprovedReviews } = await reviewService());
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Comment.deleteMany({});
  notifications = [];
  revalidated = [];

  buyer = new mongoose.Types.ObjectId();
  stranger = new mongoose.Types.ObjectId();
  product = new mongoose.Types.ObjectId();
  usedProduct = new mongoose.Types.ObjectId();
  order = new mongoose.Types.ObjectId();
  authUserId = String(buyer);

  // مدل‌های محصول/سفارش فقط خوانده می‌شوند (findById/findOne) — با درجِ مستقیم
  // در کالکشن، اسکیمای سنگینشان دورزده می‌شود بدون اینکه کوئریِ روت عوض شود.
  await mongoose.connection.collection("products").deleteMany({});
  await mongoose.connection.collection("usedproducts").deleteMany({});
  await mongoose.connection.collection("orders").deleteMany({});
  await mongoose.connection.collection("products").insertOne({ _id: product, name: "راکت تنیس" });
  await mongoose.connection
    .collection("usedproducts")
    .insertOne({ _id: usedProduct, name: "راکت دست دوم" });
  await mongoose.connection.collection("orders").insertOne({
    _id: order,
    user: buyer,
    fulfillmentStatus: "DELIVERED",
    items: [
      { itemType: "product", product },
      { itemType: "used_product", usedProduct },
    ],
  });
});

const approve = (id) =>
  Comment.updateOne({ _id: id }, { $set: { status: "approved", approved: true } });

/* ── ۱ و ۲: نظرِ محصول نو، با و بدون تصویر ──────────────────────────────── */

test("a verified buyer of a regular product can comment without a photo", async () => {
  const res = await POST(body({ product: String(product), orderId: String(order), text: "عالی بود", rating: 5 }));

  assert.equal(res.status, 201);
  const saved = await Comment.findOne({ product }).lean();
  assert.equal(saved.isVerifiedPurchase, true);
  assert.equal(saved.status, "pending");
  assert.deepEqual(saved.images, []);
  assert.deepEqual(notifications, [{ id: String(saved._id), reply: false }]);
});

test("a verified buyer of a regular product can attach photos — the used-only gate is gone", async () => {
  const res = await POST(
    body({
      product: String(product),
      orderId: String(order),
      text: "تصویر واقعی محصول",
      images: [img("a"), img("b")],
    }),
  );

  assert.equal(res.status, 201);
  const saved = await Comment.findOne({ product }).lean();
  assert.deepEqual(saved.images, [img("a"), img("b")]);
});

/* ── ۳: رگرسیونِ دست دوم ────────────────────────────────────────────────── */

test("the used-product photo flow is untouched", async () => {
  const res = await POST(
    body({
      usedProduct: String(usedProduct),
      orderId: String(order),
      text: "سالم رسید",
      images: [img("used")],
    }),
  );

  assert.equal(res.status, 201);
  const saved = await Comment.findOne({ usedProduct }).lean();
  assert.deepEqual(saved.images, [img("used")]);
  assert.equal(saved.product, null);
  assert.equal(saved.isVerifiedPurchase, true);
});

/* ── ۴، ۵، ۱۷: تصویرِ نامعتبر و کاربرِ بی‌اجازه ─────────────────────────── */

test("an image hosted anywhere but ImageKit is refused, and nothing is saved", async () => {
  const res = await POST(
    body({
      product: String(product),
      orderId: String(order),
      text: "متن معتبر",
      images: ["https://evil.example.com/x.jpg"],
    }),
  );

  assert.equal(res.status, 400);
  // «آپلودِ ناموفق نباید نظرِ نیمه‌ذخیره‌شده بسازد»
  assert.equal(await Comment.countDocuments({}), 0);
});

test("more than four images is refused before anything is written", async () => {
  const res = await POST(
    body({
      product: String(product),
      orderId: String(order),
      text: "متن معتبر",
      images: [img("1"), img("2"), img("3"), img("4"), img("5")],
    }),
  );

  assert.equal(res.status, 400);
  assert.equal(await Comment.countDocuments({}), 0);
});

test("a non-array images field is rejected rather than silently dropped", async () => {
  const res = await POST(
    body({ product: String(product), orderId: String(order), text: "متن معتبر", images: img("x") }),
  );

  assert.equal(res.status, 400);
  assert.equal(await Comment.countDocuments({}), 0);
});

test("a photo without a verified purchase is forbidden, for either product type", async () => {
  for (const payload of [
    { product: String(product) },
    { usedProduct: String(usedProduct) },
  ]) {
    const res = await POST(body({ ...payload, text: "بدون سفارش", images: [img("a")] }));
    assert.equal(res.status, 403);
  }
  assert.equal(await Comment.countDocuments({}), 0);
});

test("someone who did not buy the product cannot post a verified comment", async () => {
  authUserId = String(stranger);
  const res = await POST(
    body({ product: String(product), orderId: String(order), text: "نخریده‌ام" }),
  );

  assert.equal(res.status, 403);
  assert.equal(await Comment.countDocuments({}), 0);
});

/* ── ۱۶: کاربرِ واردنشده ────────────────────────────────────────────────── */

test("a signed-out visitor gets 401 and writes nothing", async () => {
  authUserId = null;
  const res = await POST(body({ product: String(product), text: "مهمان" }));

  assert.equal(res.status, 401);
  assert.equal(await Comment.countDocuments({}), 0);
});

/* ── شناسه‌های نامعتبر: ۴۰۰، نه ۵۰۰ ─────────────────────────────────────── */

test("malformed ids are client errors, never a leaked internal error", async () => {
  const cases = [
    { product: "not-an-id", text: "متن معتبر" },
    { product: String(product), parent: "nope", text: "متن معتبر" },
    { product: String(product), orderId: "nope", text: "متن معتبر" },
    { product: String(product), usedProduct: String(usedProduct), text: "متن معتبر" },
    { text: "متن معتبر" },
  ];

  for (const payload of cases) {
    const res = await POST(body(payload));
    assert.equal(res.status, 400, JSON.stringify(payload));
    assert.notEqual(res.body.message, "خطای داخلی سرور");
  }
});

test("a product id that is well formed but missing is a 404", async () => {
  const res = await POST(
    body({ product: String(new mongoose.Types.ObjectId()), text: "محصول حذف‌شده" }),
  );
  assert.equal(res.status, 404);
});

/* ── ۱۹: تکراری، از هر دو مسیر ──────────────────────────────────────────── */

test("a second top-level comment is refused by the pre-check", async () => {
  await POST(body({ product: String(product), text: "اولی" }));
  const res = await POST(body({ product: String(product), text: "دومی" }));

  assert.equal(res.status, 409);
  assert.equal(res.body.code, "DUPLICATE");
  assert.equal(await Comment.countDocuments({ product }), 1);
});

test("two simultaneous submissions cannot both land — the unique index decides", async () => {
  const results = await Promise.all([
    POST(body({ product: String(product), text: "هم‌زمان یک" })),
    POST(body({ product: String(product), text: "هم‌زمان دو" })),
  ]);

  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(await Comment.countDocuments({ product }), 1);
});

test("the same user may still comment on a different product", async () => {
  await POST(body({ product: String(product), text: "محصول نو" }));
  const res = await POST(body({ usedProduct: String(usedProduct), text: "محصول دست دوم" }));

  assert.equal(res.status, 201);
  assert.equal(await Comment.countDocuments({}), 2);
});

/* ── ۹، ۱۰، ۱۵: پاسخ‌ها ─────────────────────────────────────────────────── */

async function approvedParent(extra = {}) {
  return Comment.create({
    user: stranger,
    product,
    text: "نظر اصلی",
    status: "approved",
    approved: true,
    ...extra,
  });
}

test("a reply attaches to its parent and is announced as a reply", async () => {
  const parent = await approvedParent();
  const res = await POST(
    body({ product: String(product), parent: String(parent._id), text: "موافقم" }),
  );

  assert.equal(res.status, 201);
  const reply = await Comment.findOne({ parent: parent._id }).lean();
  assert.equal(String(reply.parent), String(parent._id));
  assert.equal(String(reply.product), String(product));
  assert.equal(reply.status, "pending");
  assert.deepEqual(notifications.at(-1), { id: String(reply._id), reply: true });
});

test("replying to a comment that has photos works the same way", async () => {
  const parent = await approvedParent({
    images: [img("a")],
    isVerifiedPurchase: true,
    order,
  });
  const res = await POST(
    body({ product: String(product), parent: String(parent._id), text: "عکس‌ها کمک کرد" }),
  );

  assert.equal(res.status, 201);
  assert.equal(await Comment.countDocuments({ parent: parent._id }), 1);
});

test("a reply may not carry photos of its own", async () => {
  const parent = await approvedParent();
  const res = await POST(
    body({
      product: String(product),
      parent: String(parent._id),
      text: "با عکس",
      images: [img("a")],
    }),
  );

  assert.equal(res.status, 400);
  assert.equal(await Comment.countDocuments({ parent: parent._id }), 0);
});

test("a deleted parent is reported, never answered into the void", async () => {
  const res = await POST(
    body({
      product: String(product),
      parent: String(new mongoose.Types.ObjectId()),
      text: "پاسخ یتیم",
    }),
  );

  assert.equal(res.status, 404);
  assert.equal(await Comment.countDocuments({}), 0);
});

test("an unapproved or rejected parent cannot be replied to", async () => {
  for (const status of ["pending", "rejected"]) {
    // نویسنده‌ی تازه در هر دور: ایندکسِ یکتا دو نظرِ سطح‌بالای یک کاربر روی یک
    // محصول را (به‌درستی) نمی‌پذیرد.
    const parent = await Comment.create({
      user: new mongoose.Types.ObjectId(),
      product,
      text: `والد ${status}`,
      status,
    });
    const res = await POST(
      body({ product: String(product), parent: String(parent._id), text: "پاسخ" }),
    );
    assert.equal(res.status, 409, status);
    assert.equal(await Comment.countDocuments({ parent: parent._id }), 0);
  }
});

test("a parent belonging to another product is refused", async () => {
  const parent = await Comment.create({
    user: stranger,
    usedProduct,
    text: "نظرِ محصول دیگر",
    status: "approved",
  });
  const res = await POST(
    body({ product: String(product), parent: String(parent._id), text: "پاسخ" }),
  );

  assert.equal(res.status, 400);
});

test("the tree stays one level deep — no reply to a reply", async () => {
  const parent = await approvedParent();
  const reply = await Comment.create({
    user: buyer,
    product,
    parent: parent._id,
    text: "پاسخ اول",
    status: "approved",
  });

  const res = await POST(
    body({ product: String(product), parent: String(reply._id), text: "پاسخِ پاسخ" }),
  );

  assert.equal(res.status, 400);
});

test("a reply never counts as the user's one top-level comment", async () => {
  const parent = await approvedParent();
  await POST(body({ product: String(product), parent: String(parent._id), text: "پاسخ من" }));
  const res = await POST(body({ product: String(product), text: "نظرِ سطح‌بالای من" }));

  assert.equal(res.status, 201);
});

/* ── ۱۳، ۱۴، ۲۰: نمایش روی صفحه‌ی محصول ─────────────────────────────────── */

test("approved replies are nested under their parent, never listed as reviews", async () => {
  const parent = await approvedParent({ rating: 4, images: [img("a")] });
  const reply = await Comment.create({
    user: buyer,
    product,
    parent: parent._id,
    text: "پاسخ تأییدشده",
    status: "approved",
    approved: true,
  });

  const { reviews, stats } = await getApprovedReviews(product);

  assert.equal(reviews.length, 1);
  assert.equal(stats.count, 1);
  assert.deepEqual([...reviews[0].images], [img("a")]);
  assert.equal(reviews[0].replies.length, 1);
  assert.equal(reviews[0].replies[0].id, String(reply._id));
  assert.equal(reviews[0].replies[0].text, "پاسخ تأییدشده");
});

test("a rejected or pending reply is shown nowhere", async () => {
  const parent = await approvedParent();
  await Comment.create({ user: buyer, product, parent: parent._id, text: "ردشده", status: "rejected" });
  await Comment.create({ user: stranger, product, parent: parent._id, text: "در انتظار", status: "pending" });

  const { reviews } = await getApprovedReviews(product);

  assert.equal(reviews.length, 1);
  assert.deepEqual([...reviews[0].replies], []);
});

test("a reply whose parent is not approved never becomes a standalone review", async () => {
  const parent = await Comment.create({ user: stranger, product, text: "والد ردشده", status: "rejected" });
  await Comment.create({
    user: buyer,
    product,
    parent: parent._id,
    text: "پاسخِ تأییدشده به والدِ ردشده",
    status: "approved",
    approved: true,
  });

  const { reviews, stats } = await getApprovedReviews(product);

  assert.deepEqual([...reviews], []);
  assert.equal(stats.count, 0);
});

test("comments written before the status field still show, and gain an empty replies list", async () => {
  // نظرِ قدیمی: نه status دارد، نه images، نه parent
  await mongoose.connection.collection("comments").insertOne({
    user: buyer,
    product,
    text: "نظر قدیمی",
    approved: true,
    createdAt: new Date(),
  });

  const { reviews } = await getApprovedReviews(product);

  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].text, "نظر قدیمی");
  assert.deepEqual([...reviews[0].images], []);
  assert.deepEqual([...reviews[0].replies], []);
});

test("replies read oldest-first while reviews stay newest-first", async () => {
  const older = await approvedParent({ createdAt: new Date("2024-01-01") });
  const newer = await Comment.create({
    user: buyer,
    product,
    text: "نظر تازه‌تر",
    status: "approved",
    createdAt: new Date("2024-06-01"),
  });
  await Comment.create({ user: buyer, product, parent: older._id, text: "پاسخ اول", status: "approved", createdAt: new Date("2024-02-01") });
  await Comment.create({ user: stranger, product, parent: older._id, text: "پاسخ دوم", status: "approved", createdAt: new Date("2024-03-01") });

  const { reviews } = await getApprovedReviews(product);

  assert.equal(reviews[0].id, String(newer._id));
  assert.deepEqual(
    [...reviews.find((r) => r.id === String(older._id)).replies].map((r) => r.text),
    ["پاسخ اول", "پاسخ دوم"],
  );
});

/* ── ۱۲: بافتِ والد در پنل ادمین ────────────────────────────────────────── */

const adminRequest = (status = "all") => ({
  url: `https://x/api/admin/comments?status=${status}&limit=50`,
});

test("the admin list carries the parent comment so a reply can be judged in context", async () => {
  const parent = await approvedParent({ rating: 5, images: [img("a")] });
  await Comment.create({ user: buyer, product, parent: parent._id, text: "پاسخ", status: "pending" });

  const res = await adminGET(adminRequest());
  assert.equal(res.status, 200);

  const reply = res.body.comments.find((c) => c.text === "پاسخ");
  assert.equal(String(reply.parent), String(parent._id));
  assert.equal(reply.parentComment.text, "نظر اصلی");
  assert.equal(reply.parentComment.status, "approved");
  assert.deepEqual([...reply.parentComment.images], [img("a")]);

  const top = res.body.comments.find((c) => c.text === "نظر اصلی");
  assert.equal(top.parent, null);
  assert.equal(top.parentComment, undefined);
});

test("a reply left over from a deleted parent still says so instead of losing the id", async () => {
  const orphan = await Comment.create({
    user: buyer,
    product,
    parent: new mongoose.Types.ObjectId(),
    text: "پاسخ یتیمِ قدیمی",
    status: "pending",
  });

  const res = await adminGET(adminRequest());
  const found = res.body.comments.find((c) => c._id.equals(orphan._id));

  // شناسه‌ی والد باید بماند (بَج «پاسخ» به آن وابسته است) و بافت null باشد
  assert.ok(found.parent);
  assert.equal(found.parentComment, null);
});

/* ── ۱۵: حذفِ والد، پاسخ‌ها را یتیم نمی‌گذارد ──────────────────────────── */

test("deleting a comment takes its replies with it", async () => {
  const parent = await approvedParent();
  await Comment.create({ user: buyer, product, parent: parent._id, text: "پاسخ ۱", status: "approved" });
  await Comment.create({ user: stranger, product, parent: parent._id, text: "پاسخ ۲", status: "pending" });
  const untouched = await Comment.create({ user: buyer, usedProduct, text: "نظر دیگر", status: "approved" });

  const res = await adminDELETE({}, { params: Promise.resolve({ id: String(parent._id) }) });

  assert.equal(res.status, 200);
  assert.equal(res.body.deletedReplies, 2);
  assert.equal(await Comment.countDocuments({ product }), 0);
  assert.ok(await Comment.findById(untouched._id));
  assert.ok(revalidated.includes("comments"));
});

test("deleting a reply leaves its parent alone", async () => {
  const parent = await approvedParent();
  const reply = await Comment.create({ user: buyer, product, parent: parent._id, text: "پاسخ", status: "approved" });

  const res = await adminDELETE({}, { params: Promise.resolve({ id: String(reply._id) }) });

  assert.equal(res.status, 200);
  assert.equal(res.body.deletedReplies, 0);
  assert.ok(await Comment.findById(parent._id));
});

test("deleting something that is already gone is a 404, not a crash", async () => {
  const res = await adminDELETE(
    {},
    { params: Promise.resolve({ id: String(new mongoose.Types.ObjectId()) }) },
  );
  assert.equal(res.status, 404);
});

/* ── ۶: تصویرها از تأیید جان سالم به در می‌برند ─────────────────────────── */

test("approving a comment keeps its photos and its reply link", async () => {
  const parent = await approvedParent();
  const withPhoto = await Comment.create({
    user: buyer,
    product: usedProduct,
    text: "با عکس",
    images: [img("a"), img("b")],
    status: "pending",
  });
  const reply = await Comment.create({ user: buyer, product, parent: parent._id, text: "پاسخ", status: "pending" });

  await approve(withPhoto._id);
  await approve(reply._id);

  const savedPhoto = await Comment.findById(withPhoto._id).lean();
  const savedReply = await Comment.findById(reply._id).lean();
  assert.deepEqual(savedPhoto.images, [img("a"), img("b")]);
  assert.equal(String(savedReply.parent), String(parent._id));
});
