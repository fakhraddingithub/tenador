import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
mongoose.set("autoIndex", false);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";
const { getListingFilterOptions, buildCategoryAttributeMatch } = await import("base/services/listingFilterCatalog.service");
const { getBrandGroupedSections } = await import("base/services/brandGrouped.service");
const { getSerieGroupedSections } = await import("base/services/serieGrouped.service");
const { parseCategoryAttributes } = await import("@/lib/categoryFilterState");
const { default: Product } = await import("base/models/Product");
const id = () => new mongoose.Types.ObjectId();
const brand = id(), otherBrand = id(), sport = id(), otherSport = id(), racket = id(), shoes = id();
const root = id(), child = id(), secondRoot = id(), secondChild = id();
let server;
const scope = { brandId: String(brand), sportId: String(sport), categoryId: String(racket), targetAudience: null };
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  global._mongooseCache.conn = mongoose;
  const db = mongoose.connection.db;
  await db.collection("brands").insertMany([{ _id: brand, name: "Wilson", title: "ویلسون" }, { _id: otherBrand, name: "Head" }]);
  await db.collection("sports").insertMany([{ _id: sport, title: "تنیس" }, { _id: otherSport, title: "پدل" }]);
  await db.collection("categories").insertMany([
    { _id: racket, title: "راکت", sport, attributes: [{ name: "Weight", label: "وزن", filterable: true }, { name: "Color", filterable: true }, { name: "Hidden", filterable: false }] },
    { _id: shoes, title: "کفش", sport, attributes: [{ name: "Size", filterable: true }] },
  ]);
  await db.collection("series").insertMany([
    { _id: root, brand, title: "بلید", slug: "blade", level: 0, order: 0 },
    { _id: child, brand, title: "بلید ۱۰", parentSerie: root, level: 1, order: 0 },
    { _id: secondRoot, brand, title: "اولترا", slug: "ultra", level: 0, order: 1 },
    { _id: secondChild, brand, title: "بلید ۹", parentSerie: root, level: 1, order: 1 },
  ]);
  const products = Array.from({ length: 45 }, (_, i) => ({
    _id: id(), name: `Racket ${i}`, slug: `racket-${i}`, brand, sport, category: racket,
    serie: i < 25 ? child : secondRoot, isActive: true, order: i, basePrice: 100,
    attributes: { Weight: i % 2 ? "305" : 300, Color: i === 44 ? "قرمز" : "آبی", Hidden: "secret" },
    variants: [],
  }));
  products.push({ _id: id(), name: "Shoe", brand, sport, category: shoes, serie: secondChild, isActive: true, attributes: { Size: 42 } });
  products.push({ _id: id(), name: "Direct", brand, sport, category: racket, serie: root, isActive: true, attributes: { Weight: 300 } });
  products.push({ _id: id(), name: "Foreign", brand: otherBrand, sport, category: racket, serie: null, isActive: true, attributes: { Weight: 999 } });
  products.push({ _id: id(), name: "Inactive", brand, sport, category: racket, serie: child, isActive: false, attributes: { Weight: 888 } });
  await db.collection("products").insertMany(products);
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

test("options cover later batches, include only admin-enabled attributes and stay inside the scope", async () => {
  const options = await getListingFilterOptions(scope);
  assert.equal(options.length, 1);
  assert.deepEqual(options[0].attributeMeta.map((m) => m.name), ["Weight", "Color"]);
  assert.deepEqual(options[0].attributeMeta[0].options.map((o) => o.value), ["300", "305"]);
});

test("brand filtering finds a product beyond the initial batch while preserving the root group", async () => {
  const result = await getBrandGroupedSections({ ...scope, categoryAttributes: { Color: ["قرمز"] }, withIndex: true });
  assert.equal(result.totalCount, 1);
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].key, String(secondRoot));
  assert.equal(result.sections[0].products[0].name, "Racket 44");
});

test("AND across attributes, OR within one attribute, numeric strings and empty results", async () => {
  const query = await buildCategoryAttributeMatch(scope, racket, { Weight: ["300", "305"], Color: ["قرمز"] });
  assert.equal(await Product.countDocuments(query), 1);
  const empty = await getBrandGroupedSections({ ...scope, categoryAttributes: { Weight: ["305"], Color: ["قرمز"] }, withIndex: true });
  assert.equal(empty.totalCount, 0);
  assert.deepEqual(empty.sections, []);
  assert.equal(empty.hasMore, false);
});

test("filtered brand cursors neither skip nor repeat products", async () => {
  let offset = 0, productOffset = 0, more = true;
  const ids = [];
  for (let guard = 0; more && guard < 20; guard++) {
    const data = await getBrandGroupedSections({ ...scope, categoryAttributes: { Weight: ["300", "305"] }, offset, productOffset, productLimit: 7 });
    ids.push(...data.sections.flatMap((s) => s.products.map((p) => p._id)));
    offset = data.nextOffset; productOffset = data.nextProductOffset; more = data.hasMore;
  }
  assert.equal(more, false);
  assert.equal(ids.length, 46);
  assert.equal(new Set(ids).size, 46);
});

test("parent category and attributes filter child groups and direct products before counting", async () => {
  const base = { serieId: String(root), sportId: String(sport), withIndex: true };
  const categories = await getListingFilterOptions(base);
  assert.equal(categories.length, 2);
  const shoeResults = await getSerieGroupedSections({ ...base, categoryId: String(shoes), categoryAttributes: { Size: ["42"] } });
  assert.equal(shoeResults.totalCount, 1);
  assert.equal(shoeResults.sections[0].key, String(secondChild));
  const rackets = await getSerieGroupedSections({ ...base, categoryId: String(racket), categoryAttributes: { Weight: ["300"] }, limit: 1 });
  assert.equal(rackets.totalCount, 14);
  assert.equal(rackets.sections[0].key, String(child));
  assert.equal(rackets.hasMore, true);
  const next = await getSerieGroupedSections({ ...base, categoryId: String(racket), categoryAttributes: { Weight: ["300"] }, offset: rackets.nextOffset });
  assert.equal(next.sections[0].key, "__direct__");
  assert.equal(next.hasMore, false);
  const reset = await getSerieGroupedSections(base);
  assert.equal(reset.totalCount, 27);
});

test("subseries catalog includes only its own categories and products", async () => {
  const options = await getListingFilterOptions({ serieId: String(secondChild), sportId: String(sport), descendants: false });
  assert.equal(options.length, 1);
  assert.equal(options[0]._id, String(shoes));
  assert.deepEqual(options[0].attributeMeta[0].options, [{ value: "42", count: 1 }]);
});

test("malformed filter payloads are rejected", () => {
  for (const value of ['[]', 'null', '{', '{"Weight":{"$gt":0}}', '{"Weight":[5]}']) {
    assert.throws(() => parseCategoryAttributes(value));
  }
  assert.deepEqual([...parseCategoryAttributes('{"Weight":["300","300"]}').Weight], ["300"]);
});

test("category checkboxes scope several categories at once and merge their attributes", async () => {
  const base = { serieId: String(root), sportId: String(sport), withIndex: true };
  const both = { ...base, categoryIds: [String(racket), String(shoes)] };
  // هر دو دسته تیک خورده‌اند → همان نتیجه‌ی «بدون فیلتر»
  assert.equal((await getSerieGroupedSections(both)).totalCount, 27);
  // یک دسته → فقط محصولات همان دسته
  assert.equal((await getSerieGroupedSections({ ...base, categoryIds: [String(shoes)] })).totalCount, 1);
  // ویژگیِ یکی از دسته‌ها روی مجموعه‌ی ادغام‌شده هم اعمال می‌شود
  assert.equal(
    (await getSerieGroupedSections({ ...both, categoryAttributes: { Size: ["42"] } })).totalCount, 1);
  // بدونِ هیچ تیکی، ویژگی‌های همه‌ی دسته‌ها فعال‌اند (نه «هیچ‌کدام»)
  assert.equal(
    (await getSerieGroupedSections({ ...base, categoryAttributes: { Size: ["42"] } })).totalCount, 1);
  // categoryIdِ مسیر همچنان بر تیک‌ها مقدم است
  assert.equal(
    (await getSerieGroupedSections({ ...base, categoryId: String(racket), categoryIds: [String(shoes)] })).totalCount, 26);
});

test("mergeAttributeMeta unions options and falls back to text on a type clash", async () => {
  const { mergeAttributeMeta } = await import("@/lib/attributeFilters");
  const merged = mergeAttributeMeta([
    { attributeMeta: [{ name: "W", label: "وزن", type: "number", options: [{ value: "300", count: 2 }] }] },
    { attributeMeta: [{ name: "W", label: "وزن", type: "text", options: [{ value: "300", count: 1 }, { value: "سبک", count: 5 }] }] },
    { attributeMeta: [{ name: "S", label: "سایز", type: "number", options: [{ value: "42", count: 1 }] }] },
  ]);
  assert.deepEqual(merged.map((m) => m.name), ["W", "S"]);
  assert.equal(merged[0].type, "text");
  // متنی = مرتب بر اساس فراوانی (همان قراردادِ buildAttributeMeta)
  assert.deepEqual(merged[0].options, [{ value: "سبک", count: 5 }, { value: "300", count: 3 }]);
});
