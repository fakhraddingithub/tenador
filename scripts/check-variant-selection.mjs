/**
 * scripts/check-variant-selection.mjs
 *
 * خودآزمونِ منطقِ انتخابِ واریانت که کوییک‌ویو و صفحه‌ی محصول روی آن سوارند.
 * اگر این منطق بشکند، واریانت/قیمتِ اشتباه به سبد می‌رود — پس ارزشِ یک چکِ اجرایی را دارد.
 *
 *   node scripts/check-variant-selection.mjs
 */

import assert from "node:assert/strict";
import {
  groupVariantOptions,
  findMatchingVariant,
  defaultSelection,
  valueAvailable,
} from "../src/lib/variantImages.js";

// محصول A: دو ویژگی، ۳ واریانت (ترکیبِ قرمز/L وجود ندارد)
const A = [
  { _id: "a1", price: 10, attributes: { color: "قرمز", size: "M" } },
  { _id: "a2", price: 20, attributes: { color: "آبی", size: "M" } },
  { _id: "a3", price: 30, attributes: { color: "آبی", size: "L" } },
];

// محصول B: تک‌واریانتی
const B = [{ _id: "b1", price: 99, attributes: { color: "مشکی" } }];

// محصول C: attributes به‌صورت Map (سناریوی hydrate‌شده‌ی mongoose)
const C = [{ _id: "c1", price: 5, attributes: new Map([["color", "سبز"]]) }];

const optsA = groupVariantOptions(A);
const keysA = Object.keys(optsA);

// ── گروه‌بندیِ مقادیر ────────────────────────────────────────────────────────
assert.deepEqual(optsA, { color: ["قرمز", "آبی"], size: ["M", "L"] });
assert.deepEqual(groupVariantOptions(C), { color: ["سبز"] }, "Map باید پشتیبانی شود");
assert.deepEqual(groupVariantOptions([]), {});

// ── انتخابِ پیش‌فرض ──────────────────────────────────────────────────────────
// محصولِ چندواریانتی: هیچ ویژگیِ چندمقداری‌ای حدس زده نمی‌شود
assert.deepEqual(defaultSelection(optsA), {});
// محصولِ تک‌واریانتی: کاملاً انتخاب می‌شود تا قیمت/موجودی درست نشان داده شود
assert.deepEqual(defaultSelection(groupVariantOptions(B)), { color: "مشکی" });

// ── تطبیقِ واریانت ───────────────────────────────────────────────────────────
assert.equal(findMatchingVariant(A, { color: "آبی", size: "L" })?._id, "a3");
assert.equal(findMatchingVariant(A, { color: "قرمز", size: "L" }), null, "ترکیبِ ناموجود → null");
assert.equal(findMatchingVariant(A, {}), null, "انتخابِ خالی → null");
assert.equal(findMatchingVariant(C, { color: "سبز" })?._id, "c1", "Map باید پشتیبانی شود");

// ── نشتِ بینِ محصول‌ها: انتخابِ محصولِ A هرگز نباید در B واریانتی پیدا کند ──────
const leaked = { color: "آبی", size: "L" };
assert.equal(
  findMatchingVariant(B, leaked),
  null,
  "انتخابِ محصولِ قبلی نباید روی محصولِ جدید واریانت بدهد"
);
// و ویژگیِ اضافه (size) نباید نادیده گرفته شود
assert.equal(
  findMatchingVariant(B, { color: "مشکی", size: "L" }),
  null,
  "ویژگیِ نامربوطِ باقی‌مانده نباید نادیده گرفته شود"
);

// ── cascade: بعد از انتخابِ قرمز، سایزِ L نباید قابلِ انتخاب باشد ─────────────
assert.equal(valueAvailable(A, keysA, { color: "قرمز" }, "size", "L"), false);
assert.equal(valueAvailable(A, keysA, { color: "قرمز" }, "size", "M"), true);
// انتخابِ خودِ همان ویژگی نادیده گرفته می‌شود تا کاربر بتواند آزادانه عوضش کند
assert.equal(valueAvailable(A, keysA, { color: "قرمز", size: "M" }, "color", "آبی"), true);

// ── قیمت همیشه از واریانتِ تطبیق‌یافته می‌آید، نه از استیتِ قبلی ──────────────
assert.equal(findMatchingVariant(A, { color: "قرمز", size: "M" }).price, 10);
assert.equal(findMatchingVariant(B, { color: "مشکی" }).price, 99);

console.log("✓ منطقِ انتخابِ واریانت سالم است");
