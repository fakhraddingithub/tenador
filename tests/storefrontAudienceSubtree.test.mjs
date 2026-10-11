import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
mongoose.set("autoIndex", false);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

const { getProductListingPage } = await import("base/services/productListing.service");
const { getListingFilterOptions, buildCategoryAttributeMatch } = await import("base/services/listingFilterCatalog.service");
const { getBrandGroupedSections } = await import("base/services/brandGrouped.service");
const { getSerieGroupedSections } = await import("base/services/serieGrouped.service");
const { resolvePageContext, queryBySlugs } = await import("base/services/query.service");
const { getCachedNavbar } = await import("@/lib/navbarService");
const { filterNavDataByAudience } = await import("@/lib/navbarAudience");
const { mergeAttributeMeta, productMatchesAttrFilters } = await import("@/lib/attributeFilters");
const { collectCategorySubtree, filterCategoriesBySelection, selectedCategoryIds } = await import("base/utils/categorySubtree");
const { default: Product } = await import("base/models/Product");

const id = () => new mongoose.Types.ObjectId();
const sport = id(), otherSport = id(), brand = id(), kidsBrand = id();
const parent = id(), branch = id(), leaf = id(), shared = id(), unrelated = id(), kidsOnly = id();
const series = id(), subseries = id();
const scope = { sportId: String(sport), categoryId: String(parent) };
const names = (data) => data.products.map((p) => p.name);
const groupedNames = (data) => data.sections.flatMap((s) => names(s));
let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  global._mongooseCache.conn = mongoose;
  const db = mongoose.connection.db;
  await db.collection("sports").insertMany([
    { _id: sport, slug: "tennis", title: "تنیس" },
    { _id: otherSport, slug: "padel", title: "پدل" },
  ]);
  await db.collection("brands").insertMany([
    { _id: brand, slug: "wilson", title: "ویلسون" },
    { _id: kidsBrand, slug: "junior", title: "جونیور" },
  ]);
  const category = (_id, slug, parentId, attributes = [], extra = {}) => ({
    _id, slug, title: slug, sport, parent: parentId, attributes, ...extra,
  });
  await db.collection("categories").insertMany([
    category(parent, "accessories", null, [{ name: "Length", filterable: true }]),
    category(branch, "bags", parent),
    category(leaf, "backpacks", branch, [{ name: "Capacity", filterable: true }, { name: "Color", filterable: true }]),
    category(shared, "grips", parent, [{ name: "Size", filterable: true }], { additionalSports: [otherSport] }),
    category(unrelated, "rackets", null),
    category(kidsOnly, "junior-bags", parent, [{ name: "JuniorSize", filterable: true }]),
  ]);
  await db.collection("series").insertMany([
    { _id: series, brand, slug: "blade", title: "Blade", level: 0 },
    { _id: subseries, brand, slug: "blade-v1", parentSerie: series, title: "Blade V1", level: 1 },
  ]);
  const product = (name, categoryId, targetAudience, extra = {}) => ({
    _id: id(), name, slug: name, sport, brand, category: categoryId,
    targetAudience, serie: subseries, isActive: true, order: 0,
    basePrice: 100, variants: [], ...extra,
  });
  await db.collection("products").insertMany([
    ...Array.from({ length: 25 }, (_, i) => product(`adult-${i}`, leaf, "یونی سکس", {
      order: i + 1, attributes: { Capacity: i === 24 ? "30" : "20", Color: "آبی" },
    })),
    product("direct-parent", parent, "مردانه", { attributes: { Length: 10 } }),
    product("woman", leaf, "زنانه"),
    product("legacy", leaf, "همه"),
    product("unclassified", leaf, null),
    product("shared-sport", shared, "یونی سکس", { sport: otherSport, attributes: { Size: 2 } }),
    product("child-kids", leaf, "بچگانه", { attributes: { Capacity: "kid-only" } }),
    product("parent-kids", parent, "بچگانه"),
    product("kids-only", kidsOnly, "بچگانه", { brand: kidsBrand, attributes: { JuniorSize: "small" } }),
    product("unrelated", unrelated, "مردانه"),
    product("wrong-sport", leaf, "مردانه", { sport: otherSport }),
    product("inactive", leaf, "یونی سکس", { isActive: false }),
  ]);
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });

test("default parent listing includes own products and all descendant levels, never kids or unrelated sports", async () => {
  const page = await getProductListingPage({ filter: { sport, category: parent }, limit: 60 });
  assert.equal(page.totalResults, 30);
  assert.ok(names(page).includes("direct-parent"));
  assert.ok(names(page).includes("shared-sport"));
  for (const name of ["parent-kids", "child-kids", "kids-only", "unrelated", "wrong-sport", "inactive"]) {
    assert.equal(names(page).includes(name), false, name);
  }
});

test("pagination applies the identical subtree and audience before counting and slicing", async () => {
  const filter = { sport, category: parent };
  const first = await getProductListingPage({ filter, limit: 20 });
  const second = await getProductListingPage({ filter, offset: 20, limit: 20 });
  assert.equal(first.hasMore, true);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...names(first), ...names(second)]).size, 30);
  assert.equal(first.totalResults, second.totalResults);
});

test("kids are explicit, while men/women still include unisex and legacy all", async () => {
  const get = (targetAudience) => getProductListingPage({ filter: { sport, category: parent, targetAudience }, limit: 60 });
  assert.deepEqual(names(await get("بچگانه")).sort(), ["child-kids", "kids-only", "parent-kids"]);
  assert.equal((await get("مردانه")).totalResults, 28);
  assert.equal((await get("زنانه")).totalResults, 28);
  assert.equal((await get("یونی سکس")).totalResults, 27);
  await assert.rejects(get("invalid"), TypeError);
});

test("structural parents with no direct products resolve with brand and return descendants", async () => {
  const ctx = await resolvePageContext(["tennis", "bags", "wilson"], { includeBrandStats: false });
  assert.equal(ctx.notFound, false);
  const page = await queryBySlugs(["tennis", "bags"], null, { targetAudience: "بچگانه" });
  assert.equal(page.totalResults, 1);
  assert.equal(page.results[0].name, "child-kids");
});

test("filter catalog includes deep attributes and structural selections from the whole listing", async () => {
  const categories = await getListingFilterOptions(scope);
  const meta = mergeAttributeMeta(categories);
  assert.ok(meta.find((m) => m.name === "Capacity").options.some((v) => v.value === "30"));
  assert.equal(meta.some((m) => m.name === "JuniorSize"), false);
  assert.equal(meta.find((m) => m.name === "Capacity").options.some((v) => v.value === "kid-only"), false);
  assert.deepEqual(selectedCategoryIds(categories, [String(branch)]), [String(leaf)]);
  const active = filterCategoriesBySelection(categories, [String(branch)]);
  assert.deepEqual(mergeAttributeMeta(active).map((m) => m.name), ["Capacity", "Color"]);
  const query = await buildCategoryAttributeMatch(scope, [String(branch)], { Capacity: ["30"], Color: ["آبی"] });
  assert.equal(await Product.countDocuments(query), 1);
  const clientProduct = await Product.findOne(query).lean();
  assert.equal(productMatchesAttrFilters(clientProduct, { Capacity: ["30"] }, mergeAttributeMeta(active)), true);
});

test("brand parent page intersects subtree, selected descendants, attributes, price and search", async () => {
  const base = { ...scope, brandId: String(brand), withIndex: true };
  const filtered = await getBrandGroupedSections({ ...base, categoryIds: [String(branch)], categoryAttributes: { Capacity: ["30"] }, search: "adult", minPrice: 90, maxPrice: 110 });
  assert.equal(filtered.totalCount, 1);
  assert.deepEqual(groupedNames(filtered), ["adult-24"]);
  assert.equal((await getBrandGroupedSections({ ...base, categoryIds: [String(unrelated)] })).totalCount, 0);
  const kids = await getBrandGroupedSections({ ...base, targetAudience: "بچگانه" });
  assert.deepEqual(groupedNames(kids).sort(), ["child-kids", "parent-kids"]);
  assert.equal((await getBrandGroupedSections({ ...base, categoryIds: [String(branch)], categoryAttributes: { Capacity: ["999"] } })).totalCount, 0);
});

test("root series and subseries follow the same explicit kids rule", async () => {
  const base = { serieId: String(series), sportId: String(sport), withIndex: true };
  const normal = await getSerieGroupedSections(base);
  assert.equal(groupedNames(normal).some((name) => name.includes("kids")), false);
  const kids = await getSerieGroupedSections({ ...base, targetAudience: "بچگانه" });
  assert.ok(groupedNames(kids).includes("child-kids"));
  assert.equal(groupedNames(kids).some((name) => name.startsWith("adult")), false);
  const sub = await getProductListingPage({ filter: { sport, serie: subseries, targetAudience: "بچگانه" } });
  assert.ok(names(sub).includes("child-kids"));
});

test("navbar keeps parents across audience modes and hides kids-only categories and brands in default", async () => {
  const nav = await getCachedNavbar();
  const other = nav.find((s) => s._id === String(otherSport));
  assert.equal(other.categories.some((c) => c._id === String(parent)), false,
    "a shared child must not create an invalid parent URL in another sport");
  const defaultSport = filterNavDataByAudience(nav, null).find((s) => s._id === String(sport));
  assert.equal(defaultSport.categories.some((c) => c._id === String(kidsOnly)), false);
  const parentNode = defaultSport.categories.find((c) => c._id === String(parent));
  assert.ok(parentNode);
  assert.equal(parentNode.brands.some((b) => b._id === String(kidsBrand)), false);
  const kidsSport = filterNavDataByAudience(nav, "بچگانه").find((s) => s._id === String(sport));
  assert.ok(kidsSport.categories.find((c) => c._id === String(branch)));
  assert.ok(kidsSport.categories.find((c) => c._id === String(parent)).brands.find((b) => b._id === String(kidsBrand)));
});

test("category traversal guards cycles and does not include unrelated branches", () => {
  const tree = [{ _id: "root", parent: "leaf" }, { _id: "leaf", parent: "root" }, { _id: "other" }];
  assert.deepEqual(collectCategorySubtree(tree, "root").map((c) => c._id), ["root", "leaf"]);
  assert.deepEqual(collectCategorySubtree(tree, "missing"), []);
});
