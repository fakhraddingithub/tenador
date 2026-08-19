/**
 * tests/richText.test.mjs
 *
 * واژگانِ متنِ غنی عمداً بسیار کوچک است: فقط تگ‌های درون‌خطیِ قالب‌بندی، و از
 * میانِ صفت‌ها فقط href و یک style با دو خاصیتِ محدود. هر چیزِ دیگری باید دور
 * ریخته شود — این فایل همان مرزِ اعتماد را می‌سنجد.
 *
 * نکته‌ی سازگاریِ عقب‌رو: richTextValue وقتی هیچ قالب‌بندیِ واقعی وجود ندارد
 * رشته‌ی خالی می‌دهد، تا کلیدِ html اصلاً ذخیره نشود و بلوک دقیقاً از همان
 * مسیرِ رندرِ فعلی (متنِ ساده) عبور کند.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { RICH_TEXT_FONT_SIZES, richTextValue, sanitizeRichText } from "../src/lib/sanitizeRichText.js";

// ——— ورودی‌های غیررشته‌ای ————————————————————————————————————————————

test("ورودی غایب یا غیررشته‌ای رشته‌ی خالی می‌دهد", () => {
  for (const value of [undefined, null, "", 0, false, [], {}]) {
    assert.equal(sanitizeRichText(value), "");
    assert.equal(richTextValue(value), "");
  }
});

// ——— تگ‌های مجاز ————————————————————————————————————————————————————

test("تگ‌های قالب‌بندیِ درون‌خطی حفظ می‌شوند", () => {
  assert.equal(
    sanitizeRichText("<b>پررنگ</b><i>کج</i><u>زیرخط</u><s>خط‌خورده</s><em>e</em><strong>s</strong>"),
    "<b>پررنگ</b><i>کج</i><u>زیرخط</u><s>خط‌خورده</s><em>e</em><strong>s</strong>",
  );
});

test("متنِ ساده دست‌نخورده می‌ماند و کاراکترهای خطرناک escape می‌شوند", () => {
  assert.equal(sanitizeRichText("یک جمله‌ی مهم"), "یک جمله‌ی مهم");
  assert.equal(sanitizeRichText("a < b & c"), "a &lt; b &amp; c");
});

// ——— حمله‌ها ————————————————————————————————————————————————————————

test("تگ‌ها و صفت‌های خطرناک کاملاً حذف می‌شوند", () => {
  const attacks = [
    ["<script>alert(1)</script>", ""],
    ["<img src=x onerror=alert(1)>", ""],
    ["<iframe src=\"https://evil.test\"></iframe>", ""],
    ["<style>body{display:none}</style>", ""],
    ["<b onclick=\"alert(1)\">x</b>", "<b>x</b>"],
    ["<span onmouseover=alert(1)>x</span>", "<span>x</span>"],
    ["<svg/onload=alert(1)>", ""],
    ["<object data=\"x\"></object>", ""],
    ["<form action=\"/x\"><input name=\"p\"></form>", ""],
  ];
  for (const [input, expected] of attacks) {
    assert.equal(sanitizeRichText(input), expected, input);
  }
});

test("طرح‌های خطرناک در پیوند پذیرفته نمی‌شوند", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,<script>x</script>", "vbscript:x", "//evil.test/x"]) {
    const result = sanitizeRichText(`<a href="${href}">متن</a>`);
    assert.equal(result.includes("href"), false, href);
    assert.equal(result.includes("متن"), true, "متنِ پیوند باید بماند");
  }
});

test("طرح‌های مجاز در پیوند حفظ می‌شوند", () => {
  for (const href of ["https://tenador.com/x", "http://tenador.com", "mailto:a@b.test", "tel:+982100"]) {
    assert.equal(sanitizeRichText(`<a href="${href}">م</a>`).includes(`href="${href}"`), true, href);
  }
});

test("پیوندِ تبِ جدید همیشه rel امن می‌گیرد", () => {
  const result = sanitizeRichText('<a href="https://x.test" target="_blank">م</a>');
  assert.equal(result.includes('rel="noopener noreferrer"'), true);
});

// ——— استایلِ درون‌خطی: هیچ CSSِ دلخواهی نباید عبور کند ————————————————

test("فقط رنگِ هگز یا rgb پذیرفته می‌شود", () => {
  assert.equal(sanitizeRichText('<span style="color:#aa4725">x</span>'), '<span style="color:#aa4725">x</span>');
  assert.equal(sanitizeRichText('<span style="color:rgb(170, 71, 37)">x</span>'), '<span style="color:rgb(170, 71, 37)">x</span>');
  for (const bad of ["red", "var(--x)", "url(javascript:alert(1))", "expression(alert(1))", "#fff", "#12345678"]) {
    assert.equal(sanitizeRichText(`<span style="color:${bad}">x</span>`), "<span>x</span>", bad);
  }
});

test("فقط اندازه‌های فهرست‌شده پذیرفته می‌شوند", () => {
  for (const size of RICH_TEXT_FONT_SIZES) {
    assert.equal(sanitizeRichText(`<span style="font-size:${size}">x</span>`), `<span style="font-size:${size}">x</span>`, size);
  }
  for (const bad of ["99em", "1.3em", "40px", "300%", "xx-large", "calc(1em + 5px)"]) {
    assert.equal(sanitizeRichText(`<span style="font-size:${bad}">x</span>`), "<span>x</span>", bad);
  }
});

test("خاصیت‌های CSSِ خارج از واژگان دور ریخته می‌شوند", () => {
  const result = sanitizeRichText('<span style="color:#aa4725;position:fixed;background:url(x);width:9999px">x</span>');
  assert.equal(result, '<span style="color:#aa4725">x</span>');
});

test("style روی تگی که اجازه ندارد نمی‌نشیند", () => {
  assert.equal(sanitizeRichText('<a href="https://x.test" style="color:#aa4725">م</a>').includes("style"), false);
});

// ——— شکستِ خط ————————————————————————————————————————————————————————

test("بلوک‌هایی که contentEditable می‌سازد به br تبدیل می‌شوند", () => {
  assert.equal(sanitizeRichText("خط۱<div>خط۲</div><div>خط۳</div>"), "خط۱<br />خط۲<br />خط۳");
  assert.equal(sanitizeRichText("<p>الف</p><p>ب</p>"), "الف<br />ب");
});

test("br های ابتدا و انتها حذف می‌شوند", () => {
  assert.equal(sanitizeRichText("<br>متن<br><br>"), "متن");
  assert.equal(sanitizeRichText("  <br /> متن "), "متن");
});

// ——— richTextValue: تصمیمِ «ذخیره بشود یا نه» ————————————————————————

test("متنِ بدونِ قالب‌بندی ذخیره نمی‌شود", () => {
  assert.equal(richTextValue("یک جمله‌ی ساده"), "");
  assert.equal(richTextValue("a < b & c"), "");
  assert.equal(richTextValue("<script>alert(1)</script>سلام"), "");
});

test("شکستِ خطِ تنها هم قالب‌بندی به حساب نمی‌آید", () => {
  // خطِ چندتایی از راهِ data.text و whitespace-pre-line هم درست رندر می‌شود،
  // پس بلوک بی‌دلیل به مسیرِ HTML منتقل نمی‌شود.
  assert.equal(richTextValue("خط۱<div>خط۲</div>"), "");
  assert.equal(richTextValue("خط۱<br>خط۲"), "");
});

test("قالب‌بندیِ واقعی ذخیره می‌شود", () => {
  assert.equal(richTextValue("این یک جمله‌ی <b>مهم</b> است"), "این یک جمله‌ی <b>مهم</b> است");
  assert.equal(richTextValue('<span style="color:#aa4725">رنگی</span>'), '<span style="color:#aa4725">رنگی</span>');
  assert.equal(richTextValue('یک <a href="https://x.test">پیوند</a>'), 'یک <a href="https://x.test">پیوند</a>');
});

test("قالب‌بندی همراه با شکستِ خط ذخیره می‌شود", () => {
  assert.equal(richTextValue("<b>الف</b><div>ب</div>"), "<b>الف</b><br />ب");
});

test("spanِ خالی‌شده پس از حذفِ استایل، قالب‌بندی به حساب نمی‌آید", () => {
  // <span style="color:red"> استایلش رد می‌شود و <span> بی‌خاصیت می‌ماند؛ این
  // نباید بلوک را از مسیرِ متنِ ساده خارج کند.
  assert.equal(richTextValue('<span style="color:red">متن</span>'), "");
});

// ——— محدودیتِ اندازه ————————————————————————————————————————————————

test("خروجی بیش از سقف رشد نمی‌کند", () => {
  const long = `<b>${"ا".repeat(300000)}</b>`;
  assert.equal(sanitizeRichText(long).length <= 200000, true);
});

// ——— شکلِ دادهٔ ذخیره‌شده (سازگاریِ عقب‌رو) ————————————————————————————
// مهم‌ترین ادعای این تغییر: بلوکِ بدونِ قالب‌بندی باید دقیقاً همان شیئی بماند که
// پیش از این ساخته می‌شد — نه کلیدِ اضافه، نه مقدارِ عوض‌شده.

const { sanitizeArticleBlockData } = await import("../src/lib/articleBlockValidation.js");
const clean = (type, data) => sanitizeArticleBlockData(type, data, {}, "blocks.0.data");

test("بلوک‌های متنیِ قدیمی بایت‌به‌بایت همان می‌مانند", () => {
  assert.deepEqual(clean("paragraph", { text: "متنِ ساده" }), { text: "متنِ ساده" });
  assert.deepEqual(clean("heading", { text: "تیتر", level: "h3" }), { text: "تیتر", level: "h3" });
  assert.deepEqual(clean("quote", { text: "نقل", author: "کسی" }), { text: "نقل", author: "کسی" });
});

test("htmlِ بی‌قالب‌بندی هم ذخیره نمی‌شود", () => {
  assert.deepEqual(clean("paragraph", { text: "متن", html: "متن" }), { text: "متن" });
  assert.deepEqual(clean("paragraph", { text: "خط۱\nخط۲", html: "خط۱<div>خط۲</div>" }), { text: "خط۱\nخط۲" });
});

test("قالب‌بندیِ واقعی در کنارِ متنِ ساده ذخیره می‌شود", () => {
  assert.deepEqual(
    clean("paragraph", { text: "یک جمله‌ی مهم", html: "یک جمله‌ی <b>مهم</b>" }),
    { text: "یک جمله‌ی مهم", html: "یک جمله‌ی <b>مهم</b>" },
  );
});

test("htmlِ آلوده پیش از ذخیره پاک می‌شود", () => {
  assert.deepEqual(
    clean("quote", { text: "نقل", author: "", html: '<b>نقل</b><script>alert(1)</script><img src=x onerror=alert(1)>' }),
    { text: "نقل", html: "<b>نقل</b>", author: "" },
  );
});

// رگرسیونِ «قالب‌بندی در ویرایشگر بود ولی در صفحه‌ی عمومی نبود»: ویرایشگر با
// styleWithCSS=true فرمانِ bold/italic/underline را اجرا می‌کرد و مرورگر
// <span style="font-weight:bold"> می‌ساخت. این شکل عمداً مجاز نیست (استایلِ
// دلخواه به DOM نمی‌رسد)، پس پاک‌سازی استایل را می‌انداخت و richTextValue
// خروجی را «بدونِ قالب‌بندی» می‌دید — یعنی data.html اصلاً ذخیره نمی‌شد.
// RichTextField حالا این فرمان‌ها را با styleWithCSS=false اجرا می‌کند.
test("قالب‌بندیِ CSSای ذخیره نمی‌شود ولی شکلِ تگی می‌ماند", () => {
  for (const css of [
    '<span style="font-weight: bold;">م</span>',
    '<span style="font-style: italic;">م</span>',
    '<span style="text-decoration: underline;">م</span>',
  ]) {
    assert.equal(richTextValue(css), "", `باید خالی بماند: ${css}`);
  }
  assert.equal(richTextValue("<b>پ</b><i>ک</i><u>ز</u>"), "<b>پ</b><i>ک</i><u>ز</u>");
  // رنگ تنها حالتی است که span با style در آن معتبر می‌ماند.
  assert.equal(richTextValue('<span style="color: rgb(170, 71, 37)">ر</span>'), '<span style="color:rgb(170, 71, 37)">ر</span>');
});
