/**
 * tests/publicProductFields.test.mjs
 *
 * خروجیِ عمومیِ محصول داخل HTML می‌رود. این تست با اسکیمای واقعی و مونگوی واقعی
 * قفل می‌کند که پرامپت‌های AI به مرورگر نرسند و هر فیلدی که کارت، کوییک‌ویو و
 * صفحه‌ی محصول می‌خوانند همچنان برسد.
 *
 *   npm run test:public-product-fields
 */

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

const {
  CARD_BRAND_FIELDS,
  CARD_CATEGORY_FIELDS,
  LISTING_CATEGORY_FIELDS,
  PRODUCT_PAGE_BRAND_FIELDS,
  PUBLIC_ATTRIBUTES,
  PUBLIC_VARIANT_ATTRIBUTES,
  WITHOUT_AI_PROMPTS,
} = await import("../src/lib/publicProductFields.js");
const { default: Product } = await import("../models/Product.js");
const { default: Category } = await import("../models/Category.js");
const { default: Brand } = await import("../models/Brand.js");
const { buildLabelMap, attrUnits } = await import("../src/lib/variantImages.js");
const { filterAttributesByAudience } = await import("../utils/targetAudience.js");

const SECRET = "SECRET-AI-PROMPT";
let server;
let productId;
let tabItemId;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());

  tabItemId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();
  const brandId = new mongoose.Types.ObjectId();
  productId = new mongoose.Types.ObjectId();

  // نوشتنِ خام: این تست درباره‌ی خواندن است، نه اعتبارسنجیِ ساخت.
  await Category.collection.insertOne({
    _id: categoryId,
    title: "راکت",
    name: "racket",
    slug: "racket",
    icon: "category-icon.svg",
    image: "category.webp",
    sport: new mongoose.Types.ObjectId(),
    additionalSports: [],
    parent: null,
    order: 3,
    megaMenuFilterAttribute: "balance",
    prompts: [{ field: "name", context: SECRET }],
    technicalStatsPrompt: SECRET,
    attributes: [{
      name: "balance",
      label: "بالانس",
      description: "راهنمای بالانس",
      uiType: "text-input",
      required: true,
      filterable: true,
      options: ["head"],
      prompt: SECRET,
      targetAudiences: ["یونی سکس"],
      multiUnit: false,
      units: [],
    }],
    variantAttributes: [{
      name: "gripSize",
      label: "سایز گریپ",
      prompt: SECRET,
      multiUnit: true,
      units: ["EU", "US"],
    }],
    technicalStats: [{ name: "power", label: "قدرت", description: "توضیح", min: 0, max: 100 }],
    customTab: {
      enabled: true,
      name: "تکنولوژی",
      icon: "tab-icon.svg",
      prompt: SECRET,
      items: [{
        _id: tabItemId,
        title: "فریم",
        description: "توضیح آیتم",
        image: "tab-item.webp",
        link: "/tech",
        prompt: SECRET,
      }],
    },
  });
  await Brand.collection.insertOne({
    _id: brandId,
    name: "wilson",
    title: "ویلسون",
    slug: "wilson",
    country: "USA",
    foundedYear: 1913,
    description: "توضیح برند",
    icon: "brand-icon.svg",
    logo: "brand-logo.svg",
    monochromeLogo: "brand-mono.svg",
    image: "brand.webp",
    series: [],
    order: 1,
    prompts: [{ field: "name", context: SECRET }],
    articleBlocks: [{ id: "a", type: "paragraph", data: { text: SECRET } }],
  });
  await Product.collection.insertOne({ _id: productId, name: "راکت", category: categoryId, brand: brandId });
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

const load = (brandFields, categoryFields) =>
  Product.findById(productId).populate("brand", brandFields).populate("category", categoryFields).lean();

test("کارت و کوییک‌ویو: پرامپتی نمی‌رسد و داده‌ی موردنیاز می‌رسد", async () => {
  const product = await load(CARD_BRAND_FIELDS, CARD_CATEGORY_FIELDS);
  assert.ok(!JSON.stringify(product).includes(SECRET));

  // useOrderFlowCart و قیمت‌گذاری شناسه را می‌خوانند
  assert.ok(product.category._id);
  assert.ok(product.brand._id);

  // ProductCard و بخش برندِ QuickViewModal
  assert.equal(product.brand.icon, "brand-icon.svg");
  assert.equal(product.brand.logo, "brand-logo.svg");
  assert.equal(product.brand.slug, "wilson");
  assert.equal(product.brand.title, "ویلسون");
  assert.equal(product.brand.name, "wilson");

  // برچسب و واحدهای انتخابِ واریانت در QuickViewModal
  assert.deepEqual(buildLabelMap(product.category.variantAttributes), { gripSize: "سایز گریپ" });
  assert.deepEqual(attrUnits(product, "gripSize"), ["EU", "US"]);
});

test("صفحه‌ی محصول: فقط پرامپت‌ها و مقاله‌ی برند حذف می‌شوند", async () => {
  const product = await load(PRODUCT_PAGE_BRAND_FIELDS, WITHOUT_AI_PROMPTS);
  assert.ok(!JSON.stringify(product).includes(SECRET));

  const { category, brand } = product;
  for (const [key, value] of Object.entries({
    title: "راکت",
    name: "racket",
    slug: "racket",
    icon: "category-icon.svg",
    image: "category.webp",
    order: 3,
    megaMenuFilterAttribute: "balance",
  })) assert.deepEqual(category[key], value, `category.${key}`);
  assert.ok(category.sport);

  // تب مشخصات: فیلتر مخاطب، برچسب و راهنما
  const [attribute] = filterAttributesByAudience(category.attributes, "مردانه");
  assert.equal(attribute.label, "بالانس");
  assert.equal(attribute.description, "راهنمای بالانس");
  assert.equal(filterAttributesByAudience(category.attributes, "بچگانه").length, 0);

  assert.deepEqual(category.technicalStats, [{ name: "power", label: "قدرت", description: "توضیح", min: 0, max: 100 }]);
  assert.equal(category.variantAttributes[0].label, "سایز گریپ");
  assert.deepEqual(category.variantAttributes[0].units, ["EU", "US"]);

  // تب سفارشی: ProductTabs آیتم‌ها را با _id پیدا می‌کند
  assert.equal(category.customTab.enabled, true);
  assert.equal(category.customTab.name, "تکنولوژی");
  assert.equal(category.customTab.icon, "tab-icon.svg");
  assert.equal(String(category.customTab.items[0]._id), String(tabItemId));
  assert.equal(category.customTab.items[0].title, "فریم");
  assert.equal(category.customTab.items[0].description, "توضیح آیتم");
  assert.equal(category.customTab.items[0].image, "tab-item.webp");
  assert.equal(category.customTab.items[0].link, "/tech");

  for (const [key, value] of Object.entries({
    name: "wilson",
    title: "ویلسون",
    slug: "wilson",
    country: "USA",
    foundedYear: 1913,
    description: "توضیح برند",
    icon: "brand-icon.svg",
    logo: "brand-logo.svg",
    monochromeLogo: "brand-mono.svg",
    image: "brand.webp",
    order: 1,
  })) assert.deepEqual(brand[key], value, `brand.${key}`);
});

test("سرویس‌های عمومی برند و دسته را کامل populate نمی‌کنند", () => {
  for (const path of [
    "services/product.service.js",
    "services/relatedProducts.service.js",
    "services/publicArticle.service.js",
    "src/app/api/wishlist/route.js",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.ok(!/populate\(\s*"(brand|category)"\s*\)/.test(source), `${path}: populate کامل`);
    assert.ok(!/populate\(\s*"brand category/.test(source), `${path}: populate کامل`);
  }
});

test("فهرست کلیدهای ویژگی با اسکیمای واقعی یکی است و فقط prompt را کم دارد", () => {
  for (const [path, fields] of [["attributes", PUBLIC_ATTRIBUTES], ["variantAttributes", PUBLIC_VARIANT_ATTRIBUTES]]) {
    const schemaKeys = Object.keys(Category.schema.path(path).schema.paths).filter((key) => key !== "_id");
    const expected = schemaKeys.filter((key) => key !== "prompt").map((key) => `${path}.${key}`).sort();
    assert.ok(schemaKeys.includes("prompt"));
    assert.deepEqual(fields.split(" ").sort(), expected);
  }
});

test("صفحه‌ی لیست: برچسب و گزینه‌های واریانت می‌رسند و پرامپت نمی‌رسد", async () => {
  const product = await load(CARD_BRAND_FIELDS, LISTING_CATEGORY_FIELDS);
  assert.ok(!JSON.stringify(product).includes(SECRET));
  assert.deepEqual(buildLabelMap(product.category.variantAttributes), { gripSize: "سایز گریپ" });
  assert.deepEqual(attrUnits(product, "gripSize"), ["EU", "US"]);
  assert.equal(product.category.slug, "racket");
});

test("صفحات ورزش و برند: موجودیت بدون پرامپت خوانده می‌شود و مقاله‌ی برند می‌ماند", async () => {
  const brand = await Brand.findOne({ slug: "wilson" }).select(WITHOUT_AI_PROMPTS).lean();
  assert.equal(brand.prompts, undefined);
  assert.equal(brand.description, "توضیح برند");
  // getPageDataBySlug مینی‌مقاله‌ی برند را از همین سند می‌سازد
  assert.equal(brand.articleBlocks.length, 1);

  const category = await Category.findOne({ slug: "racket" }).select(WITHOUT_AI_PROMPTS).lean();
  assert.ok(!JSON.stringify(category).includes(SECRET));
  assert.equal(category.megaMenuFilterAttribute, "balance");
  assert.deepEqual(category.attributes[0].options, ["head"]);
  assert.equal(category.attributes[0].filterable, true);
});

test("خواندن‌های پنل ادمین دست نخورده‌اند و پرامپت را می‌گیرند", async () => {
  const category = await Category.findOne({ slug: "racket" }).lean();
  assert.equal(category.technicalStatsPrompt, SECRET);
  assert.equal(category.prompts[0].context, SECRET);
  assert.equal(category.attributes[0].prompt, SECRET);
  assert.equal(category.customTab.items[0].prompt, SECRET);

  for (const path of [
    "src/app/api/categories/route.js",
    "src/app/api/categories/[categoryId]/route.js",
    "src/app/api/brands/[brandId]/route.js",
    "src/app/api/product/[productId]/route.js",
    "src/app/api/query/route.js",
    "src/lib/productDraftPrompt.js",
    "src/lib/buildProductTemplate.js",
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.ok(!source.includes("publicProductFields"), `${path} نباید فیلدهای عمومی را به کار ببرد`);
  }
});
