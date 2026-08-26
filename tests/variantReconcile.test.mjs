import test from "node:test";
import assert from "node:assert/strict";

import { planVariantReconciliation } from "../src/lib/variantReconcile.js";
import { makeComboKey } from "../src/lib/variantKey.js";

const PRODUCT_ID = "6a528b73e5be0a1da11e33e3";
const CATEGORY_ID = "cat-1";

/** یک واریانتِ موجود، همان‌طور که از mongoose برمی‌گردد */
function existingVariant(id, attributes, extra = {}) {
  return {
    _id: id,
    sku: extra.sku ?? `${PRODUCT_ID}-V1`.toUpperCase(),
    attributes,
    price: extra.price ?? 100,
    images: extra.images ?? [],
    categoryId: extra.categoryId ?? CATEGORY_ID,
  };
}

function plan(overrides = {}) {
  return planVariantReconciliation({
    existing: [],
    combinations: [],
    variantDetails: {},
    basePrice: 100,
    categoryId: CATEGORY_ID,
    productId: PRODUCT_ID,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────
// هستهٔ باگ: ویرایشِ بی‌ربط نباید هویتِ واریانت را عوض کند
// ─────────────────────────────────────────────────────────────

test("یک ویرایشِ بدونِ تغییرِ واریانت، هیچ واریانتی نمی‌سازد و نمی‌کشد", () => {
  const l2 = existingVariant("v-l2", { Grip: "L2" }, { sku: "SKU-V1" });
  const l3 = existingVariant("v-l3", { Grip: "L3" }, { sku: "SKU-V2" });

  const result = plan({
    existing: [l2, l3],
    combinations: [{ Grip: "L2" }, { Grip: "L3" }],
    variantDetails: {
      [makeComboKey({ Grip: "L2" })]: { price: 100, images: [] },
      [makeComboKey({ Grip: "L3" })]: { price: 100, images: [] },
    },
  });

  assert.equal(result.creates.length, 0, "نباید واریانتِ جدیدی ساخته شود");
  assert.equal(result.removes.length, 0, "نباید واریانتی حذف شود");
  assert.deepEqual(
    result.keeps.map((k) => k.id),
    ["v-l2", "v-l3"],
    "_id ها باید دقیقاً حفظ شوند",
  );
  assert.deepEqual(result.keeps.map((k) => k.changed), [false, false]);
  assert.deepEqual(result.orderedKeys, [
    makeComboKey({ Grip: "L2" }),
    makeComboKey({ Grip: "L3" }),
  ]);
});

test("تغییرِ قیمتِ یک ترکیب، فقط همان را update می‌کند و _id را نگه می‌دارد", () => {
  const l2 = existingVariant("v-l2", { Grip: "L2" }, { price: 100 });
  const l3 = existingVariant("v-l3", { Grip: "L3" }, { price: 100 });

  const result = plan({
    existing: [l2, l3],
    combinations: [{ Grip: "L2" }, { Grip: "L3" }],
    variantDetails: {
      [makeComboKey({ Grip: "L2" })]: { price: 250, images: [] },
      [makeComboKey({ Grip: "L3" })]: { price: 100, images: [] },
    },
  });

  assert.equal(result.creates.length, 0);
  assert.equal(result.removes.length, 0);
  assert.equal(result.keeps[0].id, "v-l2");
  assert.equal(result.keeps[0].changed, true);
  assert.equal(result.keeps[0].price, 250);
  assert.equal(result.keeps[1].changed, false);
});

test("افزودنِ یک ترکیبِ تازه، فقط همان یکی را می‌سازد", () => {
  const l2 = existingVariant("v-l2", { Grip: "L2" });

  const result = plan({
    existing: [l2],
    combinations: [{ Grip: "L2" }, { Grip: "L3" }],
  });

  assert.deepEqual(result.keeps.map((k) => k.id), ["v-l2"]);
  assert.equal(result.removes.length, 0);
  assert.equal(result.creates.length, 1);
  assert.deepEqual(result.creates[0].attributes, { Grip: "L3" });
});

test("حذفِ یک ترکیب فقط همان واریانت را حذف می‌کند و بقیه دست‌نخورده می‌مانند", () => {
  const l2 = existingVariant("v-l2", { Grip: "L2" });
  const l3 = existingVariant("v-l3", { Grip: "L3" });

  const result = plan({
    existing: [l2, l3],
    combinations: [{ Grip: "L2" }],
  });

  assert.deepEqual(result.keeps.map((k) => k.id), ["v-l2"]);
  assert.deepEqual(result.removes.map((r) => r.id), ["v-l3"]);
  assert.equal(result.creates.length, 0);
});

// ─────────────────────────────────────────────────────────────
// ترتیب، کلیدها و مقادیرِ دشوار
// ─────────────────────────────────────────────────────────────

test("ترتیبِ نهایی از combinations می‌آید، نه از ترتیبِ واریانت‌های موجود", () => {
  const l3 = existingVariant("v-l3", { Grip: "L3" });
  const l2 = existingVariant("v-l2", { Grip: "L2" });

  const result = plan({
    existing: [l3, l2], // ترتیبِ معکوس در دیتابیس
    combinations: [{ Grip: "L2" }, { Grip: "L3" }],
  });

  assert.deepEqual(result.orderedKeys, [
    makeComboKey({ Grip: "L2" }),
    makeComboKey({ Grip: "L3" }),
  ]);
});

test("ترتیبِ درجِ کلیدهای ویژگی روی تطبیق اثر ندارد", () => {
  // واریانتِ موجود با ترتیبِ {color, gauge} ذخیره شده
  const v = existingVariant("v-1", { color: "آبی", gauge: "1.30" });

  // فرم ترکیب را با ترتیبِ معکوس می‌فرستد
  const result = plan({
    existing: [v],
    combinations: [{ gauge: "1.30", color: "آبی" }],
  });

  assert.equal(result.creates.length, 0);
  assert.equal(result.removes.length, 0);
  assert.deepEqual(result.keeps.map((k) => k.id), ["v-1"]);
});

test("مقادیرِ فارسی و مقادیرِ حاوی «-» یا «=» تداخل نمی‌کنند", () => {
  const a = existingVariant("v-a", { size: "M", color: "M" });
  const b = existingVariant("v-b", { model: "a-b", note: "c" });
  const c = existingVariant("v-c", { model: "a", note: "b-c" });

  const result = plan({
    existing: [a, b, c],
    combinations: [
      { size: "M", color: "M" },
      { model: "a-b", note: "c" },
      { model: "a", note: "b-c" },
    ],
  });

  assert.equal(result.creates.length, 0);
  assert.equal(result.removes.length, 0);
  assert.deepEqual(result.keeps.map((k) => k.id), ["v-a", "v-b", "v-c"]);
});

test("attributes به‌صورت Map (سندِ hydrate‌شدهٔ mongoose) هم تطبیق می‌خورد", () => {
  const v = existingVariant("v-map", new Map([["Grip", "L2"]]));

  const result = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }],
  });

  assert.equal(result.creates.length, 0);
  assert.equal(result.removes.length, 0);
  assert.deepEqual(result.keeps.map((k) => k.id), ["v-map"]);
});

// ─────────────────────────────────────────────────────────────
// ایمنی در برابرِ دادهٔ خراب
// ─────────────────────────────────────────────────────────────

test("واریانت‌های تکراری با یک ترکیب: اولی می‌ماند، بقیه حذف می‌شوند", () => {
  const first = existingVariant("v-first", { Grip: "L2" });
  const dup = existingVariant("v-dup", { Grip: "L2" });

  const result = plan({
    existing: [first, dup],
    combinations: [{ Grip: "L2" }],
  });

  assert.deepEqual(result.keeps.map((k) => k.id), ["v-first"]);
  assert.deepEqual(result.removes.map((r) => r.id), ["v-dup"]);
  assert.equal(result.creates.length, 0);
});

test("واریانتِ بدونِ attributes حذف می‌شود و ترکیبش از نو ساخته می‌شود", () => {
  const broken = existingVariant("v-broken", null);

  const result = plan({
    existing: [broken],
    combinations: [{ Grip: "L2" }],
  });

  assert.deepEqual(result.removes.map((r) => r.id), ["v-broken"]);
  assert.equal(result.creates.length, 1);
});

// ─────────────────────────────────────────────────────────────
// SKU
// ─────────────────────────────────────────────────────────────

test("SKUِ واریانت‌های حفظ‌شده هرگز عوض نمی‌شود", () => {
  const v = existingVariant("v-1", { Grip: "L2" }, { sku: "LEGACY-SKU-V1" });

  const result = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }],
  });

  assert.equal(result.keeps[0].sku, "LEGACY-SKU-V1");
});

test("SKUِ واریانتِ جدید با SKUهای موجود تداخل نمی‌کند", () => {
  const taken = `${PRODUCT_ID}-V1`.toUpperCase();
  const v = existingVariant("v-1", { Grip: "L2" }, { sku: taken });

  const result = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }, { Grip: "L3" }, { Grip: "L4" }],
  });

  const newSkus = result.creates.map((c) => c.sku);
  assert.equal(new Set(newSkus).size, newSkus.length, "SKUهای جدید یکتا هستند");
  assert.ok(!newSkus.includes(taken), "SKUِ گرفته‌شده دوباره استفاده نمی‌شود");
});

// ─────────────────────────────────────────────────────────────
// قیمت و دسته
// ─────────────────────────────────────────────────────────────

test("قیمتِ ۰ یا خالی به basePrice برمی‌گردد", () => {
  const result = plan({
    combinations: [{ Grip: "L2" }, { Grip: "L3" }],
    variantDetails: { [makeComboKey({ Grip: "L2" })]: { price: 0, images: [] } },
    basePrice: 777,
  });

  assert.equal(result.creates[0].price, 777);
  assert.equal(result.creates[1].price, 777);
});

test("تغییرِ دستهٔ محصول، دستهٔ واریانت‌های حفظ‌شده را هم به‌روز می‌کند", () => {
  const v = existingVariant("v-1", { Grip: "L2" }, { categoryId: "cat-old" });

  const result = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }],
    categoryId: "cat-new",
  });

  assert.equal(result.keeps[0].changed, true);
  assert.equal(result.keeps[0].categoryId, "cat-new");
});

test("دستهٔ خالی، دستهٔ واریانتِ موجود را پاک نمی‌کند", () => {
  // categoryId روی اسکیمای Variant الزامی است؛ payload بدونِ دسته نباید
  // مقدارِ موجود را null کند.
  const v = existingVariant("v-1", { Grip: "L2" }, { categoryId: "cat-old" });

  for (const emptyCategory of [null, undefined, ""]) {
    const result = plan({
      existing: [v],
      combinations: [{ Grip: "L2" }],
      categoryId: emptyCategory,
    });

    assert.equal(result.keeps[0].categoryId, "cat-old");
    assert.equal(result.keeps[0].changed, false);
  }
});

// ─────────────────────────────────────────────────────────────
// حالت‌های مرزی
// ─────────────────────────────────────────────────────────────

test("combinations خالی یعنی همهٔ واریانت‌ها حذف می‌شوند", () => {
  const result = plan({
    existing: [existingVariant("v-1", { Grip: "L2" })],
    combinations: [],
  });

  assert.deepEqual(result.removes.map((r) => r.id), ["v-1"]);
  assert.equal(result.keeps.length, 0);
  assert.equal(result.creates.length, 0);
});

test("محصولِ بدونِ واریانتِ قبلی، همه را می‌سازد", () => {
  const result = plan({ combinations: [{ Grip: "L2" }, { Grip: "L3" }] });

  assert.equal(result.creates.length, 2);
  assert.equal(result.keeps.length, 0);
  assert.equal(result.removes.length, 0);
});

test("تصاویرِ ترکیب وقتی تغییر کند، update علامت می‌خورد", () => {
  const v = existingVariant("v-1", { Grip: "L2" }, { images: ["a.webp"] });

  const same = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }],
    variantDetails: {
      [makeComboKey({ Grip: "L2" })]: { price: 100, images: ["a.webp"] },
    },
  });
  assert.equal(same.keeps[0].changed, false);

  const changed = plan({
    existing: [v],
    combinations: [{ Grip: "L2" }],
    variantDetails: {
      [makeComboKey({ Grip: "L2" })]: { price: 100, images: ["b.webp"] },
    },
  });
  assert.equal(changed.keeps[0].changed, true);
  assert.deepEqual(changed.keeps[0].images, ["b.webp"]);
});

test("خلاصهٔ آماری با خودِ آرایه‌ها هم‌خوان است", () => {
  const result = plan({
    existing: [
      existingVariant("v-l2", { Grip: "L2" }),
      existingVariant("v-l3", { Grip: "L3" }, { price: 100 }),
    ],
    combinations: [{ Grip: "L2" }, { Grip: "L4" }],
    variantDetails: { [makeComboKey({ Grip: "L2" })]: { price: 500, images: [] } },
  });

  assert.equal(result.stats.kept, result.keeps.length);
  assert.equal(result.stats.created, result.creates.length);
  assert.equal(result.stats.removed, result.removes.length);
  assert.equal(result.stats.updated, result.keeps.filter((k) => k.changed).length);
  assert.equal(result.stats.kept, 1);
  assert.equal(result.stats.created, 1);
  assert.equal(result.stats.removed, 1);
  assert.equal(result.stats.updated, 1);
});
