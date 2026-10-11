/**
 * tests/richTextBlocks.test.mjs
 *
 * متنِ غنی در نکته‌ی برجسته، پاسخِ سوالاتِ متداول و توضیحِ خبرنامه — و چیدمانِ
 * فرم‌های ویرایشِ بلوک و دو دکمه‌ی «افزودن» تودرتو.
 *
 * قاعده‌ی سازگاری همان قاعده‌ی پاراگراف است: نسخه‌ی قالب‌دار *کنارِ* متنِ ساده
 * ذخیره می‌شود و فقط وقتی قالب‌بندیِ واقعی هست. متنِ ساده (answer، description،
 * text) هرگز عوض نمی‌شود، پس داده‌ی ساختاریافته‌ی FAQ و شمارشِ کلمات همان می‌مانند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);
import { sanitizeArticleBlockData } from "../src/lib/articleBlockValidation.js";
import { countArticleWords } from "../src/lib/articleContent.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const clean = (type, data) => sanitizeArticleBlockData(type, data, {}, "blocks.0.data");

test("نکته‌ی برجسته html را کنارِ متن نگه می‌دارد", () => {
  const out = clean("callout", { title: "ت", text: "سلام دنیا", html: 'سلام <b>دنیا</b><script>x</script>', tone: "info" });
  assert.equal(out.text, "سلام دنیا");
  assert.equal(out.html, "سلام <b>دنیا</b>");
  // بدونِ قالب‌بندی، کلیدی اضافه نمی‌شود — داده همان شکلِ قبلی است.
  assert.deepEqual(clean("callout", { title: "ت", text: "متن", html: "متن", tone: "info" }), { title: "ت", text: "متن", tone: "info" });
});

test("پاسخِ پرسش answerHtml می‌گیرد؛ answer متنِ ساده می‌ماند", () => {
  const out = clean("faq", { items: [
    { question: "چرا؟", answer: "چون پیوند", answerHtml: 'چون <a href="https://x.test" style="color:#aa4725">پیوند</a>' },
    { question: "ساده", answer: "فقط متن", answerHtml: "فقط متن" },
    { question: "بد", answer: "x", answerHtml: '<a href="javascript:alert(1)">x</a>' },
  ] });
  assert.deepEqual(out.items[0], { question: "چرا؟", answer: "چون پیوند", answerHtml: 'چون <a href="https://x.test" style="color:#aa4725">پیوند</a>' });
  assert.deepEqual(out.items[1], { question: "ساده", answer: "فقط متن" });
  assert.equal(JSON.stringify(out.items[2]).includes("javascript"), false);
  // پرسشِ قدیمی (بدونِ answerHtml) دقیقاً همان می‌ماند.
  assert.deepEqual(clean("faq", { items: [{ question: "پ", answer: "ج" }] }), { items: [{ question: "پ", answer: "ج" }] });
});

test("توضیحِ خبرنامه descriptionHtml می‌گیرد", () => {
  const out = clean("newsletterCta", { title: "ع", description: "متن مهم", descriptionHtml: "متن <u>مهم</u>", buttonLabel: "عضویت" });
  assert.equal(out.descriptionHtml, "متن <u>مهم</u>");
  assert.equal(out.description, "متن مهم");
  assert.equal("descriptionHtml" in clean("newsletterCta", { description: "ساده" }), false);
});

test("نسخه‌ی قالب‌دار در شمارشِ کلمات دوباره شمرده نمی‌شود", () => {
  const blocks = [
    { type: "faq", data: { items: [{ question: "یک", answer: "دو سه", answerHtml: "دو <b>سه</b>" }] } },
    { type: "newsletterCta", data: { title: "چهار", description: "پنج", descriptionHtml: "<b>پنج</b>" } },
    { type: "callout", data: { title: "شش", text: "هفت", html: "<i>هفت</i>" } },
  ];
  const plain = JSON.parse(JSON.stringify(blocks, (key, value) => (/^(html|answerHtml|descriptionHtml)$/.test(key) ? undefined : value)));
  assert.equal(countArticleWords(blocks), countArticleWords(plain));
});

test("رندر: بدونِ html همان <p>ِ قبلی، با html متنِ پاک‌سازی‌شده", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  const helper = src.slice(src.indexOf("function RichParagraph"), src.indexOf("/** پس‌زمینه بدونِ"));
  // مسیرِ متنِ ساده rt-inline نمی‌گیرد، پس محتوای موجود بایت‌به‌بایت همان است.
  assert.match(helper, /return <p className=\{preLine \? `whitespace-pre-line \$\{className\}` : className\} style=\{style\}>\{content\.children\}<\/p>;/);
  assert.match(helper, /const content = richContent\(\{ html, text \}\);/);
  assert.match(src, /html=\{data\.html\} text=\{data\.text\} preLine/);
  assert.match(src, /html=\{item\.answerHtml\} text=\{item\.answer\}/);
  assert.match(src, /html=\{data\.descriptionHtml\}/);
  // پرسش متنِ ساده می‌ماند (داخلِ <summary>).
  assert.match(src, /\{item\.question\}<\/summary>/);

  const css = await read("../src/app/globals.css");
  assert.match(css, /\.rt-inline \* \{\s*line-height: calc\(8px \+ 1em\);/);
  assert.match(css, /\.rt-inline \[style\*="line-height"\] \* \{\s*line-height: inherit;/);
});

test("ویرایشگر: همان RichTextField، با کلیدهای کنارِ متن", async () => {
  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  const rich = (type, key) => ARTICLE_BLOCKS[type].fields.find((field) => field.key === key);
  assert.equal(rich("callout", "text").kind, "rich");
  assert.equal(rich("newsletterCta", "description").kind, "rich");
  assert.equal(rich("newsletterCta", "description").htmlKey, "descriptionHtml");
  // عنوان‌ها و برچسب‌ها متنِ ساده می‌مانند.
  for (const [type, key] of [["callout", "title"], ["newsletterCta", "title"], ["newsletterCta", "buttonLabel"], ["quote", "author"], ["tenadorTitle", "title"]]) {
    assert.notEqual(rich(type, key).kind, "rich", `${type}.${key}`);
  }

  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /<RichTextField label=\{`پاسخ \$\{index \+ 1\}`\} value=\{\{ text: item\.answer, html: item\.answerHtml \}\}/);
  assert.match(editor, /if \(field\.kind === "rich"\) return onUpdate\(\{ \[field\.key\]: next\.text, \[field\.htmlKey \|\| "html"\]: next\.html \}\);/);
  // هیچ textarea یا ویرایشگرِ متنِ غنیِ دومی ساخته نشده است.
  assert.equal(editor.includes("suppressContentEditableWarning"), false);
});

test("دکمه‌های افزودن: فقط دو ویرایشگرِ تودرتو برچسبِ تازه دارند", async () => {
  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  const nested = (type) => ARTICLE_BLOCKS[type].fields.find((field) => field.kind === "mergedBlocks");
  assert.equal(nested("image").addLabel, "بلوک روی تصویر");
  assert.equal(nested("image").addGroup, "media");
  assert.equal(ARTICLE_BLOCKS.image.group, "رسانه");
  assert.equal(nested("merged").addLabel, "افزودن بلوک به ترکیب");
  // ترکیب فقط متن را عوض می‌کند، نه رنگ را.
  assert.equal(nested("merged").addGroup, undefined);

  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  // پیش‌فرض همان برچسبِ قبلی است — ویرایشگرِ کلِ مقاله چیزی پاس نمی‌دهد.
  assert.match(editor, /addLabel = "افزودن بلوک", addGroup = null[,}]/);
  assert.match(editor, /addLabel=\{field\.addLabel\} addGroup=\{field\.addGroup\}/);
  // هر دو شکلِ دکمه همان کار را می‌کنند.
  assert.equal((editor.match(/<button type="button" onClick=\{\(\) => setLibraryOpen\(true\)\}/g) || []).length, 2);
  // اسلایدرِ تصویر: همان allow، و از بازطراحی برچسبِ خودش («اسلاید n»، «افزودن اسلاید»).
  assert.match(editor, /<BlockEditor value=\{Array\.isArray\(value\) \? value : \[\]\} onChange=\{onChange\} allow=\{IMAGE_SLIDER_CHILD_TYPES\} itemLabel="اسلاید" addLabel="افزودن اسلاید" \/>/);

  const css = await read("../src/styles/admin-theme.css");
  assert.match(css, /\.admin-scope \[data-block-group="media"\]\s+\{ --admin-block-accent: #8f7bbe;/);
});

test("چیدمانِ فرم فقط ظاهر است: همان فیلدها، همان کلیدها", async () => {
  const { ARTICLE_BLOCKS } = await import("../src/components/admin/articles/blockRegistry.js");
  // هر ردیف از فیلدهای *پشتِ‌سرِ‌هم* ساخته می‌شود؛ row ای که دو تکه شود یعنی ترتیب
  // اشتباه است و فیلدها جدا از هم می‌افتند.
  for (const [type, definition] of Object.entries(ARTICLE_BLOCKS)) {
    const seen = new Set();
    let previous;
    for (const field of definition.fields) {
      if (field.row && field.row !== previous) {
        assert.ok(!seen.has(field.row), `${type}: ردیفِ «${field.row}» پیوسته نیست`);
        seen.add(field.row);
      }
      previous = field.row;
    }
    // کلیدها یکتا می‌مانند (کلیدِ React و کلیدِ داده).
    const keys = definition.fields.map((field) => field.key);
    assert.equal(new Set(keys).size, keys.length, type);
  }
  assert.deepEqual(ARTICLE_BLOCKS.button.fields.map((field) => field.key).sort(), ["align", "fontSize", "fullWidth", "href", "icon", "label", "size", "style", "textAlign"]);
  assert.deepEqual(ARTICLE_BLOCKS.image.fields.map((field) => field.key).sort(), ["blocks", "caption", "displayHeight", "images", "shade"]);
});

test("پاسخِ پرسش چینشِ خودش را دارد؛ مقدارِ ناشناخته و تنظیم‌نشده ذخیره نمی‌شود", async () => {
  const items = clean("faq", { items: [
    { question: "a", answer: "x", answerAlign: "justify" },
    { question: "b", answer: "y", answerAlign: "center" },
    { question: "c", answer: "z", answerAlign: "start" },
    { question: "d", answer: "w" },
  ] }).items;
  assert.deepEqual(items.map((item) => item.answerAlign), ["justify", "center", undefined, undefined]);
  assert.equal("answerAlign" in items[3], false, "پاسخِ قدیمی همان شکل را نگه می‌دارد");

  // ویرایشگر همان دکمه‌های چینشِ RichTextField را می‌دهد، با «تراز» فقط برای پاسخ.
  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /align=\{item\.answerAlign\} onAlign=\{\(answerAlign\) => update\(index, \{ answerAlign \}\)\} aligns=\{FAQ_ANSWER_ALIGNS\}/);
  const field = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(field, /const DEFAULT_ALIGNS = \["right", "center", "left"\];/);
  // و رندرِ عمومی همان مقدار را روی پاراگرافِ پاسخ می‌گذارد.
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /item\.answerAlign && \{ textAlign: item\.answerAlign \}/);
});

test("فقط فیلدِ تک‌کنترلی داخلِ <label> است (کلیکِ پاسخ به کادرِ پرسش نمی‌رود)", async () => {
  // <label> بدونِ for هر کلیکی را که روی خودِ یک کنترل نیست به *اولین* کنترلِ داخلش
  // می‌فرستد؛ ناحیه‌ی contentEditableِ پاسخ کنترل نیست، پس کلیکش به کادرِ پرسش می‌رفت.
  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  const list = JSON.parse(editor.match(/const SINGLE_CONTROL_KINDS = (\[[^\]]*\]);/)[1]);
  for (const kind of ["faq", "rich", "table", "entity", "entities", "image", "gallery", "imageList", "imageShade", "mergedBlocks", "imageSliderBlocks", "imageSliderSettings", "checkbox"]) {
    assert.equal(list.includes(kind), false, kind);
  }
  assert.match(editor, /const fieldWrapper = \(kind\) => \(SINGLE_CONTROL_KINDS\.includes\(kind\) \? "label" : "div"\);/);
});
