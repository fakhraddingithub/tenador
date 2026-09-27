/**
 * tests/miniArticleSections.test.mjs
 *
 * مینی‌مقاله دو بخش دارد: بالای صفحه و پایینِ آن. این تست قفل می‌کند که
 * «دو بخش» یک *ویرایشگر* باشد نه دو ویرایشگر، و اینکه محتوای موجود (که فقط
 * بخشِ بالا دارد) بدونِ هیچ مهاجرتی درست بماند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("بخشِ پایینی فیلدِ خواهر است، نه تغییرِ شکلِ داده", async () => {
  const serie = await read("../models/Serie.js");
  const brand = await read("../models/Brand.js");
  assert.match(serie, /articleBlocksBottom: \{\s*\r?\n\s*type: \[ArticleBlockSchema\]/);
  // در categoryArticles، نه در بروشور: بروشور جای محتوای صفحه را می‌گیرد و
  // «بالا/پایین» آنجا معنا ندارد.
  const entry = brand.slice(brand.indexOf("categoryArticles: {"), brand.indexOf("logo:"));
  assert.match(entry, /blocksBottom: \{ type: \[ArticleBlockSchema\], default: \[\] \}/);
  const brochure = brand.slice(brand.indexOf("brochure: {"), brand.indexOf("categoryArticles: {"));
  assert.ok(!brochure.includes("blocksBottom"));
});

test("ذخیره‌ی یک بخش، بخشِ دیگر را نگه می‌دارد (undefined ≠ [])", async () => {
  const serieRoute = await read("../src/app/api/series/[id]/mini-article/route.js");
  // هر بخش جدا سنجیده می‌شود و فقط بخش‌های فرستاده‌شده نوشته می‌شوند.
  assert.match(serieRoute, /const touched = sections\.filter\(\(\[key\]\) => body\?\.\[key\] !== undefined\);/);
  assert.match(serieRoute, /\["blocks", "articleBlocks"\], \["blocksBottom", "articleBlocksBottom"\]/);

  const catRoute = await read("../src/app/api/brands/[brandId]/category-article/[categoryId]/route.js");
  assert.match(catRoute, /body\?\.blocks === undefined \? \(current\?\.blocks \|\| \[\]\)/);
  assert.match(catRoute, /body\?\.blocksBottom === undefined \? \(current\?\.blocksBottom \|\| \[\]\)/);
  // ورودی فقط وقتی برداشته می‌شود که *هر دو* بخش خالی باشند.
  assert.match(catRoute, /blocks\.length \|\| blocksBottom\.length/);
});

test("فرمِ برند هم بخشِ پایینی را حفظ می‌کند", async () => {
  const { sanitizeBrandCategoryArticles } = await import("../src/lib/brandCategoryArticles.js");
  const category = "6aae92516f1acd54535b4c03";
  const para = (id) => ({ id, type: "paragraph", version: 1, data: { text: "x" } });

  const kept = sanitizeBrandCategoryArticles([{ category, blocks: [para("t")], blocksBottom: [para("b")] }], {});
  assert.deepEqual(kept[0].blocks.map((x) => x.id), ["t"]);
  assert.deepEqual(kept[0].blocksBottom.map((x) => x.id), ["b"]);

  // فقط پایین هم یک ورودیِ معتبر است.
  const onlyBottom = sanitizeBrandCategoryArticles([{ category, blocks: [], blocksBottom: [para("b")] }], {});
  assert.equal(onlyBottom.length, 1);
  // محتوای قدیمی (بدونِ کلیدِ پایینی) معتبر می‌ماند و پایینش خالی می‌شود.
  const legacy = sanitizeBrandCategoryArticles([{ category, blocks: [para("t")] }], {});
  assert.deepEqual(legacy[0].blocksBottom, []);
  // هر دو خالی → ورودی نگه داشته نمی‌شود (قاعده‌ی قبلی).
  assert.deepEqual(sanitizeBrandCategoryArticles([{ category, blocks: [], blocksBottom: [] }], {}), []);
});

test("سرویسِ عمومی همیشه { top, bottom } می‌دهد", async () => {
  const service = await read("../services/miniArticle.service.js");
  assert.match(service, /const sections = \(top, bottom\) => \(\{/);
  assert.match(service, /sections\(entry\.blocks, entry\.blocksBottom\)/);
  assert.match(service, /sections\(doc\?\.articleBlocks, doc\?\.articleBlocksBottom\)/);
  // هر دو بخش با *همان* تابع رندر می‌شوند، پس نسخه‌ی دومی وجود ندارد.
  const page = await read("../src/app/(Site)/(sports)/[sportSlug]/[...slug]/page.jsx");
  assert.match(page, /buildMiniArticleSection\(article\?\.top, label\),\s*\r?\n\s*buildMiniArticleSection\(article\?\.bottom, label\),/);
  assert.equal((page.match(/belowContent=\{miniArticle\.bottom\}/g) || []).length, 3, "هر سه نما باید بخشِ پایینی را بگیرند");
});

test("هر سه نمای فهرست اسلاتِ پایینِ صفحه دارند", async () => {
  for (const name of ["BrandGroupedView", "SerieGroupedView", "SportPageClient"]) {
    const src = await read(`../src/components/templates/sports/${name}.jsx`);
    assert.match(src, /belowContent = null,/, name);
    assert.match(src, /\{belowContent\}/, name);
    // بالا دست‌نخورده می‌ماند.
    assert.match(src, /belowHero = null,/, name);
  }
});

test("دو بخش، یک ویرایشگر: یک DndContext مشترک", async () => {
  const doc = await read("../src/components/admin/articles/BlockDocumentEditor.jsx");
  // کشیدن از بخشی به بخشِ دیگر فقط زیرِ یک context ممکن است.
  assert.equal((doc.match(/<DndContext /g) || []).length, 1);
  assert.match(doc, /<BlockEditor\s*\r?\n\s*dnd=\{false\}/);
  assert.match(doc, /const from = sectionOf\(active\.id\);/);
  assert.match(doc, /const to = sectionOf\(over\.id\);/);
  // بخشِ خالی هم مقصدِ معتبری است (droppable روی خودِ ظرف).
  assert.match(doc, /useDroppable\(\{ id \}\)/);
  assert.match(doc, /id=\{`section:\$\{section\.key\}`\}/);

  // و BlockEditor بدونِ dnd فقط SortableContext می‌دهد؛ پیش‌فرضش عوض نشده.
  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /allow = null, dnd = true \}/);
  assert.match(editor, /function MaybeDndContext\(\{ enabled, sensors, onDragEnd, children \}\) \{/);
  assert.match(editor, /if \(!enabled\) return children;/);
});

test("کلیدهای بخش‌ها همان کلیدهای API هستند", async () => {
  const doc = await read("../src/components/admin/articles/BlockDocumentEditor.jsx");
  const keys = [...doc.slice(doc.indexOf("MINI_ARTICLE_SECTIONS")).matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.slice(0, 2), ["blocks", "blocksBottom"]);
  // ذخیره هر دو بخش را با هم می‌فرستد، پس هیچ‌کدام جا نمی‌ماند.
  assert.match(doc, /export const miniArticleBody = \(blocks\) => \(\{\s*\r?\n\s*blocks: listOf\(blocks\?\.blocks\),\s*\r?\n\s*blocksBottom: listOf\(blocks\?\.blocksBottom\),/);

  for (const file of ["series/SerieMiniArticleEditor", "brands/BrandCategoryArticleEditor"]) {
    const src = await read(`../src/components/admin/${file}.jsx`);
    assert.match(src, /sections=\{MINI_ARTICLE_SECTIONS\}/, file);
    assert.match(src, /toBody=\{miniArticleBody\}/, file);
  }
});

test("پیش‌نمایش هر دو بخش را با همان رندرکننده نشان می‌دهد", async () => {
  const preview = await read("../src/components/admin/articles/MiniArticlePreview.jsx");
  assert.match(preview, /const parts = sections \|\| \[\{ key: "blocks", blocks, entities, endpoint \}\];/);
  // جایگاهِ محتوای صفحه بینِ دو بخش، تا ترتیبِ واقعی دیده شود.
  assert.match(preview, /\{sections && index === 0 \? <PageContentPlaceholder \/> : null\}/);
  // همان PreviewCanvas، یعنی همان ArticleBlockRenderer عمومی.
  assert.match(preview, /<PreviewCanvas blocks=\{part\.blocks\}/);

  // هر بوم فقط بخشِ خودش را می‌فرستد.
  const canvas = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.match(canvas, /\[endpoint\.key \|\| "blocks"\]: blocks/);
});
