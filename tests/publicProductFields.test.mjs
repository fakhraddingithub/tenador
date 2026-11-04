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
  PRODUCT_PAGE_BRAND_FIELDS,
  PRODUCT_PAGE_CATEGORY_FIELDS,
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
  const product = await load(PRODUCT_PAGE_BRAND_FIELDS, PRODUCT_PAGE_CATEGORY_FIELDS);
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
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.ok(!/populate\(\s*"(brand|category)"\s*\)/.test(source), `${path}: populate کامل`);
    assert.ok(!/populate\(\s*"brand category/.test(source), `${path}: populate کامل`);
  }
});
