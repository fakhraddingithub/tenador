import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeRegexLiteral,
  normalizeRelatedBrandIds,
} from "../utils/limitedEditionRelations.js";

test("related brand ids are trimmed, deduplicated and keep their order", () => {
  assert.deepEqual(
    normalizeRelatedBrandIds([" a ", "b", "a", "", null, { _id: "c" }]),
    ["a", "b", "c"],
  );
});

test("missing relations are backward-compatible and become an empty list", () => {
  assert.deepEqual(normalizeRelatedBrandIds(undefined), []);
  assert.deepEqual(normalizeRelatedBrandIds(null), []);
});

test("a non-array relation payload is rejected", () => {
  assert.equal(normalizeRelatedBrandIds("brand-id"), null);
  assert.equal(normalizeRelatedBrandIds({ _id: "brand-id" }), null);
});

test("duplicate-name regexes treat user input as a literal value", () => {
  const input = "Roland (Garros)+";
  const exact = new RegExp(`^${escapeRegexLiteral(input)}$`, "i");

  assert.equal(exact.test(input), true);
  assert.equal(exact.test("Roland Garros"), false);
});
