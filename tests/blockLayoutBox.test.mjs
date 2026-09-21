import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ArticleBlockLayoutSchema } from "../models/articleSchemas.js";
import { BLOCK_ALIGN_SELF, BLOCK_JUSTIFY, BLOCK_MARGIN_KEYS, blockBoxProps, sanitizeArticleBlockLayout } from "../src/lib/articleBlockLayout.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// ——— تله‌ی ۱: strict modeِ mongoose ————————————————————————————————————
// هر کلیدی که در شِما اعلام نشود بی‌صدا دور ریخته می‌شود؛ یعنی افزودنِ یک تنظیمِ
// چیدمان فقط در sanitize کافی نیست و دقیقاً همین‌جا بود که «عرضِ درصدی» ذخیره
// نمی‌شد در حالی که همه‌ی لایه‌های دیگر درست کار می‌کردند.
test("هر کلیدی که sanitize نگه می‌دارد، در شِما هم اعلام شده است", () => {
  const sanitized = sanitizeArticleBlockLayout({
    width: "1/2", widthPct: 40, mt: 1, mb: 1, ml: 1, mr: 1,
    alignX: "center", alignY: "bottom", keepOnMobile: true,
  });
  for (const key of Object.keys(sanitized)) {
    assert.ok(ArticleBlockLayoutSchema.path(key), `کلیدِ ${key} در ArticleBlockLayoutSchema اعلام نشده — mongoose آن را ذخیره نمی‌کند`);
  }
  assert.deepEqual(Object.keys(sanitized).sort(), ["alignX", "alignY", "keepOnMobile", "mb", "ml", "mr", "mt", "width", "widthPct"]);
});

test("بازه‌های شِما با بازه‌های sanitize یکی است", () => {
  assert.equal(ArticleBlockLayoutSchema.path("widthPct").options.min, 5);
  assert.equal(ArticleBlockLayoutSchema.path("widthPct").options.max, 100);
  for (const key of BLOCK_MARGIN_KEYS) {
    assert.equal(ArticleBlockLayoutSchema.path(key).options.min, 0, key);
    assert.equal(ArticleBlockLayoutSchema.path(key).options.max, 8, key);
  }
});

// ——— تله‌ی ۲: دو به‌روزرسانیِ پشتِ‌سرِ‌هم ——————————————————————————————
// latest در یک effect پر می‌شود، پس دو فراخوانیِ متوالی روی یک بلوک، تغییرِ
// اولی را دور می‌ریزد. «ظاهر و چیدمان» هم style را عوض می‌کند هم layout را، پس
// باید *یک* به‌روزرسانی باشد.
test("ویرایشگر، استایل و چیدمان را با یک به‌روزرسانی می‌نویسد", async () => {
  const src = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(src, /const setBlockKeys = \(id, patch\) => onChange\(/);
  assert.match(src, /onAppearance=\{\(next\) => setBlockKeys\(block\.id, \{ style: next\.style, layout: next\.layout \}\)\}/);
  // هیچ مسیری نباید دوباره onLayout جدا داشته باشد.
  assert.doesNotMatch(src, /onLayout\(/);
});

test("مودالِ چیدمان همان پاک‌سازیِ سرور را پیش از تحویل اجرا می‌کند", async () => {
  const src = await read("../src/components/admin/articles/BlockLayoutModal.jsx");
  assert.match(src, /layout: sanitizeArticleBlockLayout\(draft\)/);
});

// ——— رندر: wrapper فقط وقتی لازم است ————————————————————————————————
test("بلوکِ بدونِ چیدمان هیچ wrapper اضافه‌ای نمی‌گیرد", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(src, /if \(!box && !interactive\) return node;/);
  // جای‌گیریِ عمودی روی خانه‌ی سطر می‌نشیند، چون تنها جایی است که بلوک سطری برای
  // هم‌ترازی دارد.
  assert.match(src, /const alignSelf = BLOCK_ALIGN_SELF\[item\.block\?\.layout\?\.alignY\]/);
});

test("در RTL، «راست» شروعِ خط است", () => {
  assert.deepEqual(BLOCK_JUSTIFY, { right: "flex-start", center: "center", left: "flex-end" });
  assert.deepEqual(BLOCK_ALIGN_SELF, { top: "start", center: "center", bottom: "end" });
});

// ——— پیش‌نمایشِ قابلِ ویرایش ——————————————————————————————————————————
test("پیش‌نمایش همان رندرکننده‌ی عمومی را به کار می‌گیرد، نه یک رندرِ موازی", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.match(src, /import ArticleBlockRenderer from "@\/components\/features\/articles\/ArticleBlockRenderer"/);
  assert.match(src, /<ArticleBlockRenderer blocks=\{blocks\} entities=\{entities\} preview interactive=\{canEdit\} \/>/);
  // فیلدهای ویرایش هم همان فیلدهای ویرایشگرِ کارتی‌اند.
  assert.match(src, /import \{ BlockFields[^}]*\} from "\.\/BlockEditor"/);
});

test("کلیک روی فرزندِ بلوکِ ادغام‌شده به خودِ آن بلوک می‌رسد", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  // closest تنها چیزی است که این را تضمین می‌کند: فقط بلوکِ سطحِ‌اول data-block-id دارد.
  assert.match(src, /event\.target\.closest\?\.\("\[data-block-id\]"\)/);
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  const boxed = renderer.slice(renderer.indexOf("const boxed ="), renderer.indexOf("const rendered = []"));
  assert.match(boxed, /"data-block-id": block\.id/);
});

test("کشیدن آستانه دارد تا دابل‌کلیک به drag تبدیل نشود", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.match(src, /Math\.hypot\(event\.clientX - state\.startX, event\.clientY - state\.startY\) < DRAG_THRESHOLD/);
  assert.match(src, /if \(!state\.active \|\| !state\.target\) return;/);
});

test("جابه‌جایی فقط ترتیب را عوض می‌کند و شناسه‌ها را نگه می‌دارد", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  const fn = src.slice(src.indexOf("function moveBlock"), src.indexOf("function EditModal"));
  assert.match(fn, /const \[moved\] = next\.splice\(from, 1\)/);
  // اندیسِ مقصد بعد از برداشتن دوباره پیدا می‌شود، وگرنه حرکتِ رو به پایین یکی کم می‌آورد.
  assert.match(fn, /const at = next\.findIndex\(\(block\) => block\.id === toId\)/);
});

// ——— فرزندِ بلوکِ ادغام‌شده ———————————————————————————————————————————
// چیدمانِ فرزند روی *خانه‌ی خودش* می‌نشیند، نه در یک wrapper تازه: خانه همان سهمِ
// فرزند در شبکه است، و چون ریستِ حاشیه‌ی خانه (*:my-0) به فرزندانِ خانه می‌خورد
// نه به خودش، هیچ جنگِ specificity با فاصله‌ی تنظیم‌شده پیش نمی‌آید.
test("هر دو مسیرِ بلوکِ ادغام‌شده، چیدمانِ فرزند را روی خانه اعمال می‌کنند", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  const grid = src.slice(src.indexOf("function MergedGrid"), src.indexOf("function MergedBlock"));
  const legacy = src.slice(src.indexOf("function MergedBlock"), src.indexOf("function EntityCards"));
  for (const [name, body] of [["MergedGrid", grid], ["MergedBlock", legacy]]) {
    assert.match(body, /const box = blockBoxProps\(child\)/, name);
    assert.match(body, /BLOCK_ALIGN_SELF\[child\?\.layout\?\.alignY\]/, name);
    // ریستِ حاشیه‌ی خانه باید بماند — رفتارِ فعلیِ بلوک‌های بدونِ چیدمان به آن وابسته است.
    assert.match(body, /\*:my-0/, name);
  }
});

test("فرزندِ بدونِ چیدمان، خانه‌اش دقیقاً مثلِ قبل می‌ماند", () => {
  // blockBoxProps هیچ چیزی برنمی‌گرداند، پس نه کلاسی اضافه می‌شود نه استایلی.
  assert.equal(blockBoxProps({ id: "x", type: "paragraph" }), null);
  assert.equal(blockBoxProps({ layout: { width: "1/2" } }), null, "عرضِ ستونی جعبه نیست — سهم از سطر است");
});

test("blockBoxProps کلاسِ «در موبایل هم حفظ شود» را حمل می‌کند", () => {
  assert.deepEqual(blockBoxProps({ layout: { widthPct: 40 } }), { className: "a-block-box", style: { "--bw": "40%" } });
  assert.deepEqual(blockBoxProps({ layout: { widthPct: 40, keepOnMobile: true } }), { className: "a-block-box a-block-box--keep", style: { "--bw": "40%" } });
  assert.deepEqual(blockBoxProps({ layout: { alignX: "center" } }), { className: "a-block-box", style: { "--bj": "center" } });
});

// ——— کنترل‌های پیش‌نمایش ————————————————————————————————————————————
test("پیش‌نمایش همان مودال‌ها و همان افزودنِ بلوکِ ویرایشگر را باز می‌کند", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  // نه نسخه‌ی دوم: هر سه از BlockEditor/BlockLayoutModal می‌آیند.
  assert.match(src, /import \{ BlockFields, BlockLibrary, MergedLayoutModal \} from "\.\/BlockEditor"/);
  assert.match(src, /const block = createArticleBlock\(type\);/);
  assert.match(src, /insertBlockAt\(blocks, block, position\)/);
});

test("چیدمانِ شبکه فقط روی خودِ بلوکِ ادغام‌شده می‌نشیند", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  // data.grid عوض می‌شود و data.blocks (تنظیماتِ فرزندها) دست‌نخورده می‌ماند.
  assert.match(src, /onChange\(\{ \.\.\.block, data: \{ \.\.\.block\.data, grid \} \}\)/);
});

test("نوارِ ثابتِ پایین در پیش‌نمایش هست و روی محتوا نمی‌افتد", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.match(src, /fixed bottom-4 left-4 z-40/);
  // فضای امن زیرِ آخرین بلوک، تا نوار چیزی را نپوشاند.
  assert.match(src, /canEdit \? " pb-24" : ""/);
});

test("refreshِ پس از ذخیره، ویرایش‌های بعدی را پاک نمی‌کند", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.match(src, /justSaved\.current = JSON\.stringify\(blocks\)/);
  assert.match(src, /if \(justSaved\.current && JSON\.stringify\(saved\) === justSaved\.current\)/);
});

// ——— شبکه‌ی داخلیِ بلوک، داخلِ خانه‌ی بلوکِ ادغام‌شده ————————————————————
// ریشه‌ی باگِ «کارتِ محصولِ باریک»: شبکه‌ی داخلیِ بلوک ستون‌هایش را از
// نقطه‌شکن‌های *صفحه* می‌گرفت (md:/lg:)، و داخلِ ستونی ۳۰۰ پیکسلی هم پنجره هنوز
// «دسکتاپ» بود — پس کارت یک‌چهارمِ خانه می‌شد.
test("فرزندانِ بلوکِ ادغام‌شده با پرچمِ inMerged رندر می‌شوند", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(src, /const renderBlock = \(block, inMerged = false\) =>/);
  assert.match(src, /mergedChildren\(block\)\.map\(\(child\) => \(\{ child, node: renderBlock\(child, true\) \}\)\)/);
});

test("هر بلوکی که شبکه‌ی داخلی دارد، inMerged را می‌گیرد", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  for (const call of [
    /<PublicProductGrid products=\{products\} rate=\{rate\} fill=\{inMerged\} \/>/,
    /<PublicUsedProductGrid fill=\{inMerged\}/,
    /<EntityCards [^>]*inMerged=\{inMerged\}/,
    /<ImageBlock [^>]*inMerged=\{inMerged\}/,
  ]) assert.match(src, call, String(call));
  // گالری و مقالاتِ مرتبط هم همان قاعده را دارند.
  assert.match(src, /inMerged \? slotGrid\(images\.length, SLOT_TILES\) : "grid-cols-2"/);
  assert.match(src, /inMerged \? slotGrid\(articles\.length\) : "md:grid-cols-2"/);
});

test("ستون‌های داخلِ خانه از عرضِ خانه می‌آیند، نه از نقطه‌شکنِ صفحه", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  const slots = src.slice(src.indexOf("const SLOT_ONE"), src.indexOf("const IMAGE_GRID_COLS"));
  // auto-fill یعنی «هرچه در این عرض جا می‌شود»؛ min(...,100%) یعنی در خانه‌ی
  // باریک‌تر از کمینه هم چیزی بیرون نمی‌زند.
  assert.match(slots, /auto-fill/);
  assert.match(slots, /min\(12rem,100%\)/);
  assert.match(slots, /min\(8rem,100%\)/);
  // هیچ نقطه‌شکنِ صفحه‌ای در مسیرِ داخلِ خانه نباید باشد.
  assert.doesNotMatch(slots, /\b(sm|md|lg|xl):/);
});

test("بیرونِ بلوکِ ادغام‌شده، کلاس‌های صفحه دست‌نخورده‌اند", async () => {
  const src = await read("../src/components/features/articles/PublicProductGrid.jsx");
  // همان سه کلاسِ قبلی، تا اندازه‌ی کارت در صفحه ذره‌ای عوض نشود.
  assert.match(src, /const GRID_PAGE = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"/);
  assert.match(src, /const GRID_FILL_ONE = "grid-cols-1"/);
  assert.match(src, /slotColumns = \(fill, count\) => \(!fill \? GRID_PAGE : count === 1 \? GRID_FILL_ONE : GRID_FILL_MANY\)/);
});
