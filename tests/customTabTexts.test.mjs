import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUSTOM_TAB_TEXT_LIMITS,
  checkTextMap,
  customTabTextMaps,
  mergeCustomTabTexts,
  resolveCustomTabItems,
  unknownTextKeys,
} from "../src/lib/customTabTexts.js";

const A = "a".repeat(24);
const B = "b".repeat(24);
const C = "c".repeat(24);
const items = [
  { _id: A, title: "ONE", description: "catalog one" },
  { _id: B, title: "TWO", description: "catalog two" },
  { _id: C, title: "THREE", description: "" },
];

test("checkTextMap: undefined stays undefined, blank clears, shapes and limits are enforced", () => {
  assert.deepEqual(checkTextMap(undefined, "customTabTitles"), { value: undefined });
  assert.deepEqual(checkTextMap(null, "customTabTitles"), { value: {} });
  assert.deepEqual(checkTextMap("", "customTabTitles"), { value: {} });
  assert.deepEqual(checkTextMap({ ONE: "  hi  ", TWO: "" }, "customTabTitles"), { value: { ONE: "hi", TWO: "" } });
  assert.ok(checkTextMap(["x"], "customTabTitles").error);
  assert.ok(checkTextMap("text", "customTabTitles").error);
  assert.ok(checkTextMap({ ONE: 5 }, "customTabTitles").error);
  assert.ok(checkTextMap({ ONE: "x".repeat(CUSTOM_TAB_TEXT_LIMITS.title + 1) }, "customTabTitles").error.includes("ONE"));
  assert.equal(checkTextMap({ ONE: "x".repeat(CUSTOM_TAB_TEXT_LIMITS.title + 1) }, "customTabDescriptions").error, undefined);
  assert.ok(checkTextMap({ ONE: "x".repeat(CUSTOM_TAB_TEXT_LIMITS.description + 1) }, "customTabDescriptions").error);
});

test("merge: only selected items, in selection order, keyed by item id; blank entries dropped", () => {
  const texts = mergeCustomTabTexts({
    items,
    selectedIds: [B, A],
    titles: { ONE: "T1", TWO: "", THREE: "not selected" },
    descriptions: { TWO: "D2" },
  });
  assert.deepEqual(texts, [
    { item: B, title: "", description: "D2" },
    { item: A, title: "T1", description: "" },
  ]);
  // an id that is not a catalog item is dropped
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: ["d".repeat(24)], titles: { ONE: "x" } }), []);
});

test("merge: an absent map keeps the stored text, {} clears it; deselecting prunes", () => {
  const existing = [{ item: A, title: "OLD T", description: "OLD D" }, { item: B, title: "B T", description: "" }];
  // only the selection was sent (old client / old JSON)
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: [A, B], existing }), existing);
  // titles replaced, descriptions untouched
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: [A], existing, titles: { ONE: "NEW" } }), [
    { item: A, title: "NEW", description: "OLD D" },
  ]);
  // {} clears that part
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: [A, B], existing, titles: {}, descriptions: {} }), []);
  // deselected B: gone; re-selecting it later does not resurrect it
  const pruned = mergeCustomTabTexts({ items, selectedIds: [A], existing });
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: [A, B], existing: pruned }), [existing[0]]);
  // ObjectId-like values are compared as strings
  const oid = { toString: () => A };
  assert.deepEqual(mergeCustomTabTexts({ items, selectedIds: [oid], existing: [{ item: oid, title: "X", description: "" }] }), [
    { item: A, title: "X", description: "" },
  ]);
});

test("unknownTextKeys lists keys that are no catalog title", () => {
  assert.deepEqual(unknownTextKeys(items, { ONE: "x", NOPE: "y" }), ["NOPE"]);
  assert.deepEqual(unknownTextKeys(items, undefined), []);
});

test("a renamed item keeps its product text: maps are keyed by the current catalog title", () => {
  const texts = [{ item: A, title: "T1", description: "D1" }, { item: B, title: "", description: "D2" }];
  const renamed = [{ ...items[0], title: "ONE RENAMED" }, items[1]];
  assert.deepEqual(customTabTextMaps(renamed, texts), {
    customTabTitles: { "ONE RENAMED": "T1" },
    customTabDescriptions: { "ONE RENAMED": "D1", TWO: "D2" },
  });
  assert.deepEqual(customTabTextMaps(items, undefined), { customTabTitles: {}, customTabDescriptions: {} });
});

test("resolveCustomTabItems: catalog order, per-field fallback to the manual text", () => {
  const tab = { enabled: true, items };
  const texts = [{ item: A, title: "T1", description: "" }, { item: B, title: "", description: "D2" }];
  const shown = resolveCustomTabItems(tab, [B, A], texts);
  assert.deepEqual(shown.map(({ _id, title, description }) => ({ _id, title, description })), [
    { _id: A, title: "T1", description: "catalog one" },
    { _id: B, title: "TWO", description: "D2" },
  ]);
  // no generated text at all → exactly the manual text
  assert.deepEqual(resolveCustomTabItems(tab, [C], []).map((i) => [i.title, i.description]), [["THREE", ""]]);
  assert.deepEqual(resolveCustomTabItems({ ...tab, enabled: false }, [A], texts), []);
  assert.deepEqual(resolveCustomTabItems(undefined, [A], texts), []);
});

test("the product page renders the resolved items and passes the product texts down", () => {
  const tabs = readFileSync(new URL("../src/components/templates/product/ProductTabs.jsx", import.meta.url), "utf8");
  const template = readFileSync(new URL("../src/components/templates/product/ProductTemplate.jsx", import.meta.url), "utf8");
  assert.match(tabs, /resolveCustomTabItems\(/);
  assert.match(template, /customTabTexts=\{product\.customTabTexts/);
});
