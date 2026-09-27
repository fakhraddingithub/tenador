import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { ArticleBlockLayoutSchema } from "../models/articleSchemas.js";
import { BLOCK_ALIGN_SELF, BLOCK_JUSTIFY, BLOCK_MARGIN_KEYS, blockBoxProps, sanitizeArticleBlockLayout } from "../src/lib/articleBlockLayout.js";

// articleValidation با نام‌های مستعار (base/ و @/) به بقیه ارجاع می‌دهد.
register("./aliasHooks.mjs", import.meta.url);

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

// ——— رنگِ متن: چرا «با پررنگ هم‌زمان کار نمی‌کرد» ————————————————————————
// <input type="color"> فقط وقتی رویداد می‌دهد که مقدارش *عوض شود*. برداشتنِ
// همان رنگِ قبلی برای یک انتخابِ تازه (یا بستنِ پنجره‌ی رنگ بدونِ تغییر) هیچ
// رویدادی ندارد، پس فرمان اصلاً اجرا نمی‌شد — نه اینکه رنگ پاک شود.
test("رنگ یک راهِ اعمالِ مستقل از تغییرِ مقدار دارد", async () => {
  const src = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(src, /title="اعمال رنگ روی متن انتخاب‌شده"/);
  assert.match(src, /onClick=\{\(\) => exec\("foreColor", colour\)\}/);
  // رنگِ انتخاب‌شده در state است، وگرنه دکمه نمی‌داند چه رنگی را دوباره بگذارد.
  assert.match(src, /const \[colour, setColour\] = useState\("#aa4725"\)/);
});

test("هر فرمان روی انتخابِ ذخیره‌شده اجرا می‌شود، نه هر جا که فوکوس است", async () => {
  const src = await read("../src/components/admin/articles/RichTextField.jsx");
  assert.match(src, /if \(!insideEditor\(\) && !restoreRange\(\)\) ref\.current\?\.focus\(\);/);
  // restoreRange باید پیش از exec تعریف شده باشد (وگرنه در زمانِ فراخوانی undefined است).
  assert.ok(src.indexOf("const restoreRange") < src.indexOf("const exec ="), "restoreRange باید بالاتر از exec باشد");
});

// ——— پیوند در پیش‌نمایش ——————————————————————————————————————————————
test("در پیش‌نمایش، کلیک پیمایش نمی‌کند و دابل‌کلیک زبانه‌ی تازه باز می‌کند", async () => {
  const src = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  // فازِ capture حیاتی است: <Link> نکست روی خودِ عنصر onClick دارد و در فازِ
  // bubble زودتر اجرا شده و مسیریابی را شروع کرده است.
  assert.match(src, /onClickCapture=\{onClickCapture\}/);
  assert.match(src, /const onClickCapture = \(event\) => \{\s*if \(linkAt\(event\)\) event\.preventDefault\(\);/);
  assert.match(src, /window\.open\(href, "_blank", "noopener,noreferrer"\)/);
});

test("رندرِ عمومی هیچ‌کدام از این‌ها را ندارد", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  // دستگیره و دکمه‌ی ویرایش فقط در حالتِ interactive ساخته می‌شوند.
  assert.match(src, /const handle = interactive\s/);
  assert.match(src, /data-edit-block=""/);
});

// ——— دسته‌بندی‌های جعبه‌ی مینی‌مقاله ——————————————————————————————————
// نسخه‌ی اول این کارت /api/category را صدا می‌زد — مسیری که وجود ندارد — پس
// کشویی همیشه خالی بود و نامِ کارت‌های موجود هم به «دسته‌بندی» برمی‌گشت.
test("کارتِ مینی‌مقاله‌ی دسته از همان منبعِ مشترکِ دسته‌ها می‌خواند", async () => {
  const src = await read("../src/components/admin/brands/BrandCategoryArticlesCard.jsx");
  assert.match(src, /import \{ useCategories \} from "@\/hooks\/useAdminRefData"/);
  assert.match(src, /const \{ categories, isLoading, error \} = useCategories\(\)/);
  // هیچ واکشیِ دستی‌ای نباید برگردد.
  assert.doesNotMatch(src, /fetch\("\/api\/category"/);
  assert.doesNotMatch(src, /fetch\("\/api\/categories/);
});

test("گزینه‌ها نامِ ورزش را هم دارند (دسته زیرِ ورزش تعریف می‌شود)", async () => {
  const src = await read("../src/components/admin/brands/BrandCategoryArticlesCard.jsx");
  assert.match(src, /const sport = category\?\.sport\?\.title \|\| category\?\.sport\?\.name;/);
});

// ——— کشیدن با ماوس روی اسلایدرهای افقی ————————————————————————————————
test("جزیره‌ی کشیدن به ظرفِ اسکرولِ موجود وصل می‌شود، نه به مارک‌آپِ تازه", async () => {
  const src = await read("../src/components/features/articles/DragScroll.jsx");
  // رندرکننده سروری است؛ جزیره خودش را به parentElement می‌بندد تا آن فایل
  // کلاینتی نشود (sanitize-html نباید وارد باندلِ مرورگر شود).
  assert.match(src, /anchor\.current\?\.parentElement/);
  assert.match(src, /<span ref=\{anchor\} hidden aria-hidden="true" \/>/);
});

test("کشیدن فقط با ماوس، با آستانه، و بدونِ دست‌زدن به نوارِ اسکرول", async () => {
  const src = await read("../src/components/features/articles/DragScroll.jsx");
  assert.match(src, /event\.pointerType !== "mouse"/);
  assert.match(src, /Math\.abs\(dx\) < DRAG_THRESHOLD/);
  // نوارِ اسکرول زیرِ ناحیه‌ی محتواست و باید دستِ مرورگر بماند.
  assert.match(src, /event\.clientY > element\.getBoundingClientRect\(\)\.top \+ element\.clientHeight/);
  // فیلدها و دستگیره‌های ویرایشگر استثنا هستند.
  assert.match(src, /input, textarea, select, \[contenteditable\], \[data-drag-handle\], \[data-edit-block\]/);
});

test("کلیکِ پس از کشیدن بلعیده می‌شود، ولی کلیکِ ساده نه", async () => {
  const src = await read("../src/components/features/articles/DragScroll.jsx");
  assert.match(src, /swallowClick = state\.dragging;/);
  // capture لازم است: <Link> نکست روی خودِ لنگر می‌نشیند و bubble دیر است.
  assert.match(src, /element\.addEventListener\("click", onClickCapture, true\)/);
  assert.match(src, /swallowClick = false;\s*\n\s*if \(event\.pointerType/);
});

test("هر ظرفِ اسکرولِ افقی جزیره را دارد", async () => {
  const src = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  // شبکه‌ی ادغام فقط وقتی اسکرول دارد، ردیفِ قدیمی همیشه، و جدولِ پهن.
  assert.match(src, /\{scrolls \? <DragScroll \/> : null\}/);
  const legacy = src.slice(src.indexOf("function MergedBlock"), src.indexOf("function EntityCards"));
  assert.match(legacy, /<DragScroll \/>/);
  assert.match(src, /style=\{v\.spacing \|\| undefined\}><DragScroll \/><table/);
});

// ——— دکمه‌ی بازگشت روی صفحه‌ی پیش‌نمایش ————————————————————————————————
// پیش‌نمایش همیشه با window.open باز می‌شود، پس آن تب تاریخچه ندارد و
// fallbackِ قبلی (داشبورد) اجرا می‌شد. مقصدِ درست، ویرایشگرِ *همین* محتواست —
// همان مسیر بدونِ «/preview»، برای هر چهار نوع یکسان.
test("بازگشت از پیش‌نمایش به ویرایشگرِ همان محتوا می‌رود", async () => {
  const src = await read("../src/components/admin/Layout.jsx");
  assert.match(src, /const previewEditor = pathname\.endsWith\("\/preview"\) \? pathname\.slice\(0, -"\/preview"\.length\) : null;/);
  assert.match(src, /if \(previewEditor\) router\.push\(previewEditor\);/);
  // مسیرهای دیگر دست‌نخورده‌اند: تاریخچه، و بعد داشبورد.
  assert.match(src, /else if \(window\.history\.length > 1\) router\.back\(\);\s*\n\s*else router\.push\("\/p-admin"\);/);
});

// ——— رنگِ کارتِ بلوک بر اساسِ گروه ————————————————————————————————————
// گروه در blockRegistry تعریف می‌شود و رنگ در admin-theme.css؛ گروهِ تازه‌ای که
// رنگ نگیرد، خاموش به رنگِ پیش‌فرض می‌افتد و دقیقاً همان «همه شبیهِ هم» برمی‌گردد.
test("هر گروهِ بلوک، هم نامِ لاتین دارد هم رنگ", async () => {
  const registry = await read("../src/components/admin/articles/blockRegistry.js");
  const css = await read("../src/styles/admin-theme.css");
  const groups = [...registry.matchAll(/group: "([^"]+)"/g)].map((m) => m[1]);
  const slugs = Object.fromEntries([...registry.slice(registry.indexOf("BLOCK_GROUP_SLUGS")).matchAll(/"([^"]+)": "([a-z]+)"/g)]
    .map((m) => [m[1], m[2]]));
  assert.ok(groups.length);
  for (const group of new Set(groups)) {
    const slug = slugs[group];
    assert.ok(slug, `گروهِ «${group}» نامِ لاتین ندارد`);
    assert.ok(css.includes(`[data-block-group="${slug}"]`), `گروهِ «${group}» رنگ ندارد`);
    // هر دو متغیّر لازم است: مرز و پس‌زمینه‌ی سربرگ.
    const rule = css.slice(css.indexOf(`[data-block-group="${slug}"]`)).split("\n")[0];
    assert.match(rule, /--admin-block-accent:/);
    assert.match(rule, /--admin-block-tint:/);
  }
});

test("سربرگِ کارت رنگِ ثابت ندارد و از گروه می‌خواند", async () => {
  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /data-block-group=\{BLOCK_GROUP_SLUGS\[definition\?\.group\] \|\| "content"\}/);
  // bg-gray-50 روی سربرگ، رنگِ گروه را می‌پوشاند.
  const header = editor.slice(editor.indexOf("<header className={`flex items-center gap-2"));
  assert.ok(!header.slice(0, 200).includes("bg-gray-50"));
});

// ——— اسلایدرِ بلوکِ ادغام‌شده و تیترِ تنادور ————————————————————————————
// هر دو باید *همان* پیاده‌سازیِ صفحه‌ی اصلی باشند، نه یک کپیِ شبیه؛ کپی همان
// روزی از هم دور می‌افتد که یکی‌شان عوض شود.
test("دکمه‌های اسلایدر همان کامپوننتِ صفحه‌ی اصلی‌اند", async () => {
  const nav = await read("../src/components/features/articles/MergedSliderNav.jsx");
  const home = await read("../src/components/features/bestSellers/BestSellers.js");
  assert.match(nav, /import HomeSliderNav from "@\/components\/features\/home\/HomeSliderNav"/);
  assert.match(home, /import HomeSliderNav from "@\/components\/features\/home\/HomeSliderNav"/);
  assert.match(home, /<HomeSliderNav prevClass="product-prev-btn" nextClass="product-next-btn" \/>/);
  // مارک‌آپِ دکمه فقط یک جا تعریف شده است.
  const shared = await read("../src/components/features/home/HomeSliderNav.jsx");
  assert.match(shared, /w-12 h-12 flex items-center justify-center text-gray-400 hover:text-\[#aa4725\]/);
  assert.ok(!home.includes("w-12 h-12 flex items-center justify-center"));
});

test("ناوبری فقط وقتی هست که بلوک واقعاً اسلایدر شده باشد", async () => {
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  // شبکه‌ای که اسکرول نمی‌شود، نه قاب می‌گیرد نه دکمه.
  assert.match(renderer, /return scrolls \? <SliderFrame spacing=\{spacing\}>\{scroller\}<\/SliderFrame> : scroller;/);
  // و «پهن‌تر از صفحه» اندازه‌گیری می‌شود، نه از تنظیمات حدس زده شود.
  const nav = await read("../src/components/features/articles/MergedSliderNav.jsx");
  const lib = await read("../src/lib/sliderScroller.js");
  assert.match(lib, /scroller\.scrollWidth - scroller\.clientWidth/);
  assert.match(nav, /if \(!state\.scrolls\) return <span ref=\{anchor\} hidden \/>;/);
  // کشیدن با ماوس دست‌نخورده است.
  assert.match(renderer, /\{scrolls \? <DragScroll \/> : null\}/);
});

test("تیتر تنادور از همان عنوانِ بخش‌های صفحه‌ی اصلی می‌آید", async () => {
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /import HomeSectionHeading from "@\/components\/features\/home\/HomeSectionHeading"/);
  assert.match(renderer, /<HomeSectionHeading id=\{safeHeadingId\(block\)\} title=\{title\} highlight=\{highlight\} subtitle=/);
  // فقط سه متن قابلِ ویرایش است.
  const registry = await read("../src/components/admin/articles/blockRegistry.js");
  const definition = registry.slice(registry.indexOf("  tenadorTitle: {"), registry.indexOf("  paragraph: {"));
  assert.match(definition, /styleKeys: SPACING_ONLY/);
  assert.deepEqual([...definition.matchAll(/text\("(\w+)"/g)].map((m) => m[1]), ["highlight", "title", "subtitle"]);
  const validation = await read("../src/lib/articleBlockValidation.js");
  assert.match(validation, /tenadorTitle: \(data\) => \(\{ highlight: string\(data\.highlight, 200\), title: string\(data\.title, 300\), subtitle: string\(data\.subtitle, 500\) \}\)/);
  const types = await read("../src/lib/articleBlockTypes.js");
  assert.match(types, /"tenadorTitle",/);
});

test("رنگِ عنوان از روی خودِ رشته بریده می‌شود، پس چندواژه‌ای هم کار می‌کند", async () => {
  const src = await read("../src/components/features/home/HomeSectionHeading.jsx");
  assert.match(src, /String\(title\)\.indexOf\(highlight\)/);
  assert.ok(!src.includes("title.split(\" \")"));
});

// ——— ناوبری نباید ردیف بگیرد، و حرکت باید یکی باشد ————————————————————
test("ناوبری بیرونِ جریانِ صفحه است، با همان فاصله‌ی صفحه‌ی اصلی", async () => {
  const nav = await read("../src/components/features/articles/MergedSliderNav.jsx");
  // absolute + bottom-full: هیچ ارتفاعی اضافه نمی‌کند، پس فاصله‌ی بلوکِ بالایی
  // تا اسلایدر همانی می‌ماند که ادمین تنظیم کرده.
  assert.match(nav, /className="pointer-events-none absolute bottom-full end-0 mb-10 md:mb-16"/);
  // mb-10/md:mb-16 دقیقاً فاصله‌ی سرصفحه تا اسلایدر در صفحه‌ی اصلی است.
  const home = await read("../src/components/features/bestSellers/BestSellers.js");
  assert.match(home, /justify-between mb-10 md:mb-16/);
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /<div className=\{`\$\{blockSection\} relative`\}/);
});

test("حرکتِ اسلایدرِ ادغام‌شده از همان تنظیماتِ صفحه‌ی اصلی می‌آید", async () => {
  const shared = await read("../src/lib/homeSlider.js");
  assert.match(shared, /HOME_SLIDER_AUTOPLAY = \{ delay: 5000, disableOnInteraction: true \}/);
  assert.match(shared, /HOME_SLIDER_SPEED = 300/);
  for (const file of ["bestSellers/BestSellers.js", "amazingOffers/AmazingOffers.js"]) {
    const src = await read(`../src/components/features/${file}`);
    assert.match(src, /import \{ HOME_SLIDER_AUTOPLAY, HOME_SLIDER_SPEED \} from "@\/lib\/homeSlider"/);
    assert.match(src, /speed=\{HOME_SLIDER_SPEED\}/);
    assert.match(src, /autoplay=\{\{ \.\.\.HOME_SLIDER_AUTOPLAY \}\}/);
    // هیچ عددِ موازی‌ای نماند.
    assert.ok(!src.includes("delay: 5000"), `${file} still carries its own delay`);
  }
  const nav = await read("../src/components/features/articles/MergedSliderNav.jsx");
  const lib = await read("../src/lib/sliderScroller.js");
  // مکانیکِ حرکت یک جاست و هر دو اسلایدر از آن می‌خوانند.
  assert.match(lib, /HOME_SLIDER_SPEED, homeSliderEase/);
  // behavior:"smooth" مدتش را مرورگر تعیین می‌کند؛ با آن «همان سرعت» ممکن نیست.
  assert.ok(!lib.includes('behavior: "smooth"'));
  assert.match(lib, /\(now - started\) \/ HOME_SLIDER_SPEED/);
  // snap در طولِ حرکت خاموش است، وگرنه هر نوشتنِ scrollLeft می‌پرد.
  assert.match(lib, /scroller\.style\.scrollSnapType = "none"/);
  assert.match(nav, /setInterval\(\(\) => step\(state\.atEnd \? 0 : 1\), HOME_SLIDER_AUTOPLAY\.delay\)/);
});

test("پیش‌نمایش رنگِ سایت را نشان می‌دهد، نه پریمریِ سبزِ پنل", async () => {
  const css = (await read("../src/app/globals.css")).split(/\r?\n/);
  // همان اعلانِ :root است، نه یک کپیِ دوم که از آن جدا بیفتد.
  const at = css.findIndex((line) => line.trim() === ".site-colors {");
  assert.ok(at > 0, "کلاسِ .site-colors نیست");
  assert.equal(css[at - 1].trim(), ":root,");
  assert.match(css[at + 1], /--primary: 15 64% 41%;/);
  const canvas = await read("../src/components/admin/articles/PreviewCanvas.jsx");
  assert.ok(canvas.includes('className={`site-colors${canEdit ? " preview-canvas" : ""}`}'));
});

// ——— بلوکِ هدر ————————————————————————————————————————————————
test("هدر از همان SportHero سایت می‌آید، نه یک کپیِ شبیه", async () => {
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  assert.match(renderer, /import SportHero from "@\/components\/templates\/sports\/SportHero"/);
  assert.match(renderer, /<SportHero image=\{data\.url\} title=\{data\.title\} alt=\{data\.title\} \/>/);
  // هیچ اندازه\u200cای دوباره اینجا نوشته نشده باشد: ارتفاع، گرادیان و تایپوگرافی
  // فقط از خودِ کامپوننت بیاید، وگرنه روزی از هدرِ سایت دور می\u200cافتد.
  const branch = renderer.slice(renderer.indexOf('block.type === "header"'), renderer.indexOf('block.type === "heading"'));
  for (const copied of ["h-[100px]", "md:h-[220px]", "bg-gradient-to-t", "drop-shadow-xl", "text-xl md:text-4xl"]) {
    assert.ok(!branch.includes(copied), `"${copied}" در بلوک تکرار شده است`);
  }
});

test("هدر فقط دو چیزِ تنظیم\u200cپذیر دارد: تیتر و تصویر", async () => {
  const registry = await read("../src/components/admin/articles/blockRegistry.js");
  const definition = registry.slice(registry.indexOf("  header: {"), registry.indexOf("  divider: {"));
  assert.deepEqual([...definition.matchAll(/text\("(\w+)"/g)].map((m) => m[1]), ["title", "url"]);
  assert.match(definition, /styleKeys: SPACING_ONLY/);
  // کلیدِ تصویر باید url باشد: کادرِ تصویرِ مشترک patch را با همین نام می\u200cفرستد.
  assert.match(definition, /text\("url", "[^"]+", "image"\)/);

  const validation = await read("../src/lib/articleBlockValidation.js");
  assert.match(validation, /header: \(data, errors, field\) => \(\{ title: string\(data\.title, 300\), url: url\(data\.url, errors, `\$\{field\}\.url`, \{ media: true \}\) \}\)/);
  const types = await read("../src/lib/articleBlockTypes.js");
  assert.match(types, /"header",/);
});


// ——— اسلایدرِ تصویر ————————————————————————————————————————————
test("اسلایدرِ تصویر همان مکانیکِ اسلایدرهای دیگر را دارد، نه یک نسخه‌ی موازی", async () => {
  const controls = await read("../src/components/features/articles/ImageSliderControls.jsx");
  assert.match(controls, /from "@\/lib\/sliderScroller"/);
  // حرکت/کشیدن اینجا دوباره نوشته نشده باشد.
  assert.ok(!controls.includes("requestAnimationFrame") || !controls.includes("homeSliderEase"));
  const renderer = await read("../src/components/features/articles/ArticleBlockRenderer.jsx");
  // کشیدن با ماوس همان جزیره‌ی مشترک است (آستانه، بلعیدنِ کلیک، انتخابِ متن).
  const branch = renderer.slice(renderer.indexOf('block.type === "imageSlider"'), renderer.indexOf('block.type === "image" &&'));
  assert.match(branch, /<DragScroll \/>/);
  assert.match(branch, /snap-x snap-mandatory/);
});

test("کلیکِ پیاپی snap را برای همیشه خاموش نمی‌کند", async () => {
  const lib = await read("../src/lib/sliderScroller.js");
  // بازگرداندنِ مقدارِ ذخیره‌شده، با دو حرکتِ هم‌پوشان «none» را ماندگار می‌کرد.
  assert.match(lib, /scroller\.style\.removeProperty\("scroll-snap-type"\)/);
  assert.ok(!/const snap = scroller\.style\.scrollSnapType/.test(lib), "مقدارِ قبلی نباید ذخیره شود");
  // حرکتِ قبلی لغو می‌شود تا از موقعیتِ فعلی شروع کند.
  assert.match(lib, /cancelAnimationFrame\(frame\.current\)/);
});

test("فقط بلوکِ تصویر داخلِ اسلایدر می‌ماند — در ویرایشگر و در سرور", async () => {
  const { sanitizeArticleBlocks } = await import("../src/lib/articleValidation.js");
  const errors = {};
  const [slider] = sanitizeArticleBlocks([{
    id: "sl", type: "imageSlider", version: 1,
    data: { blocks: [
      { id: "a", type: "image", version: 1, data: { url: "https://ik.imagekit.io/t/a.jpg" } },
      { id: "b", type: "paragraph", version: 1, data: { text: "نباید بماند" } },
      { id: "c", type: "merged", version: 1, data: { blocks: [] } },
    ] },
  }], errors);
  assert.deepEqual(errors, {});
  assert.deepEqual(slider.data.blocks.map((b) => b.type), ["image"], "نوعِ دیگری نباید بماند");
  // اندازه و مکث همیشه ذخیره می‌شوند و روی پله و داخلِ بازه می‌نشینند.
  assert.equal(slider.data.height, 320);
  assert.equal(slider.data.delay, 5000);
  const [clamped] = sanitizeArticleBlocks([{ id: "s2", type: "imageSlider", version: 1, data: { height: 5000, delay: 10, blocks: [] } }], {});
  assert.equal(clamped.data.height, 900);
  assert.equal(clamped.data.delay, 1000);

  const editor = await read("../src/components/admin/articles/BlockEditor.jsx");
  assert.match(editor, /if \(field\.kind === "imageSliderBlocks"\) return <BlockEditor value=\{Array\.isArray\(value\) \? value : \[\]\} onChange=\{onChange\} allow=\{IMAGE_SLIDER_CHILD_TYPES\} \/>;/);
  // کتابخانه فیلتر می‌شود و «ادغام» خاموش است (بلوکِ merged را سرور دور می‌ریزد).
  assert.match(editor, /\(!allow \|\| allow\.includes\(type\)\)/);
  assert.match(editor, /selectable=\{!allow\}/);
});

test("اسلایدر با عوض‌شدنِ اسلاید تغییرِ اندازه نمی‌دهد", async () => {
  const css = await read("../src/app/globals.css");
  // ارتفاع روی خودِ خانه است و از متغیّرِ ظرف می‌آید؛ تصویر در همان قاب برش می‌خورد.
  assert.match(css, /\.a-slide \{\s*\r?\n\s*height: var\(--slide-h\);/);
  assert.match(css, /\.a-slide img \{[\s\S]*?object-fit: cover;/);
  // بدونِ !important: کلاس‌های خودِ بلوکِ تصویر تک‌کلاسه‌اند و انتخابگرِ نزولی خاص‌تر است.
  const slice = css.slice(css.indexOf(".a-slider {"), css.indexOf("ارتفاعِ خطِ متنِ بلوک‌ها"));
  assert.ok(!slice.includes("!important"));
});

test("یک تایمر، با پاک‌سازی؛ ناوبریِ دستی آن را از نو می‌چیند", async () => {
  const controls = await read("../src/components/features/articles/ImageSliderControls.jsx");
  assert.equal((controls.match(/setInterval\(/g) || []).length, 1, "بیش از یک تایمر");
  assert.match(controls, /return \(\) => clearInterval\(timer\);/);
  // با هر ناوبری/دخالت، بازه از نو شروع می‌شود (restart در وابستگی‌های effect).
  assert.match(controls, /\[edges\.scrolls, delay, restart\]/);
  assert.match(controls, /setRestart\(\(value\) => value \+ 1\)/);
  // شنونده‌ها و رشته‌ی انیمیشن در unmount پاک می‌شوند.
  assert.match(controls, /observer\.disconnect\(\)/);
  assert.match(controls, /cancelAnimationFrame\(current\.current\)/);
});

