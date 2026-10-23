/**
 * tests/homeBanners.test.mjs
 *
 * دو بلوکِ «بنر ابزار مقایسه» و «بنر انتخاب هوشمند» — همان دو بنرِ صفحه‌ی اصلی،
 * فقط با متنِ قابلِ تنظیم — و پیش‌نمایشِ تمام‌عرض با ظرفِ صفحه‌ی عمومی.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);

const { COMPARISON_BANNER_TEXT, MATCH_BANNER_TEXT } = await import("../src/lib/homeBannerTexts.js");
const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");
const { ARTICLE_BLOCK_TYPES } = await import("../src/lib/articleBlockTypes.js");
const { PREVIEW_FRAMES } = await import("../src/lib/previewFrames.js");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const has = (source, text, message) => assert.ok(source.includes(text), message || `missing: ${text}`);

test("banners: the homepage renders them without props, so it keeps today's texts", async () => {
  const home = await read("../src/app/(Site)/page.js");
  has(home, "<ComparisonBanner />");
  has(home, "<MatchBanner />");
  for (const [file, defaults] of [["comparisonBanner/ComparisonBanner", COMPARISON_BANNER_TEXT], ["matchBanner/MatchBanner", MATCH_BANNER_TEXT]]) {
    const src = await read(`../src/components/features/${file}.jsx`);
    has(src, "title = TEXT.title, highlight = TEXT.highlight, description = TEXT.description, cta = TEXT.cta");
    // the texts live in one place: none of them is still hard-coded in the component
    for (const value of Object.values(defaults)) assert.ok(!src.includes(value), `hard-coded: ${value}`);
    // the line break after the first line stays one text node + <br />, as before
    has(src, "{`${title} `}<br />");
  }
  assert.equal(COMPARISON_BANNER_TEXT.highlight, "مقایسه محصولات");
  assert.equal(MATCH_BANNER_TEXT.highlight, "هوشمندانه پیدا کنید");
});

test("blocks: four texts and nothing else", async () => {
  for (const [type, defaults] of [["comparisonBanner", COMPARISON_BANNER_TEXT], ["matchBanner", MATCH_BANNER_TEXT]]) {
    assert.ok(ARTICLE_BLOCK_TYPES.includes(type));
    const errors = {};
    // a missing key is the default text; an explicit "" stays empty; anything else is dropped
    assert.deepEqual(sanitizeArticleBlockData(type, { href: "/x", color: "#000" }, errors, "b"), defaults);
    assert.deepEqual(sanitizeArticleBlockData(type, { title: " عنوان ", highlight: "", description: "توضیح", cta: "برو" }, errors, "b"), { title: "عنوان", highlight: "", description: "توضیح", cta: "برو" });
    assert.deepEqual(errors, {});

    const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
    const def = ARTICLE_BLOCKS[type];
    assert.deepEqual(def.defaults, defaults);
    assert.deepEqual(def.fields.map((field) => field.key), ["title", "highlight", "description", "cta"]);
    assert.deepEqual(def.styleKeys, ["spacing"], "no appearance settings: the banner looks exactly like the homepage");
  }
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  has(renderer, 'import ComparisonBanner from "@/components/features/comparisonBanner/ComparisonBanner"');
  has(renderer, 'import MatchBanner from "@/components/features/matchBanner/MatchBanner"');
  has(renderer, "<Banner title={data.title} highlight={data.highlight} description={data.description} cta={data.cta} />");
});

test("preview: full width beside the sidebar, inside the live page's own container", async () => {
  // the canvas cancels exactly the padding of the panel's <main>
  has(await read("../src/components/admin/Layout.jsx"), '<main className="flex-1 p-4 sm:p-6 min-w-0">');
  const canvas = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  has(canvas, '<div className={`-mx-4 sm:-mx-6${canEdit ? " pb-24" : ""}`}>');
  has(canvas, "data-bleed-root");

  // each frame is the live page's container — if a live page changes, this fails
  has(await read("../src/components/features/brands/BrandBrochure.jsx"), PREVIEW_FRAMES.brochure.column);
  has(await read("../src/components/features/brands/BrandMiniArticleSection.jsx"), PREVIEW_FRAMES.miniArticle.column);
  const article = await read("../src/components/features/articles/PublicArticlePage.jsx");
  has(article, "lg:grid-cols-[240px_minmax(0,820px)]");
  has(article, "rounded-[var(--radius)] bg-white px-5 py-3 md:px-10");
  has(PREVIEW_FRAMES.article.column, "max-w-[820px]");
  has(PREVIEW_FRAMES.article.column, "rounded-[var(--radius)] bg-white px-5 py-3 md:px-10");

  // no card, no narrow inner container left around the canvas
  for (const [file, frame] of [["admin/articles/ArticlePreview", "article"], ["admin/brochure/BrochurePreview", "brochure"], ["admin/articles/MiniArticlePreview", "miniArticle"]]) {
    const src = await read(`../src/components/${file}.jsx`);
    has(src, `frame={PREVIEW_FRAMES.${frame}}`);
    // the old wrappers: a card with padding, and a narrow inner container around the canvas
    for (const old of ["max-w-[1100px]", "a-card p-6 sm:p-12", '<div className="mx-auto max-w-[1440px]">', '<div className="mx-auto max-w-5xl">\n      <div className="a-card sticky']) {
      assert.ok(!src.replace(/\r\n/g, "\n").includes(old), `${file} still narrows the preview: ${old}`);
    }
  }
});
