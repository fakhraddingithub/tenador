/**
 * tests/miniArticles.test.mjs
 *
 * Brand+category and serie mini articles, against a real mongod and the real
 * Brand/Serie schemas: each page gets exactly its own article, nothing leaks
 * into the many other places that load brands/series (select:false), a save
 * that doesn't mention the articles never erases them, and deleting a
 * category removes only that category's article.
 */
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./miniArticlesHooks.mjs", import.meta.url);
// configs/db.js reads this at import time; the real connection is injected below.
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri("mini-articles"));
  // configs/db.js captured this object at import time — mutate, don't replace.
  global._mongooseCache.conn = mongoose;
});
after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

const { default: Brand } = await import("base/models/Brand");
const { default: Serie } = await import("base/models/Serie");
const { default: Category } = await import("base/models/Category");
const { default: Product } = await import("base/models/Product");
const { default: Variant } = await import("base/models/Variant");
const { default: PriceCache } = await import("base/models/PriceCache");
const { default: SlugRegistery } = await import("base/models/SlugRegistery");
const { sanitizeBrandCategoryArticles, findMissingCategoryIds } = await import("@/lib/brandCategoryArticles");
const { getBrandCategoryArticleBlocks, getSerieArticleBlocks } = await import("base/services/miniArticle.service");
const { deleteCategoryWithProducts } = await import("base/services/categoryDeletion");

const block = (id, text = id) => ({ id, type: "paragraph", data: { text } });
const oid = () => new mongoose.Types.ObjectId();

beforeEach(async () => {
  for (const name of ["brands", "series", "categories"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

async function seedCategories(...slugs) {
  const docs = slugs.map((slug) => ({ _id: oid(), slug, title: slug, sport: oid() }));
  await mongoose.connection.db.collection("categories").insertMany(docs);
  return docs.map((doc) => doc._id);
}

/* ── sanitizer ─────────────────────────────────────────────────────────── */

test("sanitizer: rejects duplicate and invalid categories, drops empty entries, prefixes block errors", () => {
  const a = String(oid());
  const errors = {};
  const out = sanitizeBrandCategoryArticles([
    { category: a, blocks: [block("x")] },
    { category: a, blocks: [block("y")] },
    { category: "nope", blocks: [block("z")] },
    { category: String(oid()), blocks: [] },
    { category: { _id: String(oid()) }, blocks: [{ id: "", type: "paragraph", data: {} }] },
  ], errors);

  assert.equal(errors["categoryArticles.1.category"] !== undefined, true, "duplicate");
  assert.equal(errors["categoryArticles.2.category"] !== undefined, true, "invalid id");
  assert.equal(errors["categoryArticles.4.blocks.0.id"] !== undefined, true, "block error prefixed");
  assert.equal(errors["categoryArticles.3.category"], undefined, "empty entry is not an error");
  assert.deepEqual(out.map((entry) => entry.category), [a, out[1].category]);
  assert.equal(out.length, 2, "empty-blocks entry dropped");

  const notArray = {};
  assert.deepEqual(sanitizeBrandCategoryArticles("x", notArray), []);
  assert.ok(notArray.categoryArticles);

  const ok = {};
  assert.deepEqual(sanitizeBrandCategoryArticles([], ok), []);
  assert.deepEqual(ok, {});
});

test("findMissingCategoryIds reports only ids with no category document", async () => {
  const [racket] = await seedCategories("racket");
  const ghost = String(oid());
  assert.deepEqual(
    await findMissingCategoryIds(Category, [{ category: String(racket) }, { category: ghost }]),
    [ghost],
  );
});

/* ── brand + category ──────────────────────────────────────────────────── */

test("each brand+category page gets only its own article", async () => {
  const [racket, bag, shoe] = await seedCategories("racket", "bag", "shoe");
  const wilson = await Brand.create({
    name: "Wilson", title: "ویلسون",
    articleBlocks: [block("brand-root")],
    categoryArticles: [
      { category: racket, blocks: [block("w-racket")] },
      { category: bag, blocks: [block("w-bag")] },
    ],
  });
  const head = await Brand.create({
    name: "Head", title: "هد",
    categoryArticles: [{ category: racket, blocks: [block("h-racket")] }],
  });

  const ids = async (b, c) => (await getBrandCategoryArticleBlocks(b, c)).map((x) => x.id);
  assert.deepEqual(await ids(wilson._id, racket), ["w-racket"]);
  assert.deepEqual(await ids(String(wilson._id), String(bag)), ["w-bag"], "string ids from JSON-serialized filters");
  assert.deepEqual(await ids(head._id, racket), ["h-racket"]);
  assert.deepEqual(await ids(wilson._id, shoe), [], "category without an article");
  assert.deepEqual(await ids(head._id, bag), [], "another brand's category never leaks");
  assert.deepEqual(await ids(wilson._id, null), [], "/[sport]/[brand] has no category");
  assert.deepEqual(await ids("bad", racket), []);
});

test("categoryArticles is select:false — ordinary brand reads never carry it", async () => {
  const [racket] = await seedCategories("racket");
  const brand = await Brand.create({
    name: "Babolat", title: "بابولات",
    articleBlocks: [block("root")],
    categoryArticles: [{ category: racket, blocks: [block("c")] }],
  });

  const plain = await Brand.findOne({ slug: brand.slug }).lean();
  assert.equal("categoryArticles" in plain, false);
  assert.equal(plain.articleBlocks[0].id, "root", "root brand article unchanged");

  const admin = await Brand.findById(brand._id).select("+categoryArticles").lean();
  assert.equal(admin.categoryArticles.length, 1);
  assert.equal("_id" in admin.categoryArticles[0], false, "category is the identity; no subdoc _id");
});

test("a save that does not touch categoryArticles preserves them (PUT without the key)", async () => {
  const [racket] = await seedCategories("racket");
  const created = await Brand.create({
    name: "Yonex", title: "یونکس",
    categoryArticles: [{ category: racket, blocks: [block("keep")] }],
  });

  const doc = await Brand.findById(created._id); // same as PUT: loaded without the field
  doc.title = "یونکس ۲";
  doc.articleBlocks = [block("new-root")];
  await doc.save();

  const after = await Brand.findById(created._id).select("+categoryArticles").lean();
  assert.equal(after.title, "یونکس ۲");
  assert.deepEqual(after.categoryArticles.map((e) => e.blocks[0].id), ["keep"]);
});

test("editing one category's article leaves the others byte-identical", async () => {
  const [racket, bag] = await seedCategories("racket", "bag");
  const created = await Brand.create({
    name: "Prince", title: "پرینس",
    categoryArticles: [
      { category: racket, blocks: [block("r1")] },
      { category: bag, blocks: [block("b1")] },
    ],
  });

  // What the admin page sends back: the whole array, one entry edited.
  const loaded = await Brand.findById(created._id).select("+categoryArticles").lean();
  const payload = JSON.parse(JSON.stringify(loaded.categoryArticles));
  payload[0].blocks = [block("r2")];
  const errors = {};
  const doc = await Brand.findById(created._id);
  doc.categoryArticles = sanitizeBrandCategoryArticles(payload, errors);
  assert.deepEqual(errors, {});
  await doc.save();

  assert.deepEqual((await getBrandCategoryArticleBlocks(created._id, racket)).map((x) => x.id), ["r2"]);
  assert.deepEqual(
    await getBrandCategoryArticleBlocks(created._id, bag),
    loaded.categoryArticles[1].blocks,
  );
});

test("deleting a category pulls only that category's article from every brand", async () => {
  const [racket, bag] = await seedCategories("racket", "bag");
  const a = await Brand.create({
    name: "Tecnifibre", title: "تکنیفایبر",
    categoryArticles: [{ category: racket, blocks: [block("a-r")] }, { category: bag, blocks: [block("a-b")] }],
  });
  const b = await Brand.create({
    name: "Dunlop", title: "دانلوپ",
    categoryArticles: [{ category: racket, blocks: [block("b-r")] }],
  });

  await deleteCategoryWithProducts({
    Category, Product, Variant, PriceCache, SlugRegistery, Brand,
    categoryId: racket, confirmationSlug: "racket",
  });

  const left = async (id) =>
    (await Brand.findById(id).select("+categoryArticles").lean()).categoryArticles.map((e) => e.blocks[0].id);
  assert.deepEqual(await left(a._id), ["a-b"]);
  assert.deepEqual(await left(b._id), []);
});

/* ── serie ─────────────────────────────────────────────────────────────── */

test("serie article: own page only, parent and child independent, select:false elsewhere", async () => {
  const brand = await Brand.create({ name: "Artengo", title: "آرتنگو" });
  const parent = await Serie.create({
    name: "Pro", title: "پرو", brand: brand._id, articleBlocks: [block("parent")],
  });
  const child = await Serie.create({ name: "Pro Lite", title: "پرو لایت", brand: brand._id, parentSerie: parent._id });
  const other = await Serie.create({ name: "Tour", title: "تور", brand: brand._id, articleBlocks: [block("tour")] });

  assert.deepEqual((await getSerieArticleBlocks(parent._id)).map((x) => x.id), ["parent"]);
  assert.deepEqual(await getSerieArticleBlocks(String(child._id)), [], "child does not inherit");
  assert.deepEqual((await getSerieArticleBlocks(other._id)).map((x) => x.id), ["tour"]);
  assert.deepEqual(await getSerieArticleBlocks(null), []);

  const listed = await Serie.find({ brand: brand._id }).lean();
  assert.ok(listed.every((s) => !("articleBlocks" in s)), "lists never carry the blocks");

  // A serie save that does not touch articleBlocks keeps them.
  const doc = await Serie.findById(parent._id);
  doc.title = "پرو ۲";
  await doc.save();
  assert.deepEqual((await getSerieArticleBlocks(parent._id)).map((x) => x.id), ["parent"]);
});
