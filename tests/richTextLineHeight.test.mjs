/**
 * tests/richTextLineHeight.test.mjs
 *
 * ارتفاعِ خط ثابت بود (leading-9 / leading-8)، پس با عوض‌شدنِ اندازه‌ی قلم تکان
 * نمی‌خورد. این تست قفل می‌کند که قاعده یکی باشد، روی فرزندان هم بیفتد، و هیچ
 * بلوکِ متنی دوباره ارتفاعِ ثابت نگیرد.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const RULE = /\.rt-flow,\s*\r?\n\.rt-flow \* \{\s*\r?\n\s*line-height: calc\((\d+)px \+ (\d+(?:\.\d+)?)em\);/;

test("قاعده یک جاست، و روی فرزندان هم می‌افتد", async () => {
  const css = await read("../src/app/globals.css");
  const match = css.match(RULE);
  assert.ok(match, "قاعده‌ی .rt-flow با فرمولِ calc پیدا نشد");

  // «.rt-flow *» حذف‌شدنی نیست: line-height با واحد، مقدارِ *محاسبه‌شده* را به
  // ارث می‌دهد نه فرمول را، پس span با اندازه‌ی دیگر همان عددِ والد را می‌گرفت.
  const [, base, factor] = match;
  const at = (size) => Number(base) + Number(factor) * size;

  // متنِ درشت‌تر باید نسبتِ *کمتری* بگیرد — همان چیزی که یک عددِ بی‌واحدِ ثابت نمی‌دهد.
  const ratios = [12, 16, 24, 32, 48].map((size) => at(size) / size);
  for (let i = 1; i < ratios.length; i += 1) assert.ok(ratios[i] < ratios[i - 1], `نسبت در ${i} کم نشد`);

  // و در بازه‌ی خوانا بماند.
  assert.equal(at(16), 24, "۱۶px باید ۲۴px بگیرد (۱٫۵)");
  assert.ok(at(48) / 48 >= 1.15, "متنِ خیلی درشت نباید خطوطش روی هم بیفتد");
  assert.ok(at(8) / 8 <= 2.6, "متنِ ریز نباید بی‌دلیل باز شود");
});

test("بلوک‌های متنی ارتفاعِ ثابت ندارند و همه از همان کلاس می‌آیند", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  // بلوک‌هایی که اندازه‌ی قلمِ درون‌خطی می‌پذیرند: تیتر، پاراگراف، نقل‌قول، HTML سفارشی.
  for (const [name, marker] of [
    ["heading", "${sizes[level]} rt-flow font-black"],
    ["paragraph", "rt-flow text-[16px] text-gray-700"],
    ["quote", "rt-flow text-lg font-bold"],
    ["customHtml", "${blockSection} rt-flow text-gray-700"],
  ]) {
    assert.ok(src.includes(marker), `${name} کلاسِ rt-flow ندارد`);
  }
  // هیچ‌کدامشان نباید دوباره leading-* ثابت بگیرند.
  for (const fixed of ["leading-9", "leading-relaxed"]) {
    assert.ok(!src.includes(fixed), `${fixed} برگشته است`);
  }
});

test("ویرایشگر همان قاعده را دارد، وگرنه چیزی که ادمین می‌بیند با مقاله یکی نیست", async () => {
  const src = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(src, /className=\{`rt-flow w-full px-3 py-2\.5 text-sm outline-none/);
  assert.ok(!src.includes("leading-8"), "ارتفاعِ ثابتِ ویرایشگر برگشته است");
});

// ——— ارتفاعِ خطِ دستی ————————————————————————————————————————
test("مقدارِ دستی ضریب است و در پاک‌سازیِ سرور می‌ماند", async () => {
  const { sanitizeRichText, normalizeLineHeight, RICH_TEXT_LINE_HEIGHT_RANGE } = await import("../src/lib/sanitizeRichText.js");
  // ضریبِ بی‌واحد، نه طول: با اندازه‌ی قلمِ همان متن حساب می‌شود، پس عوض‌کردنِ
  // اندازه مقدارِ دستی را خراب نمی‌کند.
  assert.equal(normalizeLineHeight("۱٫۵"), 1.5, "رقم و اعشارِ فارسی");
  assert.equal(normalizeLineHeight("1,5"), 1.5);
  for (const bad of ["0.5", "4", "abc", "", null]) assert.equal(normalizeLineHeight(bad), null, String(bad));
  assert.equal(normalizeLineHeight(String(RICH_TEXT_LINE_HEIGHT_RANGE.min)), RICH_TEXT_LINE_HEIGHT_RANGE.min);

  // ذخیره‌شدن با متن، نه فقط در ویرایشگر.
  assert.match(sanitizeRichText('<span style="line-height: 1.5">س</span>'), /line-height:\s*1\.5/);
  // اندازه و ارتفاع کنارِ هم می‌مانند — یکی دیگری را پاک نمی‌کند.
  const both = sanitizeRichText('<span style="font-size: 32px; line-height: 1.2">س</span>');
  assert.match(both, /font-size:\s*32px/);
  assert.match(both, /line-height:\s*1\.2/);
  // طول و مقدارِ بیرونِ بازه رد می‌شوند.
  for (const bad of ["24px", "0.5", "4"]) {
    assert.doesNotMatch(sanitizeRichText(`<span style="line-height: ${bad}">س</span>`), /line-height/, bad);
  }
});

test("مقدارِ دستی بر پیش‌فرض می‌چربد، برای فرزندان هم", async () => {
  const css = await read("../src/app/globals.css");
  // بدونِ این قاعده، spanِ تودرتو دوباره calc پیش‌فرض را می‌گرفت و مقدارِ ادمین
  // خنثی می‌شد. inherit ضریبِ والد را می‌دهد، پس اندازه‌ی متفاوت هم همان نسبت دارد.
  assert.match(css, /\.rt-flow \[style\*="line-height"\] \* \{\s*\r?\n\s*line-height: inherit;/);
});

test("اندازه و ارتفاع از یک مسیر می‌روند، پس یکی دیگری را پاک نمی‌کند", async () => {
  const lib = await read("../src/lib/richTextInlineStyle.js");
  // پیاده‌سازی با نامِ ویژگی پارامتری است؛ دو نسخه‌ی جدا یعنی دو رفتارِ جدا.
  assert.match(lib, /export function applyInlineStyle\(root, range, prop, value\)/);
  assert.match(lib, /nested\.style\.removeProperty\(prop\)/, "فقط همان ویژگی برداشته شود");
  assert.match(lib, /ancestor\.style\.removeProperty\(prop\)/);
  assert.match(lib, /INLINE_STYLE_PROPS = \["font-size", "line-height"\]/);

  const field = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(field, /const applyStyle = \(prop, value\) =>/);
  assert.match(field, /applyStyle\("font-size", px \? `\$\{px\}px` : null\)/);
  assert.match(field, /applyStyle\("line-height", value \? String\(value\) : null\)/);
});

