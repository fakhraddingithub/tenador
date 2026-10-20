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

  const ids = async (b, c) => (await getBrandCategoryArticleBlocks(b, c)).top.map((x) => x.id);
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

  assert.deepEqual((await getBrandCategoryArticleBlocks(created._id, racket)).top.map((x) => x.id), ["r2"]);
  assert.deepEqual(
    (await getBrandCategoryArticleBlocks(created._id, bag)).top,
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

  assert.deepEqual((await getSerieArticleBlocks(parent._id)).top.map((x) => x.id), ["parent"]);
  assert.deepEqual((await getSerieArticleBlocks(String(child._id))).top, [], "child does not inherit");
  assert.deepEqual((await getSerieArticleBlocks(other._id)).top.map((x) => x.id), ["tour"]);
  assert.deepEqual(await getSerieArticleBlocks(null), { top: [], bottom: [] });

  const listed = await Serie.find({ brand: brand._id }).lean();
  assert.ok(listed.every((s) => !("articleBlocks" in s)), "lists never carry the blocks");

  // A serie save that does not touch articleBlocks keeps them.
  const doc = await Serie.findById(parent._id);
  doc.title = "پرو ۲";
  await doc.save();
  assert.deepEqual((await getSerieArticleBlocks(parent._id)).top.map((x) => x.id), ["parent"]);
});

/* ── brand brochure ────────────────────────────────────────────────────── */

test("brochure: only a published one with blocks is public; a draft never is", async () => {
  const { getPublishedBrandBrochure } = await import("base/services/miniArticle.service");
  const brand = await Brand.create({
    name: "Head", title: "هد",
    articleBlocks: [block("legacy-mini")], // the old mini article must survive untouched
    brochure: { status: "draft", blocks: [block("draft-1")] },
  });

  assert.equal(await getPublishedBrandBrochure(brand._id), null, "draft is never public");
  await Brand.updateOne({ _id: brand._id }, { $set: { "brochure.status": "published" } });
  assert.deepEqual((await getPublishedBrandBrochure(brand._id)).map((b) => b.id), ["draft-1"]);
  assert.deepEqual(await getPublishedBrandBrochure(String(brand._id)), (await getPublishedBrandBrochure(brand._id)));

  // published but empty is not "live" — the brand page must stay as it is
  await Brand.updateOne({ _id: brand._id }, { $set: { "brochure.blocks": [] } });
  assert.equal(await getPublishedBrandBrochure(brand._id), null);
  assert.equal(await getPublishedBrandBrochure(new mongoose.Types.ObjectId()), null, "brand without a brochure");
  assert.equal(await getPublishedBrandBrochure("nonsense"), null);

  const kept = await Brand.findById(brand._id).lean();
  assert.deepEqual(kept.articleBlocks.map((b) => b.id), ["legacy-mini"], "mini article data is never touched");
  assert.equal("brochure" in kept, false, "brochure is select:false like the other block fields");
});

test("brochure: sanitiser keeps only the two statuses and runs blocks through the article rules", async () => {
  const { sanitizeBrandBrochure, isBrochureLive } = await import("@/lib/brandBrochure");
  const errors = {};
  const clean = sanitizeBrandBrochure({ status: "published", blocks: [block("a")] }, errors);
  assert.deepEqual(errors, {});
  assert.equal(clean.status, "published");
  assert.deepEqual(clean.blocks.map((b) => b.id), ["a"]);
  assert.ok(clean.updatedAt instanceof Date);

  const bad = {};
  assert.equal(sanitizeBrandBrochure({ status: "archived", blocks: [] }, bad).status, "draft", "unknown status falls back to draft");
  assert.ok(bad.status);
  const blockErrors = {};
  sanitizeBrandBrochure({ status: "draft", blocks: [{ id: "x", type: "button", data: { href: "javascript:alert(1)" } }] }, blockErrors);
  assert.ok(blockErrors["blocks.0.data.href"], "children get the same validation as article blocks");
  assert.deepEqual(sanitizeBrandBrochure(null, {}).blocks, []);

  assert.equal(isBrochureLive({ status: "published", blocks: [block("a")] }), true);
  for (const value of [null, undefined, { status: "draft", blocks: [block("a")] }, { status: "published", blocks: [] }]) {
    assert.equal(isBrochureLive(value), false, JSON.stringify(value));
  }
});

/* ── sport brochure: the same system, owned by a sport ─────────────────── */

test("sport brochure: same rules as the brand's — draft never public, empty never live", async () => {
  const { default: Sport } = await import("base/models/Sport");
  const { getPublishedSportBrochure } = await import("base/services/miniArticle.service");

  // a sport created before this feature has no brochure at all, and reads as such
  const plain = await Sport.create({ name: "squash", title: "اسکواش" });
  assert.equal(await getPublishedSportBrochure(plain._id), null);
  assert.equal("brochure" in (await Sport.findById(plain._id).lean()), false);
  assert.equal("brochure" in (await Sport.findById(plain._id).select("+brochure").lean()), false, "nothing is written for an existing sport");

  const sport = await Sport.create({ name: "tennis", title: "تنیس", brochure: { status: "draft", blocks: [block("s-1")] } });
  assert.equal(await getPublishedSportBrochure(sport._id), null, "draft is never public");
  await Sport.updateOne({ _id: sport._id }, { $set: { "brochure.status": "published" } });
  assert.deepEqual((await getPublishedSportBrochure(sport._id)).map((b) => b.id), ["s-1"]);
  assert.deepEqual(await getPublishedSportBrochure(String(sport._id)), await getPublishedSportBrochure(sport._id));

  // select:false — the page context, navbar and the public GET never carry it
  assert.equal("brochure" in (await Sport.findOne({ slug: sport.slug }).lean()), false);

  // the sport form's PUT loads the sport *without* the brochure and saves it;
  // that must never erase the brochure (unselected paths are not written)
  const edited = await Sport.findById(sport._id);
  edited.title = "تنیس خاکی";
  await edited.save();
  assert.deepEqual((await getPublishedSportBrochure(sport._id)).map((b) => b.id), ["s-1"]);

  await Sport.updateOne({ _id: sport._id }, { $set: { "brochure.blocks": [] } });
  assert.equal(await getPublishedSportBrochure(sport._id), null, "published but empty keeps the product page");
  assert.equal(await getPublishedSportBrochure(new mongoose.Types.ObjectId()), null);
  assert.equal(await getPublishedSportBrochure("nonsense"), null);

  // a sport brochure is never read as a brand brochure, and vice versa
  const { getPublishedBrandBrochure } = await import("base/services/miniArticle.service");
  await Sport.updateOne({ _id: sport._id }, { $set: { "brochure.blocks": [block("s-2")] } });
  assert.equal(await getPublishedBrandBrochure(sport._id), null);
});

test("sport brochure: the card status, the shared schema and the owner registry", async () => {
  const { brochureStatusOf } = await import("@/lib/brandBrochure");
  assert.equal(brochureStatusOf(undefined), null);
  assert.equal(brochureStatusOf({ status: "published", blocks: [] }), null, "no blocks → «بدون بروشور»");
  assert.equal(brochureStatusOf({ status: "draft", blocks: [block("a")] }), "draft");
  assert.equal(brochureStatusOf({ status: "published", blocks: [block("a")] }), "published");

  const { default: Sport } = await import("base/models/Sport");
  const { BrochureSchema } = await import("base/models/articleSchemas");
  assert.equal(Sport.schema.path("brochure").schema, BrochureSchema, "sport uses the brand's brochure schema");
  assert.equal(Brand.schema.path("brochure").schema, BrochureSchema);
  assert.equal(Sport.schema.path("brochure").options.select, false);

  const { BROCHURE_OWNERS } = await import("@/lib/brochureOwners");
  assert.deepEqual(
    ["api", "editor", "preview", "back"].map((key) => BROCHURE_OWNERS.sport[key]("s1")),
    ["/api/sports/s1/brochure", "/p-admin/admin-sports/s1/brochure", "/p-admin/admin-sports/s1/brochure/preview", "/p-admin/admin-sports/edit/s1"],
  );
  assert.equal(BROCHURE_OWNERS.sport.permission, "sports.edit");
  assert.equal(BROCHURE_OWNERS.brand.api("b1"), "/api/brands/b1/brochure", "the brand's URLs are unchanged");
});

test("sport brochure: wiring — routes, admin pages, edit form and the public sport page", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

  // one implementation for both API routes, each behind its owner's edit key
  for (const [file, model, permission] of [
    ["../src/app/api/brands/[brandId]/brochure/route.js", "Brand", "brands.edit"],
    ["../src/app/api/sports/[sportId]/brochure/route.js", "Sport", "sports.edit"],
  ]) {
    const src = await read(file);
    assert.match(src, /brochureRouteHandlers\(\{/, file);
    assert.match(src, new RegExp(`Model: ${model},`), file);
    assert.match(src, new RegExp(`permission: "${permission}",`), file);
    assert.match(src, /export const GET = handlers\.GET;/, file);
    assert.match(src, /export const PUT = handlers\.PUT;/, file);
  }
  const shared = await read("../src/lib/brochureRoute.js");
  assert.match(shared, /await requireAdminPermission\(permission\);/);
  assert.equal((shared.match(/await requireAdminPermission\(permission\);/g) || []).length, 2, "GET and PUT are both gated");
  assert.match(shared, /await purgeSportPagesCdn\(\);/, "/[sport] is CDN-cached; a save must purge it");

  // the sport GET exposes only the status, never the blocks
  const sportGet = await read("../src/app/api/sports/[sportId]/route.js");
  assert.match(sportGet, /const brochureStatus = brochureStatusOf\(sport\.brochure\);\s*\r?\n\s*sport\.brochure = undefined;/);

  const { ADMIN_ROUTE_PERMISSIONS } = await import("@/lib/permissions");
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-sports/[sportId]/brochure"], ["sports.edit"]);
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-sports/[sportId]/brochure/preview"], ["sports.edit"]);

  const edit = await read("../src/app/(Admin-Panel)/p-admin/admin-sports/edit/[sportId]/page.jsx");
  assert.match(edit, /<BrochureCard\s*\r?\n\s*owner="sport"\s*\r?\n\s*ownerId=\{sportId\}\s*\r?\n\s*status=\{brochureStatus\}/);
  assert.match(edit, /setBrochureStatus\(data\.brochureStatus \|\| null\);/);

  // the published brochure is checked before any listing work, and renders with
  // the brand brochure's own component; without one the listing path is untouched
  const page = await read("../src/app/(Site)/(sports)/[sportSlug]/page.jsx");
  const brochureAt = page.indexOf("await getPublishedSportBrochure(ctx.filters.sport._id)");
  const listingAt = page.indexOf("getPageDataBySlug(sportSlug, targetAudience"); // prefix: pagination added an offset argument
  assert.ok(brochureAt > 0 && brochureAt < listingAt, "brochure check runs before the product listing");
  assert.match(page.slice(brochureAt, listingAt), /import\("@\/components\/features\/brands\/BrandBrochure"\)/);
  assert.match(page.slice(brochureAt, listingAt), /canonical=\{`\$\{SITE_URL\}\/\$\{sportSlug\}`\}/);
});
