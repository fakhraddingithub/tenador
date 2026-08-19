/**
 * tests/articleDeletionSafety.test.mjs
 *
 * مسیرهای «حذفِ دائمی» روی یک mongodِ واقعی. اینجا چیزی mock نمی‌شود: همان
 * توابعی اجرا می‌شوند که روت‌های ادمین صدا می‌زنند.
 *
 * چیزی که باید ثابت شود:
 *   ۱) یکتاییِ نامکِ دسته‌ی مقاله فقط داخلِ خودِ همین کالکشن است — نامکی که در
 *      brands/sports هست باید مجاز باشد، ولی نامکِ تکراریِ دسته رد شود.
 *   ۲) حذفِ دائمیِ دسته هرگز آبشاری نیست و با حتی یک مقاله (حتی در زباله‌دان)
 *      بسته است؛ دسته‌ی غیرِ آرشیو هم اصلاً حذف نمی‌شود.
 *   ۳) حذفِ دائمیِ مقاله فقط از زباله‌دان کار می‌کند و به مقاله‌های دیگر و به
 *      خودِ دسته دست نمی‌زند.
 *
 * اجرا: npm run test:article-deletion (یا مستقیم `node --test` روی همین فایل)
 */

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// اسمِ مستعارِ `base/*` و `@/*` باید *پیش از* ایمپورتِ ماژول‌های اپ ثبت شود؛
// چون importهای ثابت بالا کشیده می‌شوند، این چهار تا باید پویا بمانند.
register("./aliasHooks.mjs", import.meta.url);
const { default: Article } = await import("base/models/Article");
const { default: ArticleCategory } = await import("base/models/ArticleCategory");
const { default: ArticleRedirect } = await import("base/models/ArticleRedirect");
const { default: ArticleRevision } = await import("base/models/ArticleRevision");
const {
  assertArticleCategoryRouteAvailable,
  permanentlyDeleteArticle,
  permanentlyDeleteArticleCategory,
} = await import("base/services/article.service");

let replSet;
const AUTHOR = new mongoose.Types.ObjectId();

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "article-deletion" });
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([
    Article.deleteMany({}),
    ArticleCategory.deleteMany({}),
    ArticleRedirect.deleteMany({}),
    ArticleRevision.deleteMany({}),
    mongoose.connection.db.collection("brands").deleteMany({}),
    mongoose.connection.db.collection("sports").deleteMany({}),
  ]);
});

const makeCategory = (overrides = {}) =>
  ArticleCategory.create({ name: "دسته", slug: "guides", status: "active", ...overrides });

const makeArticle = (category, overrides = {}) =>
  Article.create({ title: "مقاله", slug: "an-article", category, author: AUTHOR, ...overrides });

/* ── ۱) یکتاییِ نامک ──────────────────────────────────────────────────── */

test("نامکی که در brands یا sports هست برای دسته‌ی مقاله مجاز است", async () => {
  // مستقیم روی درایور می‌نویسیم تا اعتبارسنجیِ اسکیمای Brand/Sport دخالت نکند؛
  // نکته‌ی تست این است که این دو کالکشن اصلاً خوانده نمی‌شوند.
  await mongoose.connection.db.collection("brands").insertOne({ slug: "wilson" });
  await mongoose.connection.db.collection("sports").insertOne({ slug: "tennis" });

  await assertArticleCategoryRouteAvailable("wilson");
  await assertArticleCategoryRouteAvailable("tennis");
});

test("نامکِ تکراریِ دسته‌ی مقاله همچنان رد می‌شود", async () => {
  await makeCategory({ slug: "guides" });
  await assert.rejects(() => assertArticleCategoryRouteAvailable("guides"), { name: "ValidationError" });
});

test("در ویرایش، خودِ سند از چکِ تکراری کنار گذاشته می‌شود", async () => {
  const category = await makeCategory({ slug: "guides" });
  await assertArticleCategoryRouteAvailable("guides", null, category._id);

  const other = await makeCategory({ name: "دیگر", slug: "reviews" });
  await assert.rejects(
    () => assertArticleCategoryRouteAvailable("guides", null, other._id),
    { name: "ValidationError" },
  );
});

test("نامکِ رزروشده‌ی روت‌های تنادور همچنان رد می‌شود", async () => {
  await assert.rejects(() => assertArticleCategoryRouteAvailable("products"), { name: "ValidationError" });
});

/* ── ۲) حذفِ دائمیِ دسته ──────────────────────────────────────────────── */

test("دسته‌ی آرشیوشده‌ی بدون مقاله حذف دائمی می‌شود", async () => {
  const category = await makeCategory({ status: "archived" });
  const result = await permanentlyDeleteArticleCategory(category._id);

  assert.equal(result.ok, true);
  assert.equal(await ArticleCategory.countDocuments({ _id: category._id }), 0);
});

test("دسته‌ی فعال بدون آرشیو شدن حذف دائمی نمی‌شود", async () => {
  const category = await makeCategory({ status: "active" });
  const result = await permanentlyDeleteArticleCategory(category._id);

  assert.equal(result.ok, false);
  assert.equal(result.code, "CATEGORY_NOT_ARCHIVED");
  assert.equal(await ArticleCategory.countDocuments({ _id: category._id }), 1);
});

test("دسته‌ی آرشیوشده‌ی دارای مقاله حذف نمی‌شود و مقاله هم دست‌نخورده می‌ماند", async () => {
  const category = await makeCategory({ status: "archived" });
  const article = await makeArticle(category._id);

  const result = await permanentlyDeleteArticleCategory(category._id);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CATEGORY_IN_USE");
  assert.equal(result.articleCount, 1);
  assert.equal(await ArticleCategory.countDocuments({ _id: category._id }), 1);
  assert.equal(await Article.countDocuments({ _id: article._id }), 1);
});

test("مقاله‌ی داخلِ زباله‌دان هم جلوی حذفِ دسته را می‌گیرد", async () => {
  // مقاله‌ی زباله‌دانی قابلِ بازیابی است؛ اگر دسته‌اش برود، بازیابی می‌شکند.
  const category = await makeCategory({ status: "archived" });
  await makeArticle(category._id, { status: "archived", deletedAt: new Date() });

  const result = await permanentlyDeleteArticleCategory(category._id);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CATEGORY_IN_USE");
});

test("دسته‌ای که زیرشاخه دارد حذف دائمی نمی‌شود", async () => {
  const parent = await makeCategory({ status: "archived" });
  await makeCategory({ name: "زیرشاخه", slug: "guides-child", parent: parent._id });

  const result = await permanentlyDeleteArticleCategory(parent._id);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CATEGORY_HAS_CHILDREN");
});

test("شناسه‌ی ناموجود ۴۰۴ می‌دهد، نه حذفِ خاموش", async () => {
  const result = await permanentlyDeleteArticleCategory(new mongoose.Types.ObjectId());
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

/* ── ۳) حذفِ دائمیِ مقاله ─────────────────────────────────────────────── */

test("مقاله‌ی زباله‌دان با نسخه‌ها و ریدایرکت‌هایش حذف می‌شود", async () => {
  const category = await makeCategory();
  const article = await makeArticle(category._id, { status: "archived", deletedAt: new Date() });
  await ArticleRevision.create({ article: article._id, revision: 1, snapshot: {}, reason: "x", createdBy: AUTHOR });
  await ArticleRedirect.create({ fromCategorySlug: "old", fromArticleSlug: "old-one", article: article._id });

  const removed = await permanentlyDeleteArticle(article._id);
  assert.ok(removed);
  assert.equal(await Article.countDocuments({ _id: article._id }), 0);
  assert.equal(await ArticleRevision.countDocuments({ article: article._id }), 0);
  assert.equal(await ArticleRedirect.countDocuments({ article: article._id }), 0);
  // دسته هرگز آبشاری حذف نمی‌شود
  assert.equal(await ArticleCategory.countDocuments({ _id: category._id }), 1);
});

test("مقاله‌ای که در زباله‌دان نیست حذف دائمی نمی‌شود", async () => {
  const category = await makeCategory();
  const article = await makeArticle(category._id, { status: "published" });

  assert.equal(await permanentlyDeleteArticle(article._id), null);
  assert.equal(await Article.countDocuments({ _id: article._id }), 1);
});

test("حذفِ دائمی به مقاله‌های دیگر دست نمی‌زند", async () => {
  const category = await makeCategory();
  const trashed = await makeArticle(category._id, { slug: "gone", deletedAt: new Date() });
  const kept = await makeArticle(category._id, { slug: "kept" });
  const keptRevision = await ArticleRevision.create({ article: kept._id, revision: 1, snapshot: {}, reason: "x", createdBy: AUTHOR });

  await permanentlyDeleteArticle(trashed._id);
  assert.equal(await Article.countDocuments({ _id: kept._id }), 1);
  assert.equal(await ArticleRevision.countDocuments({ _id: keptRevision._id }), 1);
});
