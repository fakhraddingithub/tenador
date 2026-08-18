/**
 * tests/articleBlockPersistence.test.mjs
 *
 * اثباتِ رفت‌وبرگشتِ واقعیِ style/layout روی یک mongodِ واقعی.
 *
 * چرا لازم است: ArticleBlockSchema حالتِ strict دارد. اگر کلیدی در اسکیما نباشد،
 * مونگوس آن را *بی‌صدا* دور می‌ریزد — همان دامی که پیش‌تر در این مخزن سرِ
 * sentinelِ RBAC اتفاق افتاد. تستِ خالصِ sanitizer نمی‌تواند این را بگیرد، چون
 * آنجا چیزی ذخیره نمی‌شود.
 *
 * همچنین تضمین می‌کند بلوکِ بدونِ style/layout پس از ذخیره هم بدونِ آن کلیدها
 * می‌ماند (سازگاریِ عقب‌رو: هیچ مهاجرتی لازم نیست).
 */

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ArticleBlockSchema } from "../models/articleSchemas.js";

let server;
let Doc;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "articleblocks" });
  Doc = mongoose.model("BlockHost", new mongoose.Schema({
    blocks: { type: [ArticleBlockSchema], default: [] },
  }, { minimize: false }));
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

const reload = async (blocks) => {
  const saved = await Doc.create({ blocks });
  const found = await Doc.findById(saved._id).lean();
  return found.blocks;
};

test("style پس از ذخیره و بارگذاری دوباره سالم برمی‌گردد", async () => {
  const [block] = await reload([{
    id: "a", type: "paragraph", data: { text: "سلام" },
    style: { spacing: "lg", textColor: "#111111", background: "#eeeeee", accent: "#aa4725", tableVariant: "striped" },
  }]);
  assert.deepEqual(
    { ...block.style },
    { spacing: "lg", textColor: "#111111", background: "#eeeeee", accent: "#aa4725", tableVariant: "striped" },
  );
});

test("layout پس از ذخیره و بارگذاری دوباره سالم برمی‌گردد", async () => {
  for (const width of ["1/2", "1/3", "2/3"]) {
    const [block] = await reload([{ id: "a", type: "image", data: {}, layout: { width } }]);
    assert.equal(block.layout?.width, width, width);
  }
});

// ——— سازگاریِ عقب‌رو ————————————————————————————————————————————————

test("بلوکِ بدونِ style/layout پس از ذخیره هم این کلیدها را نمی‌گیرد", async () => {
  const [block] = await reload([{ id: "a", type: "paragraph", data: { text: "متن" }, version: 1 }]);
  assert.equal(block.style, undefined, "style نباید ساخته شود");
  assert.equal(block.layout, undefined, "layout نباید ساخته شود");
  assert.deepEqual(Object.keys(block).sort(), ["data", "id", "type", "version"]);
});

test("بلوکِ قدیمی و بلوکِ استایل‌دار می‌توانند کنارِ هم باشند", async () => {
  const blocks = await reload([
    { id: "old", type: "paragraph", data: { text: "قدیمی" } },
    { id: "new", type: "paragraph", data: { text: "جدید" }, style: { spacing: "none" }, layout: { width: "1/2" } },
  ]);
  assert.equal(blocks[0].style, undefined);
  assert.equal(blocks[0].layout, undefined);
  assert.equal(blocks[1].style.spacing, "none");
  assert.equal(blocks[1].layout.width, "1/2");
});

test("حذفِ استایل واقعاً کلید را از سند پاک می‌کند", async () => {
  const saved = await Doc.create({ blocks: [{ id: "a", type: "paragraph", data: {}, style: { spacing: "lg" }, layout: { width: "1/2" } }] });
  // همان کاری که ویرایشگر می‌کند: آرایه‌ی بلوک‌ها بدونِ کلیدها دوباره نوشته می‌شود.
  saved.blocks = [{ id: "a", type: "paragraph", data: {} }];
  await saved.save();
  const found = await Doc.findById(saved._id).lean();
  assert.equal(found.blocks[0].style, undefined);
  assert.equal(found.blocks[0].layout, undefined);
});

// ——— دامِ strict-mode ————————————————————————————————————————————————

test("مقدارِ خارج از enum توسط اسکیما رد می‌شود (خطِ دفاعیِ دوم)", async () => {
  await assert.rejects(
    () => Doc.create({ blocks: [{ id: "a", type: "paragraph", data: {}, layout: { width: "3/4" } }] }),
    /not a valid enum value/i,
  );
  await assert.rejects(
    () => Doc.create({ blocks: [{ id: "a", type: "paragraph", data: {}, style: { spacing: "enormous" } }] }),
    /not a valid enum value/i,
  );
});

test("کلیدِ ناشناخته داخلِ style بی‌صدا دور ریخته می‌شود و بقیه می‌ماند", async () => {
  const [block] = await reload([{ id: "a", type: "paragraph", data: {}, style: { spacing: "sm", boxShadow: "0 0 9px red" } }]);
  assert.equal(block.style.spacing, "sm");
  assert.equal(block.style.boxShadow, undefined);
});

// ——— متنِ غنی ————————————————————————————————————————————————————————
// data از نوع Mixed است، پس کلیدِ html اسکیما لازم ندارد؛ ولی همین یعنی هیچ
// خطِ دفاعِ دومی هم ندارد و باید ثابت شود واقعاً ذخیره و بازخوانی می‌شود.

test("data.html پس از ذخیره و بارگذاری دوباره سالم برمی‌گردد", async () => {
  const html = 'این یک <b>جمله‌ی <span style="color:#aa4725">مهم</span></b> است';
  const [block] = await reload([{ id: "a", type: "paragraph", data: { text: "این یک جمله‌ی مهم است", html } }]);
  assert.equal(block.data.html, html);
  assert.equal(block.data.text, "این یک جمله‌ی مهم است");
});

test("style.align پس از ذخیره و بارگذاری دوباره سالم برمی‌گردد", async () => {
  for (const align of ["left", "center", "right"]) {
    const [block] = await reload([{ id: "a", type: "heading", data: { text: "ت" }, style: { align } }]);
    assert.equal(block.style?.align, align, align);
  }
});

test("چینشِ خارج از enum توسط اسکیما رد می‌شود", async () => {
  await assert.rejects(
    () => Doc.create({ blocks: [{ id: "a", type: "paragraph", data: {}, style: { align: "justify" } }] }),
    /not a valid enum value/i,
  );
});

test("بلوکِ متنیِ بدونِ قالب‌بندی نه html می‌گیرد نه align", async () => {
  const [block] = await reload([{ id: "a", type: "paragraph", data: { text: "متنِ ساده" } }]);
  assert.equal(block.data.html, undefined, "html نباید ساخته شود");
  assert.equal(block.style, undefined, "style نباید ساخته شود");
  assert.deepEqual(Object.keys(block.data), ["text"]);
});
