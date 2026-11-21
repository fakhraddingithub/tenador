// فیلترِ ویژگی: بازه برای ویژگیِ «تماماً عددی»، دکمه با وجودِ حتی یک حرف، رنگِ تک‌انتخابی.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);

const f = await import("@/lib/attributeFilters");
const { readBrandGroupedViewCache, writeBrandGroupedViewCache } = await import("@/lib/brandGroupedViewCache");

const attrs = [
  { name: "Weight", label: "وزن", filterable: true },
  { name: "Head Size", label: "اندازه صفحه", filterable: true },
  { name: "Grip", label: "گریپ", filterable: true },
  { name: "Color", label: "رنگ", filterable: true },
];
const products = [
  { attributes: { Weight: "300", "Head Size": 98, Grip: "2", Color: "قرمز" } },
  { attributes: { Weight: 285, "Head Size": "۱۰۰", Grip: "3" } },
  { attributes: { Weight: "305.5", "Head Size": "102", Grip: "L3" } }, // یک حرف → گریپ متنی
  { attributes: {} },
];
const meta = f.buildAttributeMeta(attrs, products);
const byName = Object.fromEntries(meta.map((m) => [m.name, m]));

test("all-numeric attributes become ranges; one letter keeps buttons", () => {
  assert.deepEqual(
    (({ type, min, max, step }) => ({ type, min, max, step }))(byName.Weight),
    { type: "number", min: 285, max: 305.5, step: 0.1 },
  );
  assert.equal(byName["Head Size"].type, "number"); // ارقامِ فارسی حرف نیستند
  assert.equal(byName["Head Size"].max, 102);
  assert.equal(byName.Grip.type, "text");
  assert.equal(byName.Grip.min, undefined);
  assert.equal(byName.Color.type, "color");
  for (const v of ["305g", "۲۷ سانت", "98-100", ""]) assert.equal(f.toNumber(v), null);
});

test("range matching is inclusive and drops products without a numeric value", () => {
  const match = (sel) => products.filter((p) => f.productMatchesAttrFilters(p, { Weight: sel }, meta)).length;
  assert.equal(match({ min: 300, max: null }), 2);
  assert.equal(match({ min: null, max: 300 }), 2);
  assert.equal(match({ min: 300, max: 300 }), 1);
  assert.equal(match({ min: null, max: null }), 4); // بی‌اثر
  assert.equal(match(["300"]), 1); // آرایه روی عددی = تطبیقِ دقیق (قانونِ کمپین)
  // بازه روی ویژگیِ متنی نادیده گرفته می‌شود، نه اینکه همه را حذف کند
  assert.equal(products.filter((p) => f.productMatchesAttrFilters(p, { Grip: { min: 1, max: 2 } }, meta)).length, 4);
});

test("URL round trip: ranges use _min/_max, color keeps one value, old links still work", () => {
  const params = f.writeAttrFiltersToParams(new URLSearchParams("utm=x&Weight=1"), {
    Weight: { min: 290, max: null }, Grip: ["2", "3"], Color: ["قرمز"],
  }, meta);
  assert.equal(params.get("Weight"), null);
  assert.equal(params.get("Weight_min"), "290");
  assert.equal(params.get("Weight_max"), null);
  assert.equal(params.get("utm"), "x");
  assert.deepEqual(f.parseAttrFiltersFromParams(params, meta), {
    Weight: { min: 290, max: null }, Grip: ["2", "3"], Color: ["قرمز"],
  });
  assert.deepEqual(
    f.parseAttrFiltersFromParams(new URLSearchParams("Weight=305&Weight=290&Color=قرمز&Color=آبی&Head Size_max=abc"), meta),
    { Weight: { min: 290, max: 305 }, Color: ["قرمز"] },
  );
  assert.deepEqual(f.parseAttrFiltersFromParams(new URLSearchParams("Weight_min=310&Weight_max=290"), meta),
    { Weight: { min: 290, max: 310 } });
});

test("counts, category merge and the brand view cache understand ranges", () => {
  assert.equal(f.countActiveAttrFilters({ Weight: { min: 1, max: null }, Grip: ["2", "3"], X: { min: null, max: null } }), 3);
  const merged = f.mergeAttributeMeta([
    { attributeMeta: [{ name: "W", type: "number", min: 280, max: 300, step: 1, options: [] }] },
    { attributeMeta: [{ name: "W", type: "number", min: 290, max: 320.5, step: 0.1, options: [] }] },
  ]);
  assert.deepEqual((({ min, max, step }) => ({ min, max, step }))(merged[0]), { min: 280, max: 320.5, step: 0.1 });
  const clash = f.mergeAttributeMeta([
    { attributeMeta: [{ name: "W", type: "number", min: 1, max: 2, step: 1, options: [] }] },
    { attributeMeta: [{ name: "W", type: "text", options: [] }] },
  ]);
  assert.equal(clash[0].min, undefined);

  const filters = { categoryIds: [], categoryAttributes: { W: { min: 290, max: null }, G: ["b", "a"] } };
  writeBrandGroupedViewCache("range", { sections: [], filters });
  assert.ok(readBrandGroupedViewCache("range", { categoryAttributes: { G: ["a", "b"], W: { min: 290, max: null } } }));
  assert.equal(readBrandGroupedViewCache("range", { categoryAttributes: { W: { min: 291, max: null }, G: ["a", "b"] } }), null);
});

test("the sidebar renders a range for numeric attributes and buttons in campaign mode", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createRequire } = await import("node:module");
  const vm = await import("node:vm");
  const { loadBindings, transform } = await import("next/dist/build/swc/index.js");
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  await loadBindings();
  const path = "../src/components/features/filters/AttributeFilters.jsx";
  const { code } = await transform(await readFile(new URL(path, import.meta.url), "utf8"), {
    filename: path,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" },
  });
  const require = createRequire(import.meta.url);
  const deps = {
    "@/lib/attributeFilters": f,
    "@/lib/colorMatch": await import("@/lib/colorMatch"),
    "@/components/features/filters/PriceRangeFilter": { THUMB_INPUT_CLASS: "thumb" },
  };
  const mod = { exports: {} };
  vm.runInNewContext(code, { exports: mod.exports, module: mod, require: (n) => deps[n] ?? require(n) });
  const Filters = mod.exports.default;
  const render = (props) => renderToStaticMarkup(React.createElement(Filters, { attrMeta: meta, defaultOpen: true, ...props }));
  const html = render({ attrFilters: { Weight: { min: 290, max: null }, Color: ["قرمز"] } });
  assert.equal((html.match(/type="range"/g) || []).length, 4); // وزن + اندازه صفحه
  assert.ok(html.includes('value="290"'));
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  const campaign = render({ attrFilters: { Weight: ["300"] }, exactValues: true });
  assert.ok(!campaign.includes('type="range"'));
  assert.ok(campaign.includes('aria-pressed="true"'));
});
