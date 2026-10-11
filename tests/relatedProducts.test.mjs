import test from "node:test";
import assert from "node:assert/strict";
import { findClosestProducts } from "../src/components/templates/productMatch/matchEngine.js";
import { hasMatchableStats, rankRelatedProducts } from "../src/lib/relatedProducts.js";

const category = { _id: "rackets", technicalStats: [
  { name: "power", min: 0, max: 100 },
  { name: "control", min: 0, max: 10 },
] };
const source = { _id: "source", category, technicalStats: { power: 60, control: 5 }, tag: ["tennis"] };
const ids = (result) => result.products.map((product) => product._id);

test("technical recommendations use the existing match engine's exact order and top 8", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => ({
    _id: String(index), technicalStats: { power: 100 - index * 5, control: 6 },
  }));
  candidates.push(source, { _id: "no-stats", tag: ["tennis"] });
  const result = rankRelatedProducts(source, candidates);
  const expected = findClosestProducts({ targetStats: source.technicalStats,
    candidateProducts: candidates, categoryStats: category.technicalStats,
    excludeId: source._id, topN: 8 });
  assert.equal(result.mode, "technical");
  assert.equal(result.products.length, 8);
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

test("tag fallback returns 8 unique other products and keeps stable tie order", () => {
  const candidates = Array.from({ length: 15 }, (_, index) => ({ _id: String(index), tag: ["a"] }));
  assert.deepEqual(ids(rankRelatedProducts({ _id: "0", tag: ["a"] }, candidates)), ["1", "2", "3", "4", "5", "6", "7", "8"]);
});

test("empty matches never repeat products or pad the slider with unrelated items", () => {
  assert.deepEqual(ids(rankRelatedProducts({ _id: "source" }, [{ _id: "other", tag: ["a"] }])), []);
  assert.deepEqual(ids(rankRelatedProducts(source, [{ _id: "other", tag: ["tennis"] }])), []);
  assert.deepEqual(ids(rankRelatedProducts({ _id: "source", tag: ["a"] }, [{ _id: "other", tag: ["b"] }])), []);
});
