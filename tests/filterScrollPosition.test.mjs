import test from "node:test";
import assert from "node:assert/strict";
import { getFilterScrollTarget } from "../src/lib/filterScrollPosition.js";

const previous = { y: 1800, top: 400, bottom: 5000 };
const layout = { top: 400, resultsTop: 480, resultsBottom: 4000, documentHeight: 5500, viewportHeight: 800 };

test("keeps the viewport when results still cover its position", () => {
  assert.equal(getFilterScrollTarget(previous, layout), 1800);
});

test("uses the pre-update position when a short document clamps scrolling", () => {
  assert.equal(getFilterScrollTarget(previous, { ...layout, resultsBottom: 800, documentHeight: 1300 }), 390);
});

test("a tall footer or sidebar must not hide the fact that results disappeared", () => {
  assert.equal(getFilterScrollTarget(previous, { ...layout, resultsBottom: 800 }), 390);
});

test("keeps the viewport as a result set grows", () => {
  assert.equal(getFilterScrollTarget(previous, { ...layout, resultsBottom: 9000, documentHeight: 10000 }), 1800);
});

test("preserves the relative position if content above the listing changes", () => {
  assert.equal(getFilterScrollTarget(previous, { ...layout, top: 600, resultsTop: 680 }), 2000);
});

test("does not pull readers away from the hero or footer", () => {
  assert.equal(getFilterScrollTarget({ ...previous, y: 100 }, layout), null);
  assert.equal(getFilterScrollTarget({ ...previous, y: 5100 }, layout), null);
});

test("an empty result set returns to results without exceeding document bounds", () => {
  assert.equal(getFilterScrollTarget(previous, { ...layout, resultsBottom: 650, documentHeight: 1000 }), 200);
  assert.equal(getFilterScrollTarget(previous, { ...layout, documentHeight: 600 }), 0);
});
