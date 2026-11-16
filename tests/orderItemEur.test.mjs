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

/* ─── یوروی چک‌های اقساطی ────────────────────────────────────────────── */

import { eurSummary, eurPaidByLink, setLinkedEur, parseCheckEurAmount } from "../services/orderEurRecalc.js";

test("یوروی چکِ پاس‌شده یک ردیفِ paymentsEUR است و از مانده کسر می‌شود", () => {
  const checkA = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const order = {
    priceEUR: 300,
    paymentsEUR: [
      { amount: 100 }, // پیش‌پرداخت / پرداخت دستی
      { amount: 50.1, installmentCheck: checkA },
      { amount: 49.9, installmentCheck: checkA }, // ویرایش/افزودنِ دستی روی همان چک
    ],
  };
  assert.deepEqual(eurSummary(order), { priceEUR: 300, paidEUR: 200, remainingEUR: 100, unlinkedCount: 1 });
  assert.deepEqual(eurPaidByLink(order.paymentsEUR, "installmentCheck"), { [checkA]: 100 });
  // سفارش بدون مبلغ کلِ یورو: مانده null، نه صفر
  assert.deepEqual(eurSummary({ paymentsEUR: [] }), { priceEUR: null, paidEUR: 0, remainingEUR: null, unlinkedCount: 0 });
});

test("parseCheckEurAmount: الزامی فقط وقتی سفارش یورو دارد؛ ۰ مجاز، منفی نه", () => {
  assert.ok(parseCheckEurAmount(undefined, { required: true }).error);
  assert.ok(parseCheckEurAmount("", { required: true }).error);
  assert.deepEqual(parseCheckEurAmount(undefined, { required: false }), { value: null });
  assert.deepEqual(parseCheckEurAmount(0, { required: true }), { value: 0 });
  assert.deepEqual(parseCheckEurAmount("12.345", { required: true }), { value: 12.35 });
  assert.ok(parseCheckEurAmount(-1, { required: false }).error);
  assert.ok(parseCheckEurAmount("abc", { required: false }).error);
});

test("setLinkedEur: می‌سازد، ویرایش می‌کند (با تاریخچه)، با ۰ حذف می‌کند، و به بقیه دست نمی‌زند", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  const base = { adminId: "admin", now, note: "رسید" };
  const manual = { _id: "m", amount: 40 };
  const rcp = "pppppppppppppppppppppppp";

  // ساخت
  let r = setLinkedEur([manual], { ...base, field: "payment", id: rcp, amount: 25, newId: "n1" });
  assert.equal(r.changed, true);
  assert.equal(r.rows.length, 2);
  assert.deepEqual({ ...r.rows[1] }, { _id: "n1", amount: 25, note: "رسید", payment: rcp, confirmedBy: "admin", confirmedAt: now, createdAt: now, updatedAt: now });

  // همان مبلغ → بدون تغییر
  const same = setLinkedEur(r.rows, { ...base, field: "payment", id: rcp, amount: 25, newId: "n2" });
  assert.equal(same.changed, false);

  // ویرایش: همان ردیف (همان _id)، تاریخچه‌ی قبلی→جدید
  r = setLinkedEur(r.rows, { ...base, field: "payment", id: rcp, amount: 30, newId: "n3" });
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1]._id, "n1");
  assert.equal(r.rows[1].amount, 30);
  assert.deepEqual(r.rows[1].editHistory, [{ oldAmount: 25, newAmount: 30, at: now, by: "admin" }]);
  assert.equal(r.rows[0], manual, "ردیفِ دستی دست‌نخورده می‌ماند");

  // پیوندِ چک با همان شناسه ربطی به پیوندِ رسید ندارد
  const other = setLinkedEur(r.rows, { ...base, field: "installmentCheck", id: rcp, amount: 0 });
  assert.equal(other.changed, false);

  // ۰ → حذف
  r = setLinkedEur(r.rows, { ...base, field: "payment", id: rcp, amount: 0 });
  assert.equal(r.changed, true);
  assert.deepEqual(r.rows, [manual]);

  assert.throws(() => setLinkedEur([], { ...base, field: "order", id: rcp, amount: 1 }));
});

/* ─── اتصالِ ردیف‌های قدیمیِ «ثبت همراه تأیید رسید» به رسیدشان ─────────── */

import { matchLegacyReceiptRows, LEGACY_NOTE } from "../scripts/linkEurReceiptRows.mjs";

test("matchLegacyReceiptRows فقط با مدرکِ یکتا وصل می‌کند", () => {
  const t = (min) => new Date(Date.UTC(2026, 0, 1, 10, min));
  const receipts = [
    { _id: "A", bankReceipt: { reviewedAt: t(0) } },
    { _id: "B", bankReceipt: { reviewedAt: t(30) } },
    { _id: "C", bankReceipt: { reviewedAt: t(60) } },
    { _id: "D", bankReceipt: { reviewedAt: t(61) } },
  ];
  const rows = [
    { _id: "r1", note: LEGACY_NOTE, confirmedAt: t(1) },        // → A
    { _id: "r2", note: LEGACY_NOTE, confirmedAt: t(31) },       // B، ولی r3 هم B را می‌خواهد
    { _id: "r3", note: LEGACY_NOTE, confirmedAt: t(32) },
    { _id: "r4", note: LEGACY_NOTE, confirmedAt: t(62) },       // C و D هر دو در بازه
    { _id: "r5", note: LEGACY_NOTE, confirmedAt: t(200) },      // هیچ رسیدی
    { _id: "r6", note: "دستی", confirmedAt: t(1) },              // یادداشتِ دیگر: اصلاً بررسی نمی‌شود
    { _id: "r7", note: LEGACY_NOTE, confirmedAt: t(1), payment: "A" }, // از قبل وصل
  ];
  const { links, skipped } = matchLegacyReceiptRows(rows, receipts);
  assert.deepEqual(links, []);  // A را r7 دارد، پس r1 هم رها می‌شود
  assert.deepEqual(skipped.map((s) => s.rowId).sort(), ["r1", "r2", "r3", "r4", "r5"]);

  const clean = matchLegacyReceiptRows(rows.filter((r) => r._id !== "r7"), receipts);
  assert.deepEqual(clean.links, [{ rowId: "r1", paymentId: "A" }]);
  // ردیفِ ساخته‌شده پیش از تأیید هیچ‌وقت وصل نمی‌شود
  assert.deepEqual(matchLegacyReceiptRows([{ _id: "x", note: LEGACY_NOTE, confirmedAt: t(-1) }], receipts).links, []);
});
