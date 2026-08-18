/**
 * tests/articleWordCount.test.mjs
 *
 * countArticleWords همه‌ی رشته‌های داخلِ بلوک را می‌شمارد. از وقتی بلوک‌های متنی
 * کنارِ data.text یک data.html هم دارند (نسخه‌ی قالب‌بندی‌شده‌ی *همان* متن)، این
 * پیمایش کلمات را دو بار می‌شمرد و زمانِ مطالعه را دو برابر می‌کرد.
 *
 * بلوکِ «HTML سفارشی» فقط html دارد و متنِ سادهٔ هم‌ارز ندارد، پس باید هنوز شمرده
 * شود — همین مرز اینجا قفل می‌شود.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadingTime, countArticleWords } from "../src/lib/articleContent.js";

const words = (data) => countArticleWords([{ data }]);

test("نسخه‌ی قالب‌بندی‌شده دوباره شمرده نمی‌شود", () => {
  const plain = words({ text: "یک دو سه چهار" });
  const rich = words({ text: "یک دو سه چهار", html: "یک <b>دو</b> سه چهار" });
  assert.equal(rich, plain);
});

test("قالب‌بندیِ سنگین هم شمارش را تغییر نمی‌دهد", () => {
  const plain = words({ text: "یک دو سه چهار" });
  const rich = words({
    text: "یک دو سه چهار",
    html: 'یک <b><span style="color:#aa4725">دو</span></b> <i>سه</i> <a href="https://x.test">چهار</a>',
  });
  assert.equal(rich, plain);
});

test("بلوکِ HTML سفارشی که متنِ ساده ندارد هنوز شمرده می‌شود", () => {
  assert.equal(words({ html: "<p>یک دو سه</p>" }) > 0, true);
});

test("htmlِ غیررشته‌ای کنارِ متن چیزی را خراب نمی‌کند", () => {
  assert.equal(words({ text: "یک دو", html: null }), words({ text: "یک دو" }));
});

test("زمانِ مطالعه‌ی بلوکِ قالب‌بندی‌شده با نسخه‌ی سادهٔ همان متن یکی است", () => {
  const text = Array.from({ length: 420 }, (_, index) => `کلمه${index}`).join(" ");
  const plain = calculateReadingTime([{ data: { text } }]);
  const rich = calculateReadingTime([{ data: { text, html: `<b>${text}</b>` } }]);
  assert.equal(plain, 3);
  assert.equal(rich, plain);
});
