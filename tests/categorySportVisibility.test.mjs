import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  andMongoFilters,
  buildCategoryProductSportMatch,
  buildCategorySportMatch,
  buildProductSportMatch,
  categorySupportsSport,
  getCategorySportIds,
  normalizeSportIds,
} from "../utils/categorySportVisibility.js";

test("legacy categories remain owner-sport only and shared categories opt in", () => {
  const tennis = new ObjectId();
  const padel = new ObjectId();
  const legacy = { sport: tennis };
  const shared = { sport: tennis, additionalSports: [padel] };

  assert.equal(categorySupportsSport(legacy, tennis), true);
  assert.equal(categorySupportsSport(legacy, padel), false);
  assert.equal(categorySupportsSport(shared, padel), true);
  assert.deepEqual(getCategorySportIds(shared), [String(tennis), String(padel)]);
});

test("additional sport payload normalization is ordered and backward-compatible", () => {
  const first = new ObjectId();
  const second = new ObjectId();

  assert.deepEqual(normalizeSportIds(undefined), []);
  assert.deepEqual(normalizeSportIds(null), []);
  assert.equal(normalizeSportIds("invalid"), null);
  assert.deepEqual(
    normalizeSportIds([first, { _id: second }, first, ""]),
    [String(first), String(second)],
  );
});

test("generated Mongo filters preserve legacy and shared storefront visibility", async (t) => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  await client.connect();
  t.after(async () => {
    await client.close();
    await server.stop();
  });

  const products = client.db("visibility").collection("products");
  const tennis = new ObjectId();
  const padel = new ObjectId();
  const squash = new ObjectId();
  const legacyCategory = new ObjectId();
  const sharedCategory = new ObjectId();

  await products.insertMany([
    { name: "legacy-tennis", sport: tennis, category: legacyCategory, isActive: true },
    { name: "legacy-mismatch", sport: padel, category: legacyCategory, isActive: true },
    { name: "shared-tennis", sport: tennis, category: sharedCategory, isActive: true },
    { name: "shared-padel", sport: padel, category: sharedCategory, isActive: true },
  ]);

  const legacy = { _id: legacyCategory, sport: tennis, additionalSports: [] };
  const shared = { _id: sharedCategory, sport: tennis, additionalSports: [padel] };

  const legacyCategoryFilter = andMongoFilters(
    { category: legacyCategory, isActive: true },
    buildCategoryProductSportMatch(legacy, tennis),
  );
  assert.deepEqual(
    (await products.find(legacyCategoryFilter).toArray()).map((p) => p.name),
    ["legacy-tennis"],
  );

  const sharedPadelFilter = andMongoFilters(
    { category: sharedCategory, isActive: true },
    buildCategoryProductSportMatch(shared, padel),
  );
  assert.deepEqual(
    (await products.find(sharedPadelFilter).sort({ name: 1 }).toArray()).map((p) => p.name),
    ["shared-padel", "shared-tennis"],
  );

  const padelRootFilter = andMongoFilters(
    { isActive: true },
    buildProductSportMatch(padel, [sharedCategory]),
  );
  assert.deepEqual(
    (await products.find(padelRootFilter).sort({ name: 1 }).toArray()).map((p) => p.name),
    ["legacy-mismatch", "shared-padel", "shared-tennis"],
  );

  const squashRootFilter = andMongoFilters(
    { isActive: true },
    buildProductSportMatch(squash, []),
  );
  assert.equal(await products.countDocuments(squashRootFilter), 0);
});

test("category route matching accepts owner and explicitly selected sports only", async (t) => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  await client.connect();
  t.after(async () => {
    await client.close();
    await server.stop();
  });

  const categories = client.db("visibility").collection("categories");
  const tennis = new ObjectId();
  const padel = new ObjectId();
  const squash = new ObjectId();
  await categories.insertOne({
    slug: "protection-tape",
    sport: tennis,
    additionalSports: [padel],
  });

  assert.ok(await categories.findOne({ slug: "protection-tape", ...buildCategorySportMatch(tennis) }));
  assert.ok(await categories.findOne({ slug: "protection-tape", ...buildCategorySportMatch(padel) }));
  assert.equal(
    await categories.findOne({ slug: "protection-tape", ...buildCategorySportMatch(squash) }),
    null,
  );
});

test("andMongoFilters keeps two independent $or clauses", () => {
  const combined = andMongoFilters(
    { $or: [{ brand: "a" }, { brand: "b" }] },
    { $or: [{ sport: "x" }, { category: "y" }] },
  );

  assert.equal(combined.$and.length, 2);
  assert.equal(combined.$and[0].$or.length, 2);
  assert.equal(combined.$and[1].$or.length, 2);
});

test("shared sport pagination uses both ordered indexes at scale", async (t) => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  await client.connect();
  t.after(async () => {
    await client.close();
    await server.stop();
  });

  const products = client.db("visibility-scale").collection("products");
  await Promise.all([
    products.createIndex({ isActive: 1, order: 1, createdAt: -1 }),
    products.createIndex({ sport: 1, isActive: 1, order: 1, createdAt: -1 }),
    products.createIndex({ category: 1, isActive: 1, order: 1, createdAt: -1 }),
  ]);

  const targetSport = new ObjectId();
  const otherSport = new ObjectId();
  const sharedCategory = new ObjectId();
  const otherCategory = new ObjectId();
  const documents = Array.from({ length: 20_000 }, (_, order) => ({
    isActive: true,
    sport: order % 80 === 0 ? targetSport : otherSport,
    category: order % 333 === 0 ? sharedCategory : otherCategory,
    order,
    createdAt: new Date(1_700_000_000_000 + order),
  }));
  await products.insertMany(documents);

  const filter = andMongoFilters(
    { isActive: true },
    buildProductSportMatch(targetSport, [sharedCategory]),
  );
  const explain = await products
    .find(filter)
    .sort({ order: 1, createdAt: -1 })
    .limit(20)
    .explain("executionStats");

  const indexNames = new Set();
  const stages = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.indexName) indexNames.add(value.indexName);
    if (value.stage) stages.add(value.stage);
    for (const child of Object.values(value)) visit(child);
  };
  visit(explain.queryPlanner.winningPlan);

  assert.ok(indexNames.has("sport_1_isActive_1_order_1_createdAt_-1"));
  assert.ok(indexNames.has("category_1_isActive_1_order_1_createdAt_-1"));
  assert.ok(stages.has("SORT_MERGE"));
  assert.equal(explain.executionStats.nReturned, 20);
  assert.ok(explain.executionStats.totalDocsExamined <= 20);
  assert.ok(explain.executionStats.totalKeysExamined <= 30);
});
