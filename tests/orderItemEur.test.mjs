/**
 * tests/orderItemEur.test.mjs
 *
 * گاردِ رگرسیونِ «قیمت یوروییِ سطحِ قلم» (services/orderEurRecalc.js).
 *
 * دو قاعده‌ای که این تست‌ها قفل می‌کنند و شکستنشان داده‌ی واقعیِ سفارش‌ها را
 * خراب می‌کند:
 *   ۱) سهمِ هر قلم = priceEUR × quantity (priceEUR قیمتِ **واحد** است).
 *   ۲) اگر هیچ قلمی قیمت یورویی نداشته باشد، مبلغ کلِ یوروییِ سفارش **اصلاً**
 *      لمس نمی‌شود — نه صفر می‌شود نه null. سفارش‌های قدیمی که فقط یک مبلغ کلِ
 *      دستی دارند دقیقاً به همین دلیل سالم می‌مانند.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  hasItemEur,
  sumItemsEUR,
  resolveOrderEurTotal,
  applyOrderEurTotal,
} from "../services/orderEurRecalc.js";

/* ─── hasItemEur ─────────────────────────────────────────────────────── */

test("hasItemEur: فقط عددِ واقعی «ثبت‌شده» حساب می‌شود", () => {
  assert.equal(hasItemEur(0), true, "صفر یک قیمتِ ثبت‌شده‌ی معتبر است");
  assert.equal(hasItemEur(12.5), true);
  assert.equal(hasItemEur(null), false);
  assert.equal(hasItemEur(undefined), false);
  assert.equal(hasItemEur(NaN), false);
  // فیلدِ غایب روی سفارش‌های قدیمی همان undefined است
  assert.equal(hasItemEur({}.priceEUR), false);
});

/* ─── sumItemsEUR ────────────────────────────────────────────────────── */

test("جمع = Σ(priceEUR × quantity) و اقلامِ بدون قیمت نادیده گرفته می‌شوند", () => {
  const { hasAny, sum, count } = sumItemsEUR([
    { priceEUR: 50, quantity: 2 }, // 100
    { priceEUR: 20, quantity: 1 }, //  20
    { priceEUR: null, quantity: 5 }, // نادیده
    { quantity: 3 }, // قلمِ قدیمی، بدون فیلد → نادیده
  ]);
  assert.equal(hasAny, true);
  assert.equal(count, 2);
  assert.equal(sum, 120);
});

test("تعدادِ نامعتبر/غایب به ۱ تبدیل می‌شود (هرگز صفر یا منفی)", () => {
  assert.equal(sumItemsEUR([{ priceEUR: 30 }]).sum, 30);
  assert.equal(sumItemsEUR([{ priceEUR: 30, quantity: 0 }]).sum, 30);
  assert.equal(sumItemsEUR([{ priceEUR: 30, quantity: -4 }]).sum, 30);
});

test("جمعِ اعشاری گِرد می‌شود تا دُمِ ممیز شناور نسازد", () => {
  const { sum } = sumItemsEUR([
    { priceEUR: 0.1, quantity: 1 },
    { priceEUR: 0.2, quantity: 1 },
  ]);
  assert.equal(sum, 0.3); // نه 0.30000000000000004
});

test("لیستِ خالی/نامعتبر امن است", () => {
  assert.deepEqual(sumItemsEUR([]), { hasAny: false, sum: 0, count: 0 });
  assert.deepEqual(sumItemsEUR(undefined), { hasAny: false, sum: 0, count: 0 });
  assert.deepEqual(sumItemsEUR(null), { hasAny: false, sum: 0, count: 0 });
});

test("قیمتِ صفر روی یک قلم، بازمحاسبه را فعال می‌کند (برخلاف null)", () => {
  const { hasAny, sum } = sumItemsEUR([{ priceEUR: 0, quantity: 3 }]);
  assert.equal(hasAny, true);
  assert.equal(sum, 0);
});

/* ─── resolveOrderEurTotal — سازگاری با گذشته ────────────────────────── */

test("سفارشِ قدیمی: هیچ قلمی قیمت ندارد → مبلغ کلِ دستی دست‌نخورده می‌ماند", () => {
  const legacyItems = [{ quantity: 2 }, { quantity: 1, priceEUR: null }];
  assert.equal(resolveOrderEurTotal(legacyItems, 850), 850);
  assert.equal(resolveOrderEurTotal(legacyItems, null), null);
});

test("پاک‌کردنِ آخرین قیمتِ قلم، مبلغ کل را صفر/پاک نمی‌کند", () => {
  // قبل: دو قلم قیمت داشتند و مبلغ کل ۱۰۰ بود
  assert.equal(resolveOrderEurTotal([{ priceEUR: 40, quantity: 1 }, { priceEUR: 60, quantity: 1 }], 0), 100);
  // بعد از پاک‌کردنِ هر دو: مبلغ کلِ ۱۰۰ حفظ می‌شود
  assert.equal(resolveOrderEurTotal([{ priceEUR: null, quantity: 1 }, { priceEUR: null, quantity: 1 }], 100), 100);
});

test("دست‌کم یک قیمتِ قلم → مبلغ کل با مجموع بازنویسی می‌شود (حتی اگر دستی فرق داشته باشد)", () => {
  const items = [{ priceEUR: 25, quantity: 4 }];
  assert.equal(resolveOrderEurTotal(items, 999), 100);
});

/* ─── applyOrderEurTotal ─────────────────────────────────────────────── */

test("applyOrderEurTotal مقدار را روی سند می‌نویسد و تغییر را گزارش می‌کند", () => {
  const order = { priceEUR: 10, items: [{ priceEUR: 5, quantity: 3 }] };
  assert.equal(applyOrderEurTotal(order), true);
  assert.equal(order.priceEUR, 15);

  // اجرای دوباره چیزی عوض نمی‌کند (idempotent)
  assert.equal(applyOrderEurTotal(order), false);
  assert.equal(order.priceEUR, 15);
});

test("applyOrderEurTotal روی سفارشِ بدون قیمتِ قلم هیچ نمی‌نویسد", () => {
  const order = { priceEUR: 700, items: [{ quantity: 2 }, { quantity: 1 }] };
  assert.equal(applyOrderEurTotal(order), false);
  assert.equal(order.priceEUR, 700, "مبلغ کلِ دستیِ سفارشِ قدیمی نباید لمس شود");
});

test("سفارشِ بدون فیلد یورو اصلاً نمی‌شکند", () => {
  const order = { items: [{ quantity: 1 }] };
  assert.equal(applyOrderEurTotal(order), false);
  assert.equal(order.priceEUR, undefined);
});

/* ─── استقلال از تومان ───────────────────────────────────────────────── */

test("هیچ فیلد تومانی خوانده یا نوشته نمی‌شود", () => {
  const order = {
    priceEUR: null,
    totalPrice: 5_000_000,
    subtotalPrice: 5_500_000,
    discountAmount: 500_000,
    couponDiscount: 0,
    paymentStatus: "PAID",
    items: [{ priceEUR: 30, quantity: 2, unitPrice: 2_500_000, unitDiscount: 250_000 }],
  };
  const snapshot = JSON.stringify({
    totalPrice: order.totalPrice,
    subtotalPrice: order.subtotalPrice,
    discountAmount: order.discountAmount,
    couponDiscount: order.couponDiscount,
    paymentStatus: order.paymentStatus,
    unitPrice: order.items[0].unitPrice,
    unitDiscount: order.items[0].unitDiscount,
  });

  applyOrderEurTotal(order);

  assert.equal(order.priceEUR, 60, "فقط مبلغ یورو تغییر می‌کند");
  assert.equal(
    JSON.stringify({
      totalPrice: order.totalPrice,
      subtotalPrice: order.subtotalPrice,
      discountAmount: order.discountAmount,
      couponDiscount: order.couponDiscount,
      paymentStatus: order.paymentStatus,
      unitPrice: order.items[0].unitPrice,
      unitDiscount: order.items[0].unitDiscount,
    }),
    snapshot,
    "هیچ فیلد تومانی نباید عوض شده باشد"
  );
});
