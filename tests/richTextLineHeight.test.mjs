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
  assert.equal(at(16), 28, "۱۶px باید ۲۸px بگیرد (۱٫۷۵)");
  assert.ok(at(48) / 48 >= 1.2, "متنِ خیلی درشت نباید خطوطش روی هم بیفتد");
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
