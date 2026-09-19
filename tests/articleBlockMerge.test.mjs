/**
 * tests/articleBlockMerge.test.mjs
 *
 * ادغام/جداسازیِ بلوک‌ها. قاعده‌ی اصلی: جداسازی دقیقاً همان بلوک‌ها را، با همان
 * شناسه، داده، استایل، عرض و ترتیب برمی‌گرداند — و محتوای داخلِ بلوکِ ادغام‌شده
 * از هیچ اعتبارسنجی‌ای فرار نمی‌کند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);

const { mergeBlocks, unmergeBlock, cloneWithFreshIds } = await import("../src/lib/articleBlockMerge.js");
const { flattenArticleBlocks, MAX_MERGED_CHILDREN } = await import("../src/lib/articleBlockTypes.js");
const { sanitizeArticleBlocks } = await import("@/lib/articleValidation");

const article = () => [
  { id: "h", type: "heading", version: 1, data: { text: "تیتر", level: "h2" } },
  { id: "a", type: "paragraph", version: 1, data: { text: "الف", html: "<b>الف</b>" }, style: { textColor: "#112233" }, layout: { width: "1/2" } },
  { id: "b", type: "image", version: 1, data: { url: "https://ik.imagekit.io/x/a.jpg", alt: "", caption: "", images: [{ url: "https://ik.imagekit.io/x/a.jpg", alt: "", href: "/tennis", overlayText: "بنر" }], displayHeight: 300 }, layout: { width: "1/2" } },
  { id: "c", type: "quote", version: 1, data: { text: "نقل", author: "x" } },
  { id: "d", type: "divider", version: 1, data: {} },
];

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

test("only 2..max contiguous, non-merged blocks can be merged", () => {
  const blocks = article();
  assert.equal(mergeBlocks(blocks, ["a"]), null);
  assert.equal(mergeBlocks(blocks, ["a", "c"]), null, "gap in between");
  assert.equal(mergeBlocks(blocks, ["a", "ghost"]), null);
  const once = mergeBlocks(blocks, ["a", "b"]);
  assert.equal(mergeBlocks(once, [once[1].id, "c"]), null, "no nesting");
  const many = Array.from({ length: MAX_MERGED_CHILDREN + 1 }, (_, i) => ({ id: `p${i}`, type: "paragraph", data: { text: String(i) } }));
  assert.equal(mergeBlocks(many, many.map((block) => block.id)), null);
  assert.equal(mergeBlocks(many, many.slice(0, MAX_MERGED_CHILDREN).map((block) => block.id))[0].data.blocks.length, MAX_MERGED_CHILDREN);
});

test("duplicating a merged block gives every block in the copy a fresh id", () => {
  const merged = mergeBlocks(article(), ["a", "b"])[1];
  const copy = cloneWithFreshIds(merged);
  const ids = [merged.id, ...merged.data.blocks.map((block) => block.id)];
  const copyIds = [copy.id, ...copy.data.blocks.map((block) => block.id)];
  assert.equal(new Set([...ids, ...copyIds]).size, ids.length * 2);
  assert.deepEqual(copy.data.blocks.map(({ id, ...rest }) => rest), merged.data.blocks.map(({ id, ...rest }) => rest));
});

test("flattenArticleBlocks exposes merged children to every consumer", () => {
  const merged = mergeBlocks(article(), ["a", "b"]);
  assert.deepEqual(flattenArticleBlocks(merged).map((block) => block.id), ["h", "a", "b", "c", "d"]);
  assert.deepEqual(flattenArticleBlocks(undefined), []);
});

test("server: a merged block survives sanitising unchanged", () => {
  const errors = {};
  const clean = sanitizeArticleBlocks(article(), errors);
  assert.deepEqual(errors, {});
  const merged = mergeBlocks(clean, ["a", "b", "c"]);
  const again = sanitizeArticleBlocks(merged, errors);
  assert.deepEqual(errors, {});
  assert.deepEqual(again, merged);
  assert.deepEqual(unmergeBlock(again, again[1].id), clean);
});

test("server: children get the same validation, ids are unique across the tree, no nesting", () => {
  const bad = (blocks) => { const errors = {}; sanitizeArticleBlocks(blocks, errors); return errors; };
  const child = { id: "x1", type: "button", data: { label: "l", href: "javascript:alert(1)" } };
  assert.ok(bad([{ id: "m", type: "merged", data: { blocks: [child] } }])["blocks.0.data.blocks.0.data.href"]);
  assert.ok(bad([{ id: "dup", type: "divider", data: {} }, { id: "m", type: "merged", data: { blocks: [{ id: "dup", type: "divider", data: {} }] } }])["blocks.1.data.blocks.0.id"]);
  assert.ok(bad([{ id: "m", type: "merged", data: { blocks: [{ id: "m2", type: "merged", data: { blocks: [] } }] } }])["blocks.0.data.blocks.0.type"]);
  const tooMany = Array.from({ length: MAX_MERGED_CHILDREN + 1 }, (_, i) => ({ id: `c${i}`, type: "divider", data: {} }));
  const errors = {};
  const out = sanitizeArticleBlocks([{ id: "m", type: "merged", data: { blocks: tooMany } }], errors);
  assert.ok(errors["blocks.0.data.blocks"]);
  assert.equal(out[0].data.blocks.length, MAX_MERGED_CHILDREN);
});
