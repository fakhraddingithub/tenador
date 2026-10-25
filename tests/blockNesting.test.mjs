/**
 * tests/blockNesting.test.mjs
 *
 * تودرتوییِ بلوک‌ها سقفِ عمق ندارد: ادغام در ادغام، بلوک روی تصویر روی تصویر، اسلاید
 * با بلوک‌های رویی — در ۵، ۱۰ و ۲۰ سطح از پاک‌سازیِ سرور، ذخیره در مونگو، بازکردنِ
 * دوباره، ادغام و رونوشت سالم می‌گذرند. فقط ساختارِ خراب (حلقه، عمقِ بی‌پایان) رد
 * می‌شود — با ۴۰۰، نه با خطای پشته.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

const { sanitizeArticleBlocks, validateArticleInput } = await import("../src/lib/articleValidation.js");
const { sanitizeBrandBrochure } = await import("../src/lib/brandBrochure.js");
const { blockChildren, flattenArticleBlocks } = await import("../src/lib/articleBlockTypes.js");
const { mergeBlocks, cloneWithFreshIds } = await import("../src/lib/articleBlockMerge.js");
const { ArticleBlockSchema, BrochureSchema } = await import("../models/articleSchemas.js");

const url = "https://ik.imagekit.io/x/a.jpg";
let seq = 0;
const id = (prefix) => `${prefix}${(seq += 1)}`;
const leaf = () => ({ id: "leaf", type: "button", version: 1, data: { label: "ته", href: "/deep", style: "primary" }, layout: { width: "1/2", widthPct: 60 } });
const paragraph = () => ({ id: id("p"), type: "paragraph", version: 1, data: { text: "کنار" } });
const merged = (children) => ({ id: id("m"), type: "merged", version: 1, data: { blocks: children } });
const image = (children) => ({ id: id("i"), type: "image", version: 1, data: { url, width: 1600, height: 900, alt: "", blocks: children } });
const slider = (children) => ({ id: id("s"), type: "imageSlider", version: 1, data: { height: 320, delay: 5000, blocks: children } });

// هر «سطح» یک بلوکِ نگهدارنده است؛ mixed هر سه نوع را پشتِ‌سرِ‌هم دارد.
const CHAINS = {
  merged: (inner) => merged([inner, paragraph()]),
  image: (inner) => image([inner]),
  mixed: (inner, level) => [image([inner]), merged([paragraph(), inner]), slider([image([inner])])][level % 3],
};
const chain = (kind, levels) => {
  let block = leaf();
  for (let level = 0; level < levels; level += 1) block = CHAINS[kind](block, level);
  return block;
};
/** تعدادِ بلوک‌های نگهدارنده بالای «ته» (اسلاید = اسلایدر + تصویرش، دو سطح). */
const depthOf = (block) => (block.id === "leaf" ? 0 : 1 + Math.max(-Infinity, ...blockChildren(block).map(depthOf)));
const findLeaf = (blocks) => flattenArticleBlocks(blocks).find((block) => block.id === "leaf");
const sanitize = (blocks) => {
  const errors = {};
  return { blocks: sanitizeArticleBlocks(blocks, errors), errors };
};

const CASES = Object.keys(CHAINS).flatMap((kind) => [5, 10, 20].map((levels) => ({ kind, levels })));

for (const { kind, levels } of CASES) {
  test(`${kind}, ${levels} levels: survives the validator, the API input and a reopen unchanged`, () => {
    const input = [paragraph(), chain(kind, levels)];
    const expectedDepth = depthOf(input[1]);
    assert.ok(expectedDepth >= levels);
    const { blocks, errors } = sanitize(input);
    assert.deepEqual(errors, {});
    assert.equal(depthOf(blocks[1]), expectedDepth, "no level dropped");
    assert.deepEqual(findLeaf(blocks).data, { label: "ته", href: "/deep", style: "primary" }, "the innermost block keeps its data");
    assert.deepEqual(findLeaf(blocks).layout, { width: "1/2", widthPct: 60 });
    // reopening = what the editor loads, saved again
    assert.deepEqual(sanitize(JSON.parse(JSON.stringify(blocks))).blocks, blocks);
    // the article PATCH body and the brochure PUT go through the same rule
    const article = validateArticleInput({ blocks: input }, { partial: true });
    assert.deepEqual(article.errors, {});
    const brochureErrors = {};
    assert.equal(depthOf(sanitizeBrandBrochure({ status: "published", blocks: input }, brochureErrors).blocks[1]), expectedDepth);
    assert.deepEqual(brochureErrors, {});
  });
}

test("the old cap is gone: a merged block 4+ levels deep and blocks on an image 4+ levels deep are kept, not dropped", () => {
  for (const kind of ["merged", "image"]) {
    const { blocks, errors } = sanitize([chain(kind, 4)]);
    assert.deepEqual(errors, {}, kind);
    assert.ok(findLeaf(blocks), `${kind}: content beyond level 3 used to be silently emptied`);
  }
});

test("merging and duplicating work at any depth", () => {
  const deep = sanitize([chain("mixed", 20), paragraph()]).blocks;
  const joined = mergeBlocks(deep, [deep[0].id, deep[1].id]);
  assert.ok(joined, "merging a 20-level block with its neighbour is allowed");
  const { blocks, errors } = sanitize(joined);
  assert.deepEqual(errors, {});
  assert.equal(depthOf(blocks[0]), depthOf(deep[0]) + 1);

  const copy = cloneWithFreshIds(deep[0]);
  const ids = (block) => [block.id, ...blockChildren(block).flatMap(ids)];
  assert.equal(new Set([...ids(deep[0]), ...ids(copy)]).size, ids(deep[0]).length * 2, "every id in the copy is fresh, all the way down");
  // copy pasted next to the original → still unique across the tree, so the save is accepted
  const pasted = sanitize([...deep, copy]);
  assert.deepEqual(pasted.errors, {});
});

test("malformed structures are rejected safely — never a crash, never a partial save", () => {
  const circular = merged([paragraph()]);
  circular.data.blocks.push(circular);
  const loop = sanitize([circular]);
  assert.match(loop.errors.blocks, /malformed/);
  assert.deepEqual(loop.blocks, []);

  const selfImage = image([]);
  selfImage.data.blocks.push(selfImage);
  assert.match(sanitize([selfImage]).errors.blocks, /malformed/);

  // hand-made unbounded depth (100k levels) — the stack is the only thing that would stop it
  let bottomless = leaf();
  for (let level = 0; level < 100_000; level += 1) bottomless = { id: `x${level}`, type: "merged", data: { blocks: [bottomless] } };
  const deep = sanitize([bottomless]);
  assert.match(deep.errors.blocks, /malformed/);
  assert.deepEqual(deep.blocks, []);

  // junk children deep inside are reported per block, like at the top level
  let junk = merged([null, "text", 42]);
  for (let level = 0; level < 10; level += 1) junk = merged([junk]);
  const reported = sanitize([junk]);
  assert.ok(Object.keys(reported.errors).some((key) => key.endsWith(".id")), "a junk child is an error, not a crash");
});

// ——— ذخیره و خواندن در مونگو، با همان schemaهای واقعی ————————————————————————
let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("block-nesting"));
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("saved and read back from MongoDB (article blocks and a brochure) with every level intact", async () => {
  const Doc = mongoose.model("NestingDoc", new mongoose.Schema({ blocks: [ArticleBlockSchema], brochure: BrochureSchema }));
  for (const { kind, levels } of CASES) {
    const { blocks } = sanitize([chain(kind, levels)]);
    const saved = await Doc.create({ blocks, brochure: { status: "published", blocks } });
    const read = await Doc.findById(saved._id).lean();
    for (const stored of [read.blocks, read.brochure.blocks]) {
      const reopened = sanitize(JSON.parse(JSON.stringify(stored)));
      assert.deepEqual(reopened.errors, {}, `${kind} ${levels}`);
      assert.deepEqual(reopened.blocks, blocks, `${kind} ${levels}: identical after a round trip`);
    }
  }
});
