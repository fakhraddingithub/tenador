/**
 * tests/blockConsolidation.test.mjs
 *
 * بلوک‌های تکراری حذف شدند و جانشینشان جای آن‌ها را گرفت: گالری → تصویر، محصولاتِ
 * دست‌دوم → اسلایدرِ محصولات (که حالا همان اسلایدرِ صفحه‌ی اصلی است)، اسلایدرِ برند →
 * نوارِ برندها؛ بلوک‌های پویا با محصولاتِ امروزشان به اسلایدرِ محصولات مهاجرت می‌کنند.
 * محتوای ذخیره‌شده نباید هیچ‌جا بشکند: نه در ذخیره، نه در رندر، نه در ویرایشگر.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
// نرخِ معلوم (آخر ثبت می‌شود، پس پیش از stubِ مشترک که ۱ برمی‌گرداند اجرا می‌شود)
register(`data:text/javascript,export async function load(url, context, next) {
  if (url.endsWith("/src/lib/Exchangerate.js")) return { format: "module", shortCircuit: true, source: "export const getCachedRate = async () => 100000;" };
  return next(url, context);
}`);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

const { upgradeLegacyBlocks, hasLegacyBlocks, hasConvertibleLegacyBlocks, LEGACY_BLOCK_TYPES } = await import("../src/lib/legacyArticleBlocks.js");
const { migrateLegacyBlocks } = await import("../src/lib/legacyBlockMigration.js");
const { sanitizeArticleBlocks } = await import("../src/lib/articleValidation.js");
const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");
const { ARTICLE_BLOCK_TYPES, FULL_BLEED_BLOCK_TYPES } = await import("../src/lib/articleBlockTypes.js");
const { PRODUCT_SLIDER_TEXT } = await import("../src/lib/homeBannerTexts.js");
const { BLOCK_DOCUMENT_TARGETS, blockArraysOf } = await import("../src/lib/blockDocumentTargets.js");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const has = (source, text, message) => assert.ok(source.includes(text), message || `missing: ${text}`);
const oid = () => String(new mongoose.Types.ObjectId());
const img = (n) => ({ url: `https://ik.imagekit.io/x/${n}.jpg`, caption: `زیرنویس ${n}` });

test("the nine blocks are gone from the type list and the library", async () => {
  const gone = ["gallery", "latestProducts", "bestSellers", "amazingOffers", "collectionSlider", "brandSlider", "categorySlider", "sportSlider", "usedProducts"];
  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  for (const type of gone) {
    assert.ok(!ARTICLE_BLOCK_TYPES.includes(type), type);
    assert.equal(ARTICLE_BLOCKS[type], undefined, type);
    assert.ok(LEGACY_BLOCK_TYPES.has(type), `${type} is still handled as legacy content`);
  }
  for (const type of ["productCard", "productSlider", "brandBar"]) assert.ok(ARTICLE_BLOCK_TYPES.includes(type) && ARTICLE_BLOCKS[type], type);
});

test("legacy content converts to its successor, nested ones included", () => {
  const brands = [oid(), oid()];
  const used = [oid()];
  const blocks = [
    { id: "g", type: "gallery", version: 1, style: { spacing: "md" }, data: { images: Array.from({ length: 14 }, (_, n) => img(n)) } },
    { id: "u", type: "usedProducts", version: 1, data: { title: "دست‌دوم", products: used } },
    { id: "b", type: "brandSlider", version: 1, data: { title: "برندها", brands } },
    { id: "d", type: "bestSellers", version: 1, data: { title: "پرفروش", limit: 8 } },
    { id: "c", type: "collectionSlider", version: 1, data: { collections: [oid()] } },
    { id: "m", type: "merged", version: 1, data: { blocks: [{ id: "mg", type: "gallery", version: 1, data: { images: ["https://ik.imagekit.io/x/s.jpg"] } }, { id: "p", type: "paragraph", version: 1, data: { text: "x" } }] } },
  ];
  assert.ok(hasLegacyBlocks(blocks) && hasConvertibleLegacyBlocks(blocks));
  const out = upgradeLegacyBlocks(blocks);
  assert.deepEqual(out.map((block) => [block.id, block.type]), [["g", "image"], ["g-2", "image"], ["u", "productSlider"], ["b", "brandBar"], ["m", "merged"]], "dynamic and collection blocks drop out");
  // 14 images → 12 + 2; caption kept as the alt; style kept
  assert.equal(out[0].data.images.length, 12);
  assert.equal(out[1].data.images.length, 2);
  assert.equal(out[0].data.images[0].alt, "زیرنویس 0");
  assert.equal(out[0].data.url, out[0].data.images[0].url);
  assert.deepEqual(out[0].style, { spacing: "md" });
  assert.deepEqual(out[2].data, { title: "دست‌دوم", products: [], usedProducts: used });
  assert.deepEqual(out[3].data, { brands });
  assert.deepEqual(out[4].data.blocks.map((block) => block.type), ["image", "paragraph"]);
  assert.equal(out[4].data.blocks[0].data.images[0].url, "https://ik.imagekit.io/x/s.jpg", "a plain-string gallery image survives");
  // the editor keeps the removed ones visible (they show a notice) — never silently
  const kept = upgradeLegacyBlocks(blocks, { keepRemoved: true });
  assert.deepEqual(kept.filter((block) => ["bestSellers", "collectionSlider"].includes(block.type)).map((block) => block.id), ["d", "c"]);
  assert.ok(!hasConvertibleLegacyBlocks(kept), "nothing convertible left, so the editor's effect cannot loop");
  assert.ok(!hasLegacyBlocks(upgradeLegacyBlocks(blocks)));
});

test("a document that still holds legacy blocks saves, converted", () => {
  const errors = {};
  const blocks = sanitizeArticleBlocks([
    { id: "g", type: "gallery", version: 1, data: { images: [img(1), img(2)] } },
    { id: "u", type: "usedProducts", version: 1, data: { products: [oid()] } },
    { id: "a", type: "amazingOffers", version: 1, data: { title: "x" } },
  ], errors);
  assert.deepEqual(errors, {}, "no «block type is not supported»");
  assert.deepEqual(blocks.map((block) => block.type), ["image", "productSlider"]);
  assert.equal(blocks[0].data.images.length, 2);
  assert.deepEqual(blocks[1].data.products, []);
  assert.equal(blocks[1].data.title, "", "its old (empty) title is kept, not replaced");
  assert.equal(blocks[1].data.cta, PRODUCT_SLIDER_TEXT.cta);
});

test("validators: product card, product slider, brand bar", () => {
  const product = oid();
  const used = oid();
  const e = {};
  // one or the other; an old card (product only) is unchanged
  assert.deepEqual(sanitizeArticleBlockData("productCard", { product }, e, "b"), { product, usedProduct: null });
  assert.deepEqual(sanitizeArticleBlockData("productCard", { usedProduct: used }, e, "b"), { product: null, usedProduct: used });
  assert.deepEqual(sanitizeArticleBlockData("productCard", { product, usedProduct: used }, e, "b"), { product, usedProduct: null });
  assert.deepEqual(sanitizeArticleBlockData("productCard", { product: null, usedProduct: null }, e, "b"), { product: null, usedProduct: null }, "a cleared pick is null, not []");
  // an old slider (title + products) keeps both and gains the homepage defaults
  assert.deepEqual(sanitizeArticleBlockData("productSlider", { title: "راکت‌ها", products: [product] }, e, "b"), { products: [product], usedProducts: [], title: "راکت‌ها", subtitle: PRODUCT_SLIDER_TEXT.subtitle, cta: PRODUCT_SLIDER_TEXT.cta, ctaHref: "/products" });
  assert.equal(sanitizeArticleBlockData("productSlider", { ctaHref: "/second-hand", cta: "" }, e, "b").ctaHref, "/second-hand");
  assert.equal(sanitizeArticleBlockData("productSlider", { cta: "" }, e, "b").cta, "", "an explicit empty button text hides the button");
  assert.deepEqual(e, {});
  const bad = {};
  sanitizeArticleBlockData("productSlider", { ctaHref: "javascript:alert(1)" }, bad, "b");
  assert.ok(bad["b.ctaHref"], "the button link is validated like every other link");
  // brand bar: absent = all brands; a list = exactly those (more than 50 allowed)
  assert.deepEqual(sanitizeArticleBlockData("brandBar", {}, e, "b"), {});
  const many = Array.from({ length: 80 }, oid);
  assert.equal(sanitizeArticleBlockData("brandBar", { brands: many }, e, "b").brands.length, 80);
  assert.deepEqual(sanitizeArticleBlockData("brandBar", { brands: [] }, e, "b"), { brands: [] });
});

test("migration: dynamic sections keep today's products; removed ones are reported; idempotent", async () => {
  const snapshotIds = [oid(), oid()];
  const seen = [];
  const snapshot = async (block) => { seen.push(block.type); return snapshotIds; };
  const blocks = [
    { id: "l", type: "latestProducts", version: 1, data: { title: "تازه‌ها", limit: 4 } },
    { id: "m", type: "merged", version: 1, data: { blocks: [{ id: "o", type: "amazingOffers", version: 1, data: {} }, { id: "s", type: "sportSlider", version: 1, data: { title: "ورزش‌ها" } }] } },
    { id: "g", type: "gallery", version: 1, data: { images: [img(1)] } },
  ];
  const report = await migrateLegacyBlocks(blocks, snapshot);
  assert.deepEqual(seen, ["latestProducts", "amazingOffers"]);
  assert.deepEqual(blocks.map((block) => block.type), ["productSlider", "merged", "image"]);
  assert.deepEqual(blocks[0].data, { title: "تازه‌ها", products: snapshotIds, usedProducts: [] });
  assert.deepEqual(blocks[1].data.blocks.map((block) => block.type), ["productSlider"], "the nested sport slider is removed");
  assert.deepEqual(report.removed, [{ type: "sportSlider", title: "ورزش‌ها" }]);
  assert.equal(report.converted.length, 3);
  const again = await migrateLegacyBlocks(blocks, snapshot);
  assert.deepEqual(again, { converted: [], removed: [] });
  assert.deepEqual(seen, ["latestProducts", "amazingOffers"], "no second snapshot");

  // the bottom mini-article sections are block documents too (they had been missed)
  const series = BLOCK_DOCUMENT_TARGETS.find((target) => target.collection === "series");
  assert.deepEqual(series.paths, ["articleBlocks", "articleBlocksBottom"]);
  const brand = BLOCK_DOCUMENT_TARGETS.find((target) => target.collection === "brands");
  const top = [];
  const bottom = [];
  assert.ok(blockArraysOf({ categoryArticles: [{ blocks: top, blocksBottom: bottom }] }, brand).includes(bottom));
});

test("full width, the homepage slider and brand bar reused, review pause 3s", async () => {
  for (const type of ["productSlider", "brandBar", "comparisonBanner", "matchBanner", "sportSeriesSlider", "reviewSlider"]) assert.ok(FULL_BLEED_BLOCK_TYPES.has(type), type);
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  has(renderer, "{inMerged ? banner : <FullBleed>{banner}</FullBleed>}");
  has(renderer, "{inMerged ? slider : <FullBleed>{slider}</FullBleed>}");
  has(renderer, "{inMerged ? bar : <FullBleed>{bar}</FullBleed>}");
  has(renderer, "const bleeds = !inMerged && items.every(({ child }) => FULL_BLEED_BLOCK_TYPES.has(child.type));", "two banners merged side by side are full width too");
  has(renderer, 'import BestSellers from "@/components/features/bestSellers/BestSellers"');
  // the first word of the title is the orange one, like «پرفروش‌ترین» on the homepage
  has(renderer, "highlight={title === undefined ? undefined : title.split(/\\s+/)[0]}");
  has(renderer, 'import BrandsTicker from "@/components/features/brandsTicker/BrandsTicker"');
  has(renderer, "const current = hasLegacyBlocks(blocks) ? upgradeLegacyBlocks(blocks) : blocks;");
  for (const removed of ["EntityCards", "dynamicProducts", '"gallery"']) assert.ok(!renderer.includes(removed), removed);

  const home = await read("../src/components/features/bestSellers/BestSellers.js");
  has(home, "title = PRODUCT_SLIDER_TEXT.title");
  has(home, "ctaLabel = PRODUCT_SLIDER_TEXT.cta");
  has(home, "<UsedProductCard product={product}");
  has((await read("../src/app/(Site)/page.js")), "<BestSellers products={bestSellers} rate={rate} />", "the homepage passes none of the new props");

  const reviews = await read("../src/components/features/articles/ReviewSlider.jsx");
  has(reviews, "const REVIEW_AUTOPLAY_DELAY = 3000;");
  has(reviews, "delay: REVIEW_AUTOPLAY_DELAY,");

  const ticker = await read("../services/brandTicker.service.js");
  has(ticker, "id: String(b._id),");
  has(ticker, '["ticker-brands-v2"]', "the cached shape without ids must not be served");
});

// ——— resolver، روی mongoِ واقعی ———————————————————————————————————————————
let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("block-consolidation"));
  global._mongooseCache = { conn: mongoose, promise: null };
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("resolver: used products in the card and the slider, ticker brands for the brand bar", async () => {
  const { resolveArticleEntities } = await import("base/services/publicArticle.service");
  const db = mongoose.connection;
  const used = new mongoose.Types.ObjectId();
  const sold = new mongoose.Types.ObjectId();
  await db.collection("usedproducts").insertMany([
    { _id: used, name: "Pure Drive (used)", price: 50, status: "available" },
    { _id: sold, name: "Sold one", price: 10, status: "sold" },
  ]);
  await db.collection("brands").insertMany([
    { name: "Wilson", title: "ویلسون", slug: "wilson", logo: "https://ik.imagekit.io/x/w.svg", order: 1 },
    { name: "Head", title: "هد", slug: "head", logo: "https://ik.imagekit.io/x/h.svg", order: 2 },
    { name: "NoLogo", title: "بی‌لوگو", slug: "nologo", order: 3 },
  ]);
  const entities = await resolveArticleEntities({ blocks: [
    { id: "c", type: "productCard", data: { usedProduct: String(used) } },
    { id: "s", type: "productSlider", data: { products: [], usedProducts: [String(sold), String(used)] } },
    { id: "b", type: "brandBar", data: {} },
  ] });
  assert.deepEqual(Object.keys(entities.maps.usedProducts), [String(used)], "a sold listing drops out");
  assert.equal(entities.maps.usedProducts[String(used)].price, 5000000, "euro → toman, as on /second-hand");
  assert.deepEqual(entities.tickerBrands.map((brand) => brand.slug), ["wilson", "head"], "the homepage ticker's own list: logo only, in order");
  assert.ok(entities.tickerBrands.every((brand) => mongoose.isValidObjectId(brand.id)));
  // legacy content resolves through its successor (usedProducts → slider's usedProducts)
  const legacy = await resolveArticleEntities({ blocks: [{ id: "u", type: "usedProducts", data: { products: [String(used)] } }] });
  assert.ok(legacy.maps.usedProducts[String(used)]);
});
