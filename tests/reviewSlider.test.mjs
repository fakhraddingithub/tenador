/**
 * tests/reviewSlider.test.mjs
 *
 * بلوکِ «اسلایدر نظرات»: انتخاب از میانِ همه‌ی نظرهای تأییدشده‌ی محصولِ نو و
 * دست‌دوم، و کارتِ نظرِ صفحه‌ی دست‌دوم که حالا یک کامپوننتِ مشترک است.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);
register("./listingFiltersHooks.mjs", import.meta.url);
process.env.MONGODB_URI_TENADOR = "mongodb://127.0.0.1:1/unused-test-placeholder";

// populate needs the referenced models compiled (registerModels is stubbed in tests)
await Promise.all(["User", "Product", "UsedProduct"].map((name) => import(`base/models/${name}`)));
const { getReviewCardsByIds, searchReviewCards, getApprovedUsedProductReviews } = await import("base/services/comment.service");
const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");
const { ARTICLE_BLOCK_TYPES } = await import("../src/lib/articleBlockTypes.js");

let server;
before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("review-slider"));
  global._mongooseCache.conn = mongoose;
});
after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const oid = () => new mongoose.Types.ObjectId();
const db = () => mongoose.connection;

async function seed() {
  const user = oid();
  const product = oid();
  const used = oid();
  await db().collection("users").insertOne({ _id: user, name: "سارا", lastName: "کریمی" });
  await db().collection("products").insertOne({ _id: product, name: "Wilson Clash 100", slug: "wilson-clash-100", mainImage: "https://ik.imagekit.io/x/clash.jpg" });
  await db().collection("usedproducts").insertOne({ _id: used, name: "Babolat Pure Drive (used)", slug: "pure-drive-used", images: ["https://ik.imagekit.io/x/pd.jpg"] });
  const at = (minutes) => new Date(Date.UTC(2026, 5, 1, 0, minutes));
  const comment = (extra) => ({ _id: oid(), user, text: "x", rating: 5, parent: null, product: null, usedProduct: null, images: [], ...extra });
  const c = {
    product: comment({ product, status: "approved", text: "دسته‌ی راحتی دارد", rating: 4, isVerifiedPurchase: false, createdAt: at(1) }),
    used: comment({ usedProduct: used, status: "approved", text: "سالم رسید", isVerifiedPurchase: true, createdAt: at(2) }),
    legacy: comment({ product, approved: true, text: "نظرِ قدیمی", createdAt: at(3) }),            // بدونِ status — تأییدشده‌ی قدیمی
    pending: comment({ product, status: "pending", text: "در انتظار", createdAt: at(4) }),
    rejected: comment({ product, status: "rejected", text: "رد شده", createdAt: at(5) }),
    reply: comment({ product, status: "approved", text: "پاسخ", createdAt: at(6) }),
    orphan: comment({ product: oid(), status: "approved", text: "محصولش حذف شده", createdAt: at(7) }),
  };
  c.reply.parent = c.product._id;
  await db().collection("comments").insertMany(Object.values(c));
  return c;
}

test("data: any approved top-level review of a new or used product, in the admin's order", async () => {
  const c = await seed();
  const id = (key) => String(c[key]._id);

  const cards = await getReviewCardsByIds([id("used"), id("pending"), id("product"), id("rejected"), id("reply"), id("orphan"), id("legacy"), "not-an-id"]);
  assert.deepEqual(cards.map((card) => card.id), [id("used"), id("product"), id("legacy")], "pending, rejected, replies and reviews of deleted products drop out");

  const [usedCard, productCard] = cards;
  // دست‌دوم: بدونِ href — کارت همان مسیرِ قبلیِ /second-hand/<slug> را می‌سازد
  assert.deepEqual(usedCard.product, { id: String((await db().collection("usedproducts").findOne())._id), name: "Babolat Pure Drive (used)", slug: "pure-drive-used", image: "https://ik.imagekit.io/x/pd.jpg" });
  assert.equal(productCard.product.href, "/products/wilson-clash-100");
  assert.equal(productCard.product.image, "https://ik.imagekit.io/x/clash.jpg");
  assert.equal(productCard.author, "سارا کریمی");
  assert.equal(productCard.isVerifiedPurchase, false, "the card hides «خریدار تأییدشده» for it");
  assert.equal(usedCard.isVerifiedPurchase, true);

  // picker: newest first with no query, both kinds; a query matches text, author or product
  const all = await searchReviewCards("");
  assert.deepEqual(all.map((card) => card.text), ["نظرِ قدیمی", "سالم رسید", "دسته‌ی راحتی دارد"]);
  assert.deepEqual((await searchReviewCards("pure drive")).map((card) => card.id), [id("used")]);
  assert.deepEqual((await searchReviewCards("راحتی")).map((card) => card.id), [id("product")]);
  assert.equal((await searchReviewCards("کریمی")).length, 3);

  // the second-hand page's own list keeps its shape (verified used-product reviews only)
  const page = await getApprovedUsedProductReviews(12);
  assert.deepEqual(page.map((card) => card.id), [id("used")]);
  assert.equal(page[0].product.href, undefined);
});

test("block: type, validator, registry, resolver and renderer", async () => {
  assert.ok(ARTICLE_BLOCK_TYPES.includes("reviewSlider"));
  const reviews = [String(oid()), String(oid())];
  const errors = {};
  assert.deepEqual(sanitizeArticleBlockData("reviewSlider", { reviews: [...reviews, reviews[0]], title: "x" }, errors, "blocks.0.data"), { reviews });
  assert.deepEqual(errors, {});
  const bad = {};
  sanitizeArticleBlockData("reviewSlider", { reviews: ["nope"] }, bad, "blocks.0.data");
  assert.ok(bad["blocks.0.data.reviews"]);

  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  const def = ARTICLE_BLOCKS.reviewSlider;
  assert.deepEqual(def.fields.map((field) => [field.key, field.entityType, field.browse]), [["reviews", "review", true]]);
  assert.deepEqual(def.styleKeys, ["spacing"]);

  const route = await read("../src/app/api/admin/article-cms/entities/route.js");
  assert.match(route, /type === "review"/);
  assert.match(route, /idFilter \? await getReviewCardsByIds\(ids\) : await searchReviewCards\(q\)/);
  const resolver = await read("../services/publicArticle.service.js");
  assert.match(resolver, /if \(block\.type === "reviewSlider"\) refs\.reviews\.push/);
  assert.match(resolver, /"series", "comments"\]/, "moderating a review purges cached articles");
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /<ReviewCoverflow reviews=\{reviews\} \/>/);
});

test("the slider renders the second-hand page's card, in a coverflow", async () => {
  const section = await read("../src/components/templates/secondHands/UsedProductReviewsSection.jsx");
  assert.match(section, /<UsedProductReviewCard key=\{review\.id\} review=\{review\} onOpenImage=\{setLightboxImage\} \/>/);
  assert.doesNotMatch(section, /<article/, "the card markup lives in one place only");

  const coverflow = await read("../src/components/features/articles/ReviewCoverflow.jsx");
  assert.match(coverflow, /import UsedProductReviewCard from "@\/components\/templates\/secondHands\/UsedProductReviewCard"/);
  assert.match(coverflow, /effect="coverflow"/);
  assert.match(coverflow, /centeredSlides/);
  assert.match(coverflow, /dir="rtl"/, "next is on the left: the centre card moves right and the left one takes its place");
  assert.match(coverflow, /scale: 0\.88/, "each step away from the centre is smaller");
  assert.match(coverflow, /stretch: "28%"/, "neighbours tuck behind the centre card (and stay visible on a phone)");
  assert.match(coverflow, /prefers-reduced-motion/);

  const card = await read("../src/components/templates/secondHands/UsedProductReviewCard.jsx");
  assert.match(card, /review\.product\.href \|\|/);
  assert.match(card, /review\.isVerifiedPurchase !== false/);
});
