/**
 * tests/variantIdentity.test.mjs
 *
 * قفل‌کردنِ خاصیتی که باگ اصلی از نبودش می‌آمد: ویرایشِ محصول نباید _id
 * واریانت‌ها را عوض کند. اینجا با mongoose و اسکیمای واقعیِ Variant اجرا
 * می‌شود تا محدودیت‌های اسکیما (categoryId الزامی، sku و slug یکتا، attributes
 * از نوع Map، هوکِ pre-save) هم واقعاً آزموده شوند — چیزی که تستِ خالصِ
 * planVariantReconciliation نمی‌تواند ببیند.
 *
 * همان توابعی صدا زده می‌شوند که خودِ روتِ ویرایشِ محصول صدا می‌زند، پس تست و
 * کدِ محصول نمی‌توانند از هم جدا بیفتند.
 *
 *   npm run test:variant-identity
 */

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// models/ با اسم‌های مستعارِ `base/*` به هم ارجاع می‌دهند
register("./aliasHooks.mjs", import.meta.url);

import { makeComboKey } from "../src/lib/variantKey.js";
import {
  planVariantReconciliation,
  applyVariantWrites,
  removePlannedVariants,
  orderedVariantIds,
} from "../src/lib/variantReconcile.js";

let mongod;
let Variant;
let Product;
let Category;

let CATEGORY_ID;
let OTHER_CATEGORY_ID;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "variant-identity" });

  ({ default: Variant } = await import("../models/Variant.js"));
  ({ default: Product } = await import("../models/Product.js"));
  ({ default: Category } = await import("../models/Category.js"));

  const sport = new mongoose.Types.ObjectId();

  // دستهٔ واقعی لازم است چون هوکِ pre("validate") واریانت، attributes را با
  // variantAttributes همین دسته می‌سنجد
  const category = await Category.create({
    title: "راکت",
    name: "racket",
    slug: "racket",
    sport,
    variantAttributes: [{ name: "Grip", label: "شماره گریپ" }],
  });
  CATEGORY_ID = category._id;

  // دسته‌ای که ویژگیِ Grip را مجاز نمی‌داند — برای آزمونِ اعتبارسنجی
  const other = await Category.create({
    title: "زه",
    name: "string",
    slug: "string",
    sport,
    variantAttributes: [{ name: "Gauge", label: "قطر" }],
  });
  OTHER_CATEGORY_ID = other._id;

  // ایندکس‌های یکتا (sku/slug) باید واقعاً ساخته شوند تا تخلف را بگیرند
  await Variant.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

/**
 * دقیقاً همان کاری که روتِ PUT انجام می‌دهد: نقشه ساخته می‌شود، نوشتن‌ها اعمال
 * می‌شوند، آرایهٔ محصول چیده و ذخیره می‌شود، و حذف در آخر انجام می‌شود.
 */
async function saveProduct(product, { variantOptions, variantDetails = {}, basePrice = 100, categoryId }) {
  if (categoryId === undefined) categoryId = CATEGORY_ID;
  const combinations = [];
  const keys = Object.keys(variantOptions).filter(
    (k) => Array.isArray(variantOptions[k]) && variantOptions[k].length > 0,
  );
  (function helper(index, current) {
    if (index === keys.length) {
      if (keys.length) combinations.push({ ...current });
      return;
    }
    for (const val of variantOptions[keys[index]]) {
      helper(index + 1, { ...current, [keys[index]]: val });
    }
  })(0, {});

  const existing = await Variant.find({ productId: product._id });

  const plan = planVariantReconciliation({
    existing,
    combinations,
    variantDetails,
    basePrice,
    categoryId,
    productId: String(product._id),
  });

  const idByKey = await applyVariantWrites({
    Variant,
    productId: product._id,
    plan,
  });

  product.variants = orderedVariantIds(plan, idByKey);
  await product.save();

  await removePlannedVariants({ Variant, plan });

  return plan;
}

async function makeProduct(name = "راکت تست") {
  return Product.create({
    name,
    shortDescription: "توضیح کوتاه",
    longDescription: "توضیح بلند",
    sku: `sku-${new mongoose.Types.ObjectId()}`,
    basePrice: 100,
    category: CATEGORY_ID,
    brand: new mongoose.Types.ObjectId(),
    sport: new mongoose.Types.ObjectId(),
    mainImage: "https://example.test/x.webp",
  });
}

// ─────────────────────────────────────────────────────────────

test("ویرایشِ بی‌ربط، _id واریانت‌ها را حفظ می‌کند", async () => {
  const product = await makeProduct();

  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] } });
  const firstPass = await Variant.find({ productId: product._id }).sort({ sku: 1 });
  assert.equal(firstPass.length, 2);
  const idsBefore = firstPass.map((v) => String(v._id)).sort();
  const skusBefore = firstPass.map((v) => v.sku).sort();

  // ذخیرهٔ دوباره با همان ترکیب‌ها — مثلِ عوض‌کردنِ توضیحاتِ محصول
  const plan = await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] } });

  const secondPass = await Variant.find({ productId: product._id }).sort({ sku: 1 });
  const idsAfter = secondPass.map((v) => String(v._id)).sort();

  assert.deepEqual(idsAfter, idsBefore, "_id واریانت‌ها نباید عوض شود");
  assert.deepEqual(secondPass.map((v) => v.sku).sort(), skusBefore, "SKU هم نباید عوض شود");
  assert.equal(plan.stats.created, 0);
  assert.equal(plan.stats.removed, 0);
  assert.equal(plan.stats.updated, 0);
});

test("ارجاعِ بیرونی (مثلِ آیتم سفارش) بعد از ویرایش هنوز resolve می‌شود", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] } });

  const l2 = await Variant.findOne({ productId: product._id, "attributes.Grip": "L2" });
  assert.ok(l2, "واریانتِ L2 ساخته شده است");
  const orderLineVariantRef = l2._id; // همان چیزی که در order.items[].variant می‌نشیند

  // چند ویرایشِ پشت‌سرهم، شاملِ تغییرِ قیمت و افزودنِ ترکیب
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] }, basePrice: 250 });
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3", "L4"] } });

  const stillThere = await Variant.findById(orderLineVariantRef);
  assert.ok(stillThere, "ارجاعِ سفارش نباید یتیم شود");
  assert.equal(stillThere.attributes.get("Grip"), "L2", "و باید هنوز همان واریانت باشد");
});

test("افزودن و حذفِ ترکیب، فقط همان‌ها را تغییر می‌دهد", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] } });

  const l2Before = await Variant.findOne({ productId: product._id, "attributes.Grip": "L2" });

  // L3 برداشته و L4 اضافه می‌شود
  const plan = await saveProduct(product, { variantOptions: { Grip: ["L2", "L4"] } });

  assert.equal(plan.stats.created, 1);
  assert.equal(plan.stats.removed, 1);

  const l2After = await Variant.findOne({ productId: product._id, "attributes.Grip": "L2" });
  assert.equal(String(l2After._id), String(l2Before._id), "L2 دست‌نخورده می‌ماند");

  assert.equal(await Variant.countDocuments({ productId: product._id, "attributes.Grip": "L3" }), 0);
  assert.equal(await Variant.countDocuments({ productId: product._id, "attributes.Grip": "L4" }), 1);
});

test("SKUِ واریانتِ تازه با SKUِ موجود تداخل نمی‌کند (ایندکسِ یکتا تخلف نمی‌دهد)", async () => {
  const product = await makeProduct();

  // چند دور افزودن/حذف که در طرحِ قدیمیِ «شماره بر اساس ایندکس» تداخل می‌ساخت
  await saveProduct(product, { variantOptions: { Grip: ["L1", "L2", "L3"] } });
  await saveProduct(product, { variantOptions: { Grip: ["L2"] } });
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3", "L4"] } });
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3", "L4", "L5"] } });

  const all = await Variant.find({ productId: product._id });
  const skus = all.map((v) => v.sku);
  assert.equal(new Set(skus).size, skus.length, "SKUها یکتا هستند");
  assert.equal(all.length, 4);
});

test("ترتیبِ product.variants از ترتیبِ ترکیب‌ها می‌آید", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L1", "L2", "L3"] } });

  const ordered = await Promise.all(
    product.variants.map((vid) => Variant.findById(vid)),
  );
  assert.deepEqual(
    ordered.map((v) => v.attributes.get("Grip")),
    ["L1", "L2", "L3"],
  );
});

test("قیمت و تصویرِ ترکیب به‌روز می‌شود بدونِ ساختِ سندِ تازه", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2"] } });
  const before = await Variant.findOne({ productId: product._id });

  const plan = await saveProduct(product, {
    variantOptions: { Grip: ["L2"] },
    variantDetails: {
      [makeComboKey({ Grip: "L2" })]: { price: 999, images: ["x.webp"] },
    },
  });

  assert.equal(plan.stats.created, 0);
  assert.equal(plan.stats.updated, 1);

  const after = await Variant.findById(before._id);
  assert.equal(String(after._id), String(before._id));
  assert.equal(after.price, 999);
  assert.deepEqual(after.images, ["x.webp"]);
});

test("واریانتِ جامانده (در product.variants نیست ولی سندش هست) دوباره وصل می‌شود", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2"] } });
  const orphan = await Variant.findOne({ productId: product._id });

  // شبیه‌سازیِ باگِ قدیمی: آرایه خالی شد ولی سندِ واریانت ماند
  product.variants = [];
  await product.save();

  const plan = await saveProduct(product, { variantOptions: { Grip: ["L2"] } });

  assert.equal(plan.stats.created, 0, "نباید سندِ تکراری بسازد");
  assert.equal(plan.stats.kept, 1);
  const reloaded = await Product.findById(product._id);
  assert.deepEqual(
    reloaded.variants.map(String),
    [String(orphan._id)],
    "واریانتِ جامانده دوباره به محصول وصل می‌شود",
  );
});

test("variantOptions خالی یعنی همهٔ واریانت‌ها برداشته می‌شوند", async () => {
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2", "L3"] } });

  await saveProduct(product, { variantOptions: {} });

  assert.equal(await Variant.countDocuments({ productId: product._id }), 0);
  const reloaded = await Product.findById(product._id);
  assert.deepEqual(reloaded.variants.map(String), []);
});

test("اعتبارسنجیِ اسکیما هنگام به‌روزرسانیِ واریانتِ حفظ‌شده هم اجرا می‌شود", async () => {
  // مسیرِ قدیمی همه‌چیز را create می‌کرد و همیشه از هوکِ pre("validate") رد
  // می‌شد. مسیرِ جدید نباید این گارد را دور بزند — updateOne هوک را اجرا
  // نمی‌کند، پس نوشتنِ واریانتِ حفظ‌شده باید از save() برود.
  const product = await makeProduct();
  await saveProduct(product, { variantOptions: { Grip: ["L2"] } });

  const before = await Variant.findOne({ productId: product._id });

  await assert.rejects(
    () =>
      saveProduct(product, {
        variantOptions: { Grip: ["L2"] },
        basePrice: 500, // تغییری لازم است تا نوشتن واقعاً اتفاق بیفتد
        categoryId: OTHER_CATEGORY_ID, // این دسته ویژگیِ Grip را مجاز نمی‌داند
      }),
    /Grip|واریانت|ویژگی/,
    "انتقال به دستهٔ ناسازگار باید رد شود، نه این‌که بی‌صدا نوشته شود",
  );

  const after = await Variant.findById(before._id);
  assert.equal(
    String(after.categoryId),
    String(CATEGORY_ID),
    "دستهٔ واریانت نباید نامعتبر شده باشد",
  );
});

test("چند ویرایشِ پیاپی هیچ سندِ اضافه یا یتیمی به‌جا نمی‌گذارد", async () => {
  const product = await makeProduct();

  for (let i = 0; i < 5; i++) {
    await saveProduct(product, {
      variantOptions: { Grip: ["L2", "L3"] },
      basePrice: 100 + i,
    });
  }

  const docs = await Variant.find({ productId: product._id });
  assert.equal(docs.length, 2);

  const reloaded = await Product.findById(product._id);
  assert.equal(reloaded.variants.length, 2);
  const listed = new Set(reloaded.variants.map(String));
  for (const d of docs) {
    assert.ok(listed.has(String(d._id)), "هر سند باید در آرایهٔ محصول باشد");
  }
});
