/**
 * src/lib/variantReconcile.js
 *
 * تطبیقِ واریانت‌های موجودِ یک محصول با ترکیب‌های خواسته‌شده — بدونِ عوض‌کردنِ
 * هویتِ واریانت‌هایی که تغییری نکرده‌اند.
 *
 * چرا؟ پیش از این، روتِ ویرایشِ محصول همهٔ واریانت‌ها را `deleteMany` می‌کرد و
 * از نو می‌ساخت. یعنی هر ذخیرهٔ محصول — حتی عوض‌کردنِ توضیحات — به همهٔ
 * واریانت‌ها _id تازه می‌داد، در حالی که ترکیبِ ویژگی‌ها مو به مو همان بود.
 * هر ارجاعِ بیرونی به آن _idها می‌شکست:
 *
 *   • order.items[].variant  → populate نتیجهٔ null می‌داد و پنل ادمین
 *     واریانتِ سفارش را «نامشخص» نشان می‌داد.
 *   • itemtrackings.variantRef در دیتابیسِ انبار → اسکنِ بارکد روی سفارش با
 *     «این بارکد متعلق به واریانت دیگری از این محصول است» رد می‌شد، حتی وقتی
 *     بارکد و آیتمِ سفارش دقیقاً یک واریانت بودند.
 *
 * راه‌حل: ترکیبِ ویژگی‌ها (نه ترتیبِ ساخت) هویتِ واریانت است. واریانتِ موجود و
 * ترکیبِ خواسته‌شده با `makeComboKey` — همان کلیدی که کلاینت هم برای
 * variantDetails می‌سازد — به هم نگاشت می‌شوند:
 *
 *   ترکیب موجود است و خواسته شده  → همان سند update می‌شود (_id و SKU حفظ)
 *   ترکیب خواسته شده ولی نیست     → ساخته می‌شود
 *   ترکیب موجود ولی خواسته نشده   → حذف می‌شود (خواستِ صریحِ ادمین)
 *
 * این ماژول تصمیم را می‌سازد و چیزی نمی‌نویسد؛ نوشتن کارِ فراخوان است. همین
 * جداسازی باعث می‌شود منطق بدونِ دیتابیس تست شود (tests/variantReconcile.test.mjs).
 */

import { makeComboKey } from "./variantKey.js";

/** attributes ممکن است Map (سندِ hydrate‌شده) یا آبجکتِ ساده (lean) باشد */
function toPlainAttributes(attributes) {
  if (!attributes) return null;
  if (attributes instanceof Map) return Object.fromEntries(attributes);
  if (typeof attributes.toObject === "function") return attributes.toObject();
  if (typeof attributes === "object") return { ...attributes };
  return null;
}

/** کلیدِ هویتِ یک واریانتِ موجود — یا null اگر attributes خراب/خالی باشد */
function existingComboKey(variant) {
  const attrs = toPlainAttributes(variant?.attributes);
  if (!attrs || Object.keys(attrs).length === 0) return null;
  return makeComboKey(attrs);
}

function sameImages(a = [], b = []) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

/**
 * تولیدکنندهٔ SKUِ یکتا برای واریانت‌های تازه.
 * پیشوند شناسهٔ محصول است تا بینِ محصول‌ها تداخل نکند، و شماره از روی
 * SKUهای گرفته‌شده جلو می‌رود تا با واریانت‌های حفظ‌شده برخورد نکند.
 */
function makeSkuMinter(productId, takenSkus) {
  const taken = new Set(takenSkus);
  const prefix = `${productId}-V`.toUpperCase();
  let next = 1;
  return () => {
    let sku = `${prefix}${next}`;
    while (taken.has(sku)) {
      next += 1;
      sku = `${prefix}${next}`;
    }
    taken.add(sku);
    next += 1;
    return sku;
  };
}

/**
 * @param {object}   input
 * @param {Array}    input.existing        واریانت‌های فعلیِ محصول
 * @param {Array}    input.combinations    ترکیب‌های خواسته‌شده، به ترتیبِ نمایش
 * @param {object}   input.variantDetails  نگاشتِ comboKey → { price, images }
 * @param {number}   input.basePrice       قیمتِ پایهٔ محصول (fallback)
 * @param {*}        input.categoryId      دستهٔ فعلیِ محصول
 * @param {string}   input.productId       برای ساختِ SKUِ واریانت‌های تازه
 */
export function planVariantReconciliation({
  existing = [],
  combinations = [],
  variantDetails = {},
  basePrice = 0,
  categoryId = null,
  productId = "",
}) {
  // ─── نگاشتِ واریانت‌های موجود بر اساسِ ترکیب ───────────────────
  // اولین واریانتِ هر ترکیب برنده است؛ تکراری‌ها (دادهٔ خراب از باگ‌های
  // قبلی) حذف می‌شوند تا محصول دو واریانتِ هم‌ترکیب نداشته باشد.
  const byKey = new Map();
  const removes = [];

  for (const variant of existing) {
    const key = existingComboKey(variant);
    if (!key) {
      // بدونِ attributes سالم، هویتی برای تطبیق نیست
      removes.push({ id: variant._id, sku: variant.sku, comboKey: null });
      continue;
    }
    if (byKey.has(key)) {
      removes.push({ id: variant._id, sku: variant.sku, comboKey: key });
      continue;
    }
    byKey.set(key, variant);
  }

  // ─── پیمایشِ ترکیب‌های خواسته‌شده، به ترتیبِ نمایش ──────────────
  const keeps = [];
  const creates = [];
  const orderedKeys = [];
  const matchedKeys = new Set();
  const fallbackPrice = Number(basePrice) || 0;
  // categoryId روی اسکیمای Variant الزامی است. payloadِ بدونِ دسته یعنی «دست
  // نزن»، نه «خالی کن» — وگرنه یک ویرایشِ ناقص، دستهٔ واریانت‌ها را null می‌کرد.
  const nextCategoryId =
    categoryId === null || categoryId === undefined || categoryId === ""
      ? null
      : categoryId;

  const mintSku = makeSkuMinter(
    productId,
    existing.map((v) => v?.sku).filter(Boolean),
  );

  for (const combo of combinations) {
    const comboKey = makeComboKey(combo);
    // ترکیبِ تکراری در ورودی نادیده گرفته می‌شود تا دو سند برای یک ترکیب نسازیم
    if (matchedKeys.has(comboKey)) continue;
    matchedKeys.add(comboKey);
    orderedKeys.push(comboKey);

    const detail = variantDetails?.[comboKey] || {};
    const price = Number(detail.price) || fallbackPrice;
    const images = Array.isArray(detail.images) ? detail.images : [];

    const current = byKey.get(comboKey);

    if (!current) {
      creates.push({
        comboKey,
        attributes: { ...combo },
        price,
        images,
        categoryId: nextCategoryId,
        sku: mintSku(),
      });
      continue;
    }

    const keptCategoryId = nextCategoryId ?? current.categoryId ?? null;
    const changed =
      Number(current.price) !== price ||
      !sameImages(current.images, images) ||
      String(current.categoryId ?? "") !== String(keptCategoryId ?? "");

    keeps.push({
      id: current._id,
      sku: current.sku, // SKU هرگز عوض نمی‌شود — ارجاع‌های بیرونی به آن وابسته‌اند
      comboKey,
      attributes: { ...combo },
      price,
      images,
      categoryId: keptCategoryId,
      changed,
      // خودِ سند نگه داشته می‌شود تا نوشتن از مسیرِ save() برود و هوکِ
      // pre("validate") اسکیمای Variant اجرا شود (updateOne آن را رد می‌کند)
      doc: current,
    });
  }

  // ─── ترکیب‌هایی که دیگر خواسته نشده‌اند ────────────────────────
  for (const [key, variant] of byKey) {
    if (matchedKeys.has(key)) continue;
    removes.push({ id: variant._id, sku: variant.sku, comboKey: key });
  }

  return {
    keeps,
    creates,
    removes,
    orderedKeys,
    stats: {
      kept: keeps.length,
      created: creates.length,
      removed: removes.length,
      updated: keeps.filter((k) => k.changed).length,
    },
  };
}

/**
 * بخشِ سازندهٔ نقشه را روی دیتابیس می‌نویسد: به‌روزرسانی‌ها و ساخت‌ها.
 * حذف عمداً اینجا نیست — باید پس از ذخیرهٔ موفقِ خودِ محصول انجام شود تا یک
 * خطای میانی هرگز محصول را بی‌واریانت رها نکند.
 *
 * @returns {Map<string, any>} نگاشتِ comboKey → _id برای چیدنِ product.variants
 */
export async function applyVariantWrites({ Variant, productId, plan }) {
  const idByComboKey = new Map();
  if (!plan) return idByComboKey;

  for (const keep of plan.keeps) {
    idByComboKey.set(keep.comboKey, keep.id);
    // واریانتِ بدونِ تغییر اصلاً نوشته نمی‌شود — نه _id اش عوض می‌شود نه
    // محتوایش، پس نمی‌تواند از این مسیر خراب شود.
    if (!keep.changed) continue;

    // مسیرِ ترجیحی save() است تا هوکِ pre("validate") — که attributes را با
    // variantAttributes دسته می‌سنجد — مثلِ قبل اجرا شود. updateOne هوک‌های
    // سطحِ سند را اجرا نمی‌کند و می‌توانست بی‌صدا دادهٔ نامعتبر بنویسد.
    if (keep.doc && typeof keep.doc.save === "function") {
      keep.doc.price = keep.price;
      keep.doc.images = keep.images;
      if (keep.categoryId) keep.doc.categoryId = keep.categoryId;
      await keep.doc.save();
      continue;
    }

    const changes = { price: keep.price, images: keep.images };
    // دستهٔ الزامی هرگز با payloadِ بدونِ دسته خالی نمی‌شود
    if (keep.categoryId) changes.categoryId = keep.categoryId;

    await Variant.updateOne({ _id: keep.id }, { $set: changes });
  }

  for (const create of plan.creates) {
    const variant = await Variant.create({
      productId,
      categoryId: create.categoryId,
      attributes: create.attributes,
      price: create.price,
      images: create.images,
      sku: create.sku,
    });
    idByComboKey.set(create.comboKey, variant._id);
  }

  return idByComboKey;
}

/** حذفِ ترکیب‌هایی که ادمین واقعاً برداشته — فقط پس از ذخیرهٔ محصول */
export async function removePlannedVariants({ Variant, plan }) {
  if (!plan?.removes.length) return 0;
  const result = await Variant.deleteMany({
    _id: { $in: plan.removes.map((r) => r.id) },
  });
  return result?.deletedCount ?? 0;
}

/** چیدنِ آرایهٔ product.variants به ترتیبِ ترکیب‌های فرم */
export function orderedVariantIds(plan, idByComboKey) {
  return plan.orderedKeys
    .map((comboKey) => idByComboKey.get(comboKey))
    .filter(Boolean);
}
