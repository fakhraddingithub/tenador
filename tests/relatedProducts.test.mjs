import test from "node:test";
import assert from "node:assert/strict";
import { findClosestProducts } from "../src/components/templates/productMatch/matchEngine.js";
import { hasMatchableStats, rankRelatedProducts, complementarySerieTiers, selectComplementaryProducts } from "../src/lib/relatedProducts.js";

const category = { _id: "rackets", technicalStats: [
  { name: "power", min: 0, max: 100 },
  { name: "control", min: 0, max: 10 },
] };
const source = { _id: "source", category, technicalStats: { power: 60, control: 5 }, tag: ["tennis"] };
const ids = (result) => result.products.map((product) => product._id);

test("technical recommendations use the existing match engine's exact order and top 3", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => ({
    _id: String(index), technicalStats: { power: 100 - index * 5, control: 6 },
  }));
  candidates.push(source, { _id: "no-stats", tag: ["tennis"] });
  const result = rankRelatedProducts(source, candidates);
  const expected = findClosestProducts({ targetStats: source.technicalStats,
    candidateProducts: candidates, categoryStats: category.technicalStats,
    excludeId: source._id, topN: 3 });
  assert.equal(result.mode, "technical");
  assert.equal(result.products.length, 3);
  assert.deepEqual(ids(result), expected.map(({ product }) => product._id));
  assert.ok(!ids(result).includes("source"));
  assert.ok(!ids(result).includes("no-stats"));
});

test("technical distance is normalized across different ranges, with no invented missing values", () => {
  const candidates = [
    { _id: "ten-power", technicalStats: { power: 70, control: 5 } },
    { _id: "two-control", technicalStats: { power: 60, control: 7 } },
    { _id: "partial", technicalStats: { control: 5 } },
    { _id: "unrelated-axis", technicalStats: { spin: 60 } },
  ];
  assert.deepEqual(ids(rankRelatedProducts(source, candidates)), ["partial", "ten-power", "two-control"]);
});

test("only usable numeric stats activate the technical engine, including a valid zero", () => {
  assert.equal(hasMatchableStats({ ...source, technicalStats: { power: 0 } }), true);
  for (const technicalStats of [undefined, {}, { power: "60" }, { power: NaN }, { spin: 60 }]) {
    assert.equal(hasMatchableStats({ ...source, technicalStats }), false);
  }
  assert.equal(hasMatchableStats({ ...source, category: null }), false);
  assert.equal(hasMatchableStats({ ...source, category: { technicalStats: [{ name: "power", min: 5, max: 5 }] } }), false);
});

test("tag fallback ranks by shared tag sets, normalizes Persian text, and ignores duplicate/empty tags", () => {
  const base = { _id: "source", tag: ["راکت", "تنیس", " PRO ", "", "pro"] };
  const candidates = [
    { _id: "partial", tag: ["تنیس"] },
    { _id: "noisy", tag: ["راکت", "تنیس", "pro", "bag", "shoes"] },
    { _id: "exact", tag: ["راكت", "تنيس", "Pro", "pro"] },
    { _id: "unrelated", tag: ["football"] },
    { _id: "substring", tag: ["pro-plus"] },
    base,
    { _id: "empty", tag: null },
  ];
  const result = rankRelatedProducts(base, candidates);
  assert.equal(result.mode, "tags");
  assert.deepEqual(ids(result), ["exact", "noisy", "partial"]);
});

test("tag fallback returns 3 unique other products and keeps stable tie order", () => {
  const candidates = Array.from({ length: 15 }, (_, index) => ({ _id: String(index), tag: ["a"] }));
  assert.deepEqual(ids(rankRelatedProducts({ _id: "0", tag: ["a"] }, candidates)), ["1", "2", "3"]);
});

test("empty matches never repeat products or pad the slider with unrelated items", () => {
  assert.deepEqual(ids(rankRelatedProducts({ _id: "source" }, [{ _id: "other", tag: ["a"] }])), []);
  assert.deepEqual(ids(rankRelatedProducts(source, [{ _id: "other", tag: ["tennis"] }])), []);
  assert.deepEqual(ids(rankRelatedProducts({ _id: "source", tag: ["a"] }, [{ _id: "other", tag: ["b"] }])), []);
});

const family = [
  { _id: "blade", parentSerie: null },
  { _id: "v9", parentSerie: "blade" },
  { _id: "v8", parentSerie: "blade" },
  { _id: "v8-special", parentSerie: "v8" },
  { _id: "clash", parentSerie: null },
];
const base = { _id: "base", category: { _id: "rackets" },
  serie: { _id: "blade", brand: "wilson" }, brand: "wilson", sport: "tennis" };
const accessory = (_id, category, serie = "blade", extra = {}) => ({
  _id, category, serie, brand: "wilson", sport: "tennis", ...extra,
});

test("series priority traverses children, then parent and sibling descendants; other roots are fallback only", () => {
  assert.deepEqual(complementarySerieTiers("blade", family), [["blade"], ["v9", "v8"], ["v8-special"]]);
  assert.deepEqual(complementarySerieTiers("v9", family), [["v9"], ["blade"], ["v8"], ["v8-special"]]);
  assert.deepEqual(complementarySerieTiers(null, family), []);
  assert.deepEqual(complementarySerieTiers("missing", family), [["missing"]]);
  assert.deepEqual(complementarySerieTiers("a", [
    { _id: "a", parentSerie: "b" }, { _id: "b", parentSerie: "a" },
  ]), [["a"], ["b"]]);
});

test("five complements favor the same series with at most two per category", () => {
  const candidates = [
    ...Array.from({ length: 6 }, (_, index) => accessory(`bag${index}`, "bags")),
    accessory("string", "strings"), accessory("damper", "dampers"), accessory("grip", "grips"),
  ];
  const result = selectComplementaryProducts(base, candidates, family);
  assert.deepEqual(result.map((p) => p._id), ["bag0", "string", "damper", "grip", "bag1"]);
});

test("category limits persist across own series, descendants and brand fallback", () => {
  const candidates = [
    accessory("other-root", "grips", "clash"),
    accessory("child-bag", "bags", "v9"),
    accessory("child-string", "strings", "v9"),
    accessory("deep-damper", "dampers", "v8-special"),
    accessory("own-bag1", "bags"), accessory("own-bag2", "bags"),
  ];
  assert.deepEqual(selectComplementaryProducts(base, candidates, family).map((p) => p._id),
    ["own-bag1", "own-bag2", "child-string", "deep-damper", "other-root"]);
});

test("subseries uses parent's products, then sisters, then their descendants, then brand", () => {
  const candidates = [
    accessory("brand", "grips", "clash"),
    accessory("niece", "strings", "v8-special"),
    accessory("sister", "dampers", "v8"),
    accessory("parent", "bags", "blade"),
    accessory("own", "strings", "v9"),
  ];
  const child = { ...base, serie: { _id: "v9", brand: "wilson" } };
  assert.deepEqual(selectComplementaryProducts(child, candidates, family).map((p) => p._id),
    ["own", "parent", "sister", "niece", "brand"]);
});

test("complements exclude source category, other sports/brands, inactive and repeated suggestions", () => {
  const candidates = [
    accessory("base", "bags"), accessory("racket", "rackets"),
    accessory("wrong-sport", "bags", "blade", { sport: "padel" }),
    accessory("wrong-brand", "bags", "blade", { brand: "head" }),
    accessory("inactive", "bags", "blade", { isActive: false }),
    accessory("similar", "strings"), accessory("valid", "bags"), accessory("valid", "bags"),
  ];
  assert.deepEqual(selectComplementaryProducts(base, candidates, family, [{ _id: "similar" }]).map((p) => p._id), ["valid"]);
});

test("no series falls back to same brand/sport; insufficient variety leaves fewer than five", () => {
  const candidates = Array.from({ length: 8 }, (_, index) => accessory(String(index), "bags", "clash"));
  assert.equal(selectComplementaryProducts({ ...base, serie: null }, candidates, []).length, 2);
  assert.deepEqual(selectComplementaryProducts({ ...base, sport: null }, candidates, []), []);
});
