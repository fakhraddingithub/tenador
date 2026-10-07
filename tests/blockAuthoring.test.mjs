/**
 * tests/blockAuthoring.test.mjs
 *
 * چهار قاعده‌ی تازه‌ی نویسندگیِ بلوک: کپی بینِ سندها، مقیاسِ بلوک‌های روی تصویر،
 * فاصله‌ی پیش‌فرضِ متن و تیترِ تنادور، و دکمه‌های پیش‌نمایش در فرمِ برند.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";

register("./aliasHooks.mjs", import.meta.url);

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("فاصله‌ی پیش‌فرض فقط برای همان بلوک‌هاست، و تنظیمِ ادمین بر آن می‌چربد", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  const table = src.slice(src.indexOf("const BLOCK_DEFAULT_SPACING"), src.indexOf("/** روی رنگِ داده‌شده"));
  assert.match(table, /heading: \{ marginTop: "1rem", marginBottom: "1rem" \}/);
  assert.match(table, /paragraph: \{ marginTop: "1rem", marginBottom: "1rem" \}/);
  assert.match(table, /tenadorTitle: \{ marginBottom: "5rem" \}/);
  // تیترِ تنادور فقط *پایین* می‌گیرد؛ بالا دست‌نخورده می‌ماند.
  assert.ok(!/tenadorTitle: \{[^}]*marginTop/.test(table));
  // و هیچ نوعِ دیگری پیش‌فرض نمی‌گیرد.
  assert.deepEqual([...table.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]), ["heading", "paragraph", "tenadorTitle"]);

  // style.spacing ادمین اولویت دارد، و layout.mt/mb هر طرف را جدا کنار می‌زند.
  assert.match(src, /const preset = gap === undefined \? fallback \|\| null : \{ marginTop: gap, marginBottom: gap \};/);
  assert.match(src, /layout\.mt === undefined && preset\.marginTop !== undefined/);
  assert.match(src, /layout\.mb === undefined && preset\.marginBottom !== undefined/);
  // کلاسِ my-5 پاراگراف برداشته شد، وگرنه دو فاصله‌ی رقیب می‌ماند.
  assert.ok(!src.includes("my-5 "));
});

test("بلوک‌های روی تصویر با عرضِ *تصویر* کوچک می‌شوند، نه با نقطه‌شکنِ صفحه", async () => {
  const css = await read("../src/app/globals.css");
  const scope = css.slice(css.indexOf(".a-image-overlay {"), css.indexOf("/* ─── اسلایدرِ تصویر ───"));
  // قاب خودش container است و اندازه‌ی پایه از عرضِ همان قاب می‌آید.
  assert.match(scope, /container-type: inline-size;/);
  assert.match(scope, /font-size: clamp\(.*cqw.*\);/);
  // بقیه در em، پس همه‌چیز با هم مقیاس می‌گیرد — از جمله خودِ دکمه.
  for (const rule of [/\.a-image-overlay h1,/, /\.a-image-overlay h3 \{/, /\.a-image-overlay \.a-btn \{/]) {
    assert.match(scope, rule);
  }
  assert.match(scope, /\.a-image-overlay \.a-btn \{[\s\S]*?padding: 0\.6em 1\.5em;/);
  assert.match(scope, /\.a-image-overlay \.a-btn \{[\s\S]*?border-radius: 0\.4em;/);
  // هیچ‌جای این دامنه px ثابت نیست، جز کفِ ضخامتِ مرز.
  assert.ok(!/\d+px/.test(scope.replace("max(1px, 0.12em)", "")), "اندازه‌ی ثابت در دامنه‌ی تصویر");

  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(src, /className=\{`a-image-overlay pointer-events-none absolute inset-0 grid grid-cols-1 /);
  // قلابِ دکمه پایدار است، وگرنه قاعده به هر پیوندی می‌خورد.
  assert.match(src, /className=\{`a-btn \$\{data\.fullWidth/);
});

test("کپیِ بلوک بینِ سندها: شناسه‌ی تازه، نوعِ معتبر، بی‌استثنا", async () => {
  const lib = await read("../src/lib/articleBlockClipboard.js");
  // چسباندن همیشه شناسه‌ی تازه می‌دهد، وگرنه سرور ذخیره را رد می‌کند.
  assert.match(lib, /export function takeBlockFromClipboard\(\) \{[\s\S]*?cloneWithFreshIds\(entry\.block\)/);
  // نوعی که دیگر وجود ندارد چسبانده نمی‌شود.
  assert.match(lib, /ARTICLE_BLOCK_TYPE_SET\.has\(type\)/);
  // ذخیره‌سازیِ بسته (پنجره‌ی خصوصی) نباید استثنا بدهد.
  assert.match(lib, /const storage = \(\) => \{\s*\r?\n\s*try \{/);

  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /aria-label="کپی بلوک برای سند دیگر"/);
  // دکمه‌ی چسباندن فقط وقتی هست که چیزی باشد و اینجا پذیرفته شود.
  assert.match(editor, /\{clipboard && \(!allow \|\| allow\.includes\(clipboard\.block\.type\)\) \?/);
  assert.match(editor, /if \(allow && !allow\.includes\(block\.type\)\)/);
  // هدر پس از چسباندن هم در صدر می‌ماند.
  assert.match(editor, /onChange\(normalizeHeaderPosition\(\[\.\.\.latest\.current, block\]\)\)/);
  // تبِ دیگر هم باید ببیند.
  assert.match(editor, /window\.addEventListener\("storage", sync\)/);
});

test("فرمِ برند برای بروشور و هر دسته دکمه‌ی پیش‌نمایش دارد", async () => {
  const brochure = await read("../src/components/admin/brands/BrandBrochureCard.jsx");
  assert.match(brochure, /href=\{`\/p-admin\/admin-brands\/\$\{brandId\}\/brochure\/preview`\}/);
  assert.match(brochure, /target="_blank"/);
  // بدونِ بروشور چیزی برای دیدن نیست.
  assert.match(brochure, /\{status \? \(\s*\r?\n\s*<a/);

  const categories = await read("../src/components/admin/brands/BrandCategoryArticlesCard.jsx");
  assert.match(categories, /href=\{`\/p-admin\/admin-brands\/\$\{brandId\}\/category-article\/\$\{item\.id\}\/preview`\}/);
  assert.match(categories, /target="_blank"/);
});
