import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, register } from "node:module";
import vm from "node:vm";
import { loadBindings, transform } from "next/dist/build/swc/index.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
const require = createRequire(import.meta.url);
const audience = await import("@/lib/navbarAudience");
const attributes = await import("@/lib/attributeFilters");
const subtree = await import("base/utils/categorySubtree");
const { readBrandGroupedViewCache, writeBrandGroupedViewCache } = await import("@/lib/brandGroupedViewCache");

async function component(path, dependencies) {
  await loadBindings();
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transform(source, {
    filename: path,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" },
  });
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod.exports, module: mod,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
  }, { filename: path });
  return mod.exports;
}

test("desktop navbar renders structural parent and child as real links, preserving kids selection", async () => {
  const { default: Menu } = await component("../src/components/features/navbar/MegamenuInteractiveColumns.jsx", {
    "next/link": ({ href, children, className }) => React.createElement("a", { href, className }, children),
    "@/lib/navbarAudience": audience,
  });
  const html = renderToStaticMarkup(React.createElement(Menu, {
    sport: { slug: "tennis", categories: [
      { _id: "parent", slug: "accessories", title: "لوازم جانبی", hasProducts: false, brands: [] },
      { _id: "child", parent: "parent", slug: "bags", title: "کیف", hasProducts: false, brands: [] },
    ] }, selectedAudience: "بچگانه", onClose() {},
  }));
  const query = `?targetAudience=${encodeURIComponent("بچگانه")}`;
  assert.ok(html.includes(`href="/tennis/accessories${query}"`));
  assert.ok(html.includes(`href="/tennis/bags${query}"`));
});

test("existing category filter renders structural choices and switches to descendant attributes", async () => {
  let displayedCategories, displayedMeta;
  const { default: Filters, pruneAttributes } = await component("../src/components/features/filters/CategoryAttributeFilters.jsx", {
    "@/components/features/filters/AttributeFilters": ({ attrMeta }) => { displayedMeta = attrMeta; return null; },
    "@/components/features/filters/FilterGroup": ({ items }) => { displayedCategories = items; return null; },
    "@/lib/attributeFilters": attributes,
    "base/utils/categorySubtree": subtree,
  });
  const categories = [
    { _id: "bags", title: "کیف", descendantIds: ["backpacks"], attributeMeta: [] },
    { _id: "backpacks", title: "کوله", descendantIds: ["backpacks"], attributeMeta: [{ name: "Capacity", options: [] }] },
    { _id: "grips", title: "گریپ", descendantIds: ["grips"], attributeMeta: [{ name: "Size", options: [] }] },
  ];
  renderToStaticMarkup(React.createElement(Filters, { categories, selected: ["bags"] }));
  assert.deepEqual(displayedCategories.map((c) => c._id), ["bags", "backpacks", "grips"]);
  assert.deepEqual(displayedMeta.map((a) => a.name), ["Capacity"]);
  const pruned = pruneAttributes({ Capacity: ["30"], Size: ["2"] }, categories, ["bags"]);
  assert.deepEqual(JSON.parse(JSON.stringify(pruned)), { Capacity: ["30"] });
});

test("returning to a brand parent page cannot restore an invisible previous subcategory selection", () => {
  writeBrandGroupedViewCache("parent-page", {
    sections: [], filters: { categoryIds: ["bags"], categoryAttributes: {} },
  });
  assert.ok(readBrandGroupedViewCache("parent-page", { categoryIds: ["bags"] }));
  assert.equal(readBrandGroupedViewCache("parent-page", { categoryIds: [] }), null);
});
