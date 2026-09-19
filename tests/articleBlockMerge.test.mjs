/**
 * tests/articleBlockMerge.test.mjs
 *
 * ادغام/جداسازیِ بلوک‌ها. قاعده‌ی اصلی: جداسازی دقیقاً همان بلوک‌ها را، با همان
 * شناسه، داده، استایل، عرض و ترتیب برمی‌گرداند — و محتوای داخلِ بلوکِ ادغام‌شده
 * (در هر عمقی) از هیچ اعتبارسنجی‌ای فرار نمی‌کند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);

const { mergeBlocks, mergeBlocker, unmergeBlock, cloneWithFreshIds } = await import("../src/lib/articleBlockMerge.js");
const { flattenArticleBlocks, mergeDepth, sanitizeMergedGrid, defaultMergedGrid, MAX_MERGED_CHILDREN, MAX_MERGE_DEPTH } = await import("../src/lib/articleBlockTypes.js");
const { sanitizeArticleBlocks } = await import("@/lib/articleValidation");

const article = () => [
  { id: "h", type: "heading", version: 1, data: { text: "تیتر", level: "h2" } },
  { id: "a", type: "paragraph", version: 1, data: { text: "الف", html: "<b>الف</b>" }, style: { textColor: "#112233" }, layout: { width: "1/2" } },
  { id: "b", type: "image", version: 1, data: { url: "https://ik.imagekit.io/x/a.jpg", alt: "", caption: "", images: [{ url: "https://ik.imagekit.io/x/a.jpg", alt: "", href: "/tennis", overlayText: "بنر" }], displayHeight: 300 }, layout: { width: "1/2" } },
  { id: "c", type: "quote", version: 1, data: { text: "نقل", author: "x" } },
  { id: "d", type: "divider", version: 1, data: {} },
];
const allIds = (blocks) => flattenArticleBlocks(blocks).map((block) => block.id);

test("merging adjacent blocks replaces them with one block at the same position, children verbatim", () => {
  const before = article();
  const after = mergeBlocks(before, ["b", "a", "c"]); // selection order does not matter
  assert.deepEqual(after.map((block) => block.type), ["heading", "merged", "divider"]);
  assert.deepEqual(after[1].data.blocks, before.slice(1, 4));
  assert.equal(after[0], before[0], "untouched blocks keep identity");
});

test("unmerge restores exactly the original blocks and order (round trip)", () => {
  const before = article();
  const merged = mergeBlocks(before, ["a", "b"]);
  assert.deepEqual(unmergeBlock(merged, merged[1].id), before);
  assert.deepEqual(unmergeBlock(merged, "nope"), merged, "unknown id is a no-op");
  assert.deepEqual(unmergeBlock(before, "a"), before, "a normal block is never 'unmerged'");
});

test("a merged block can be merged again; each unmerge peels exactly one level", () => {
  const before = article();
  const once = mergeBlocks(before, ["a", "b"]);                   // h, M1(a,b), c, d
  const twice = mergeBlocks(once, [once[1].id, "c"]);              // h, M2(M1(a,b), c), d
  assert.ok(twice, "merged + normal block merge is allowed");
  assert.deepEqual(twice.map((block) => block.type), ["heading", "merged", "divider"]);
  assert.equal(mergeDepth(twice[1]), 2);
  assert.deepEqual(allIds(twice), ["h", "a", "b", "c", "d"], "no content lost or duplicated");
  const peeled = unmergeBlock(twice, twice[1].id);
  assert.deepEqual(peeled, once, "unmerging the outer block gives back exactly the previous state");
  assert.deepEqual(unmergeBlock(peeled, peeled[1].id), before);
  // two merged blocks merged with each other
  const both = mergeBlocks(once, ["c", "d"]);                      // h, M1(a,b), M3(c,d)
  const joined = mergeBlocks(both, [both[1].id, both[2].id]);       // h, M4(M1, M3)
  assert.deepEqual(joined.map((block) => block.type), ["heading", "merged"]);
  assert.deepEqual(allIds(joined), ["h", "a", "b", "c", "d"]);
  assert.deepEqual(unmergeBlock(joined, joined[1].id), both);
});

test("merge rules: 2..max contiguous blocks, depth limit", () => {
  const blocks = article();
  assert.equal(mergeBlocker(blocks, ["a"]), "few");
  assert.equal(mergeBlocker(blocks, ["a", "c"]), "gap");
  assert.equal(mergeBlocks(blocks, ["a", "ghost"]), null);
  // enough neighbours to keep merging one level deeper each time
  let current = [...blocks, ...Array.from({ length: MAX_MERGE_DEPTH + 2 }, (_, i) => ({ id: `extra${i}`, type: "divider", data: {} }))];
  for (let level = 1; level <= MAX_MERGE_DEPTH; level += 1) {
    const top = current.find((block) => block.type === "merged") || current[1];
    current = mergeBlocks(current, [top.id, current[current.indexOf(top) + 1].id]);
    assert.ok(current, `level ${level}`);
  }
  const top = current.find((block) => block.type === "merged");
  assert.equal(mergeDepth(top), MAX_MERGE_DEPTH);
  assert.equal(mergeBlocker(current, [top.id, current[current.indexOf(top) + 1].id]), "deep");
  const many = Array.from({ length: MAX_MERGED_CHILDREN + 1 }, (_, i) => ({ id: `p${i}`, type: "paragraph", data: { text: String(i) } }));
  assert.equal(mergeBlocker(many, many.map((block) => block.id)), "many");
});

test("duplicating gives every block in the copy a fresh id, at any depth", () => {
  const once = mergeBlocks(article(), ["a", "b"]);
  const nested = mergeBlocks(once, [once[1].id, "c"])[1];
  const copy = cloneWithFreshIds(nested);
  const original = allIds([nested]).concat(nested.id, nested.data.blocks[0].id);
  const fresh = allIds([copy]).concat(copy.id, copy.data.blocks[0].id);
  assert.equal(new Set([...original, ...fresh]).size, original.length * 2);
  const strip = (block) => (block.type === "merged" ? { type: block.type, blocks: block.data.blocks.map(strip) } : { ...block, id: undefined });
  assert.deepEqual(strip(copy), strip(nested));
});

test("flattenArticleBlocks exposes children at any depth", () => {
  const once = mergeBlocks(article(), ["a", "b"]);
  const twice = mergeBlocks(once, [once[1].id, "c"]);
  assert.deepEqual(allIds(twice), ["h", "a", "b", "c", "d"]);
  assert.deepEqual(flattenArticleBlocks(undefined), []);
});

test("grid settings are clamped per breakpoint; anything incomplete means the default row layout", () => {
  assert.deepEqual(sanitizeMergedGrid({ desktop: { columns: 6, rows: 2, fit: true }, mobile: { columns: 2, rows: 6, fit: false, minWidth: 180 } }),
    { desktop: { columns: 6, rows: 2, fit: true, minWidth: 0 }, mobile: { columns: 2, rows: 6, fit: false, minWidth: 180 } });
  assert.deepEqual(sanitizeMergedGrid({ desktop: { columns: 99, rows: 0, fit: "yes", minWidth: -5 }, mobile: { columns: "3", rows: "x" } }),
    { desktop: { columns: 12, rows: 1, fit: false, minWidth: 0 }, mobile: { columns: 3, rows: 1, fit: false, minWidth: 0 } });
  for (const bad of [undefined, null, [], "grid", {}, { desktop: {} }]) assert.equal(sanitizeMergedGrid(bad), undefined, JSON.stringify(bad));
  const defaults = defaultMergedGrid(12);
  assert.deepEqual([defaults.desktop.columns, defaults.mobile.columns, defaults.mobile.rows], [12, 2, 6]);
});

test("server: merged blocks (nested, with grid) survive sanitising unchanged", () => {
  const errors = {};
  const clean = sanitizeArticleBlocks(article(), errors);
  const once = mergeBlocks(clean, ["a", "b"]);
  const twice = mergeBlocks(once, [once[1].id, "c"]);
  twice[1].data.grid = { desktop: { columns: 2, rows: 1, fit: false, minWidth: 0 }, mobile: { columns: 1, rows: 2, fit: true, minWidth: 0 } };
  const again = sanitizeArticleBlocks(twice, errors);
  assert.deepEqual(errors, {});
  assert.deepEqual(again, twice);
  assert.deepEqual(unmergeBlock(unmergeBlock(again, again[1].id), once[1].id), clean);
});

test("server: legacy merged blocks without grid stay exactly as stored", () => {
  const errors = {};
  const legacy = [{ id: "m", type: "merged", version: 1, data: { blocks: [{ id: "x", type: "divider", version: 1, data: {} }] } }];
  assert.deepEqual(sanitizeArticleBlocks(legacy, errors), legacy);
  assert.deepEqual(errors, {});
});

test("server: same validation inside, unique ids across the tree, depth and size limits", () => {
  const bad = (blocks) => { const errors = {}; sanitizeArticleBlocks(blocks, errors); return errors; };
  const child = { id: "x1", type: "button", data: { label: "l", href: "javascript:alert(1)" } };
  assert.ok(bad([{ id: "m", type: "merged", data: { blocks: [{ id: "m2", type: "merged", data: { blocks: [child] } }] } }])["blocks.0.data.blocks.0.data.blocks.0.data.href"], "deep children validated");
  assert.ok(bad([{ id: "dup", type: "divider", data: {} }, { id: "m", type: "merged", data: { blocks: [{ id: "dup", type: "divider", data: {} }] } }])["blocks.1.data.blocks.0.id"]);
  let deep = { id: "leaf", type: "divider", data: {} };
  for (let level = 0; level <= MAX_MERGE_DEPTH; level += 1) deep = { id: `m${level}`, type: "merged", data: { blocks: [deep] } };
  const deepErrors = bad([deep]);
  assert.ok(Object.keys(deepErrors).some((key) => key.endsWith(".type")), "more than MAX_MERGE_DEPTH levels is rejected");
  const tooMany = Array.from({ length: MAX_MERGED_CHILDREN + 1 }, (_, i) => ({ id: `c${i}`, type: "divider", data: {} }));
  const errors = {};
  const out = sanitizeArticleBlocks([{ id: "m", type: "merged", data: { blocks: tooMany } }], errors);
  assert.ok(errors["blocks.0.data.blocks"]);
  assert.equal(out[0].data.blocks.length, MAX_MERGED_CHILDREN);
});

test("modal preview uses the render formula: min width overrides the column count (Blade vs Defyer case)", async () => {
  const { mergedGridColumnsAt, MERGED_GRID_REFERENCE } = await import("../src/lib/articleBlockTypes.js");
  const blade = { columns: 2, rows: 1, fit: false, minWidth: 300 };  // stored mobile setting of the Blade series block
  const defyer = { columns: 1, rows: 1, fit: false, minWidth: 300 }; // stored mobile setting of the Defyer series block
  // widths measured in Chrome on the built app (content width = viewport - 32px padding, gap 16px)
  for (const [viewport, bladeWidth, defyerWidth] of [[360, 300, 328], [390, 300, 358], [430, 300, 398]]) {
    const at = { width: viewport - 32, gap: 16 };
    assert.equal(mergedGridColumnsAt(blade, at).columnWidth, bladeWidth, `blade @${viewport}`);
    assert.equal(mergedGridColumnsAt(defyer, at).columnWidth, defyerWidth, `defyer @${viewport}`);
  }
  const phone = MERGED_GRID_REFERENCE.mobile;
  assert.deepEqual(mergedGridColumnsAt(blade, phone), { columnWidth: 300, visible: 1, requiredWidth: 616 }, "2 columns never fit on a phone with min 300px");
  assert.equal(mergedGridColumnsAt({ ...blade, minWidth: 0 }, phone).visible, 2, "without a min width both columns fit");
  assert.equal(mergedGridColumnsAt({ ...blade, fit: true }, phone).visible, 2, "fit always shows the configured columns");
});
