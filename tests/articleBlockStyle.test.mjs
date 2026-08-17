import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeArticleBlockStyle } from "../src/lib/articleBlockValidation.js";

// قاعده‌ی بنیادی: هر مقدارِ پیش‌فرض حذف می‌شود و اگر چیزی باقی نماند، خروجی
// undefined است. همین تضمین می‌کند بلوکی که استایل ندارد، دقیقاً مثل قبل رندر شود.

test("ورودی غایب یا نامعتبر undefined می‌دهد", () => {
  for (const value of [undefined, null, "", 0, false, [], "#fff", 42]) {
    assert.equal(sanitizeArticleBlockStyle(value), undefined);
  }
});

test("شیء خالی یا پر از کلیدهای ناشناخته undefined می‌دهد", () => {
  assert.equal(sanitizeArticleBlockStyle({}), undefined);
  assert.equal(sanitizeArticleBlockStyle({ nope: 1, padding: "10px", boxShadow: "0 0 0 red" }), undefined);
});

test("مقادیرِ پیش‌فرض حذف می‌شوند", () => {
  assert.equal(sanitizeArticleBlockStyle({ spacing: "md" }), undefined);
  assert.equal(sanitizeArticleBlockStyle({ tableVariant: "default" }), undefined);
  assert.equal(sanitizeArticleBlockStyle({ spacing: "md", tableVariant: "default" }), undefined);
});

test("فاصله‌ی معتبر نگه داشته می‌شود و نامعتبر حذف", () => {
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "none" }), { spacing: "none" });
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "sm" }), { spacing: "sm" });
  assert.deepEqual(sanitizeArticleBlockStyle({ spacing: "lg" }), { spacing: "lg" });
  assert.equal(sanitizeArticleBlockStyle({ spacing: "huge" }), undefined);
  assert.equal(sanitizeArticleBlockStyle({ spacing: 12 }), undefined);
});

test("فقط رنگِ هگزِ شش‌رقمی پذیرفته می‌شود", () => {
  assert.deepEqual(sanitizeArticleBlockStyle({ textColor: "#AA4725" }), { textColor: "#aa4725" });
  assert.deepEqual(sanitizeArticleBlockStyle({ background: "  #ffbf00  " }), { background: "#ffbf00" });
  assert.deepEqual(sanitizeArticleBlockStyle({ accent: "#000000" }), { accent: "#000000" });
});

// R7 — هیچ مقدارِ دلخواهِ CSS نباید به DOM برسد.
test("مقادیرِ خطرناک یا غیرِهگز به DOM راه نمی‌یابند", () => {
  const hostile = [
    "red",
    "rgb(1,2,3)",
    "#fff",
    "#12345",
    "#1234567",
    "#gggggg",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "var(--x)",
    "#fff;background:url(x)",
    "#aa4725 !important",
    "</style><script>alert(1)</script>",
    "calc(100% - 10px)",
    123456,
    {},
    [],
  ];
  for (const value of hostile) {
    assert.equal(sanitizeArticleBlockStyle({ textColor: value }), undefined, `textColor: ${String(value)}`);
    assert.equal(sanitizeArticleBlockStyle({ background: value }), undefined, `background: ${String(value)}`);
    assert.equal(sanitizeArticleBlockStyle({ accent: value }), undefined, `accent: ${String(value)}`);
  }
});

test("نوعِ جدولِ معتبر نگه داشته می‌شود و نامعتبر حذف", () => {
  assert.deepEqual(sanitizeArticleBlockStyle({ tableVariant: "striped" }), { tableVariant: "striped" });
  assert.deepEqual(sanitizeArticleBlockStyle({ tableVariant: "bordered" }), { tableVariant: "bordered" });
  assert.deepEqual(sanitizeArticleBlockStyle({ tableVariant: "plain" }), { tableVariant: "plain" });
  assert.equal(sanitizeArticleBlockStyle({ tableVariant: "zebra" }), undefined);
});

test("ترکیبِ کامل حفظ می‌شود و کلیدهای اضافه دور ریخته می‌شوند", () => {
  assert.deepEqual(
    sanitizeArticleBlockStyle({
      spacing: "lg",
      textColor: "#111111",
      background: "#eeeeee",
      accent: "#aa4725",
      tableVariant: "striped",
      margin: "40px",
      transform: "rotate(3deg)",
    }),
    { spacing: "lg", textColor: "#111111", background: "#eeeeee", accent: "#aa4725", tableVariant: "striped" },
  );
});

test("پاک‌سازی idempotent است", () => {
  const once = sanitizeArticleBlockStyle({ spacing: "sm", accent: "#AA4725", tableVariant: "default" });
  assert.deepEqual(once, { spacing: "sm", accent: "#aa4725" });
  assert.deepEqual(sanitizeArticleBlockStyle(once), once);
});
