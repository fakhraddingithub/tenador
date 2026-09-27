export const ARTICLE_BLOCK_TYPES = [
  "heading",
  "tenadorTitle",
  "header",
  "paragraph",
  "image",
  "imageSlider",
  "gallery",
  "video",
  "quote",
  "divider",
  "button",
  "callout",
  "table",
  "faq",
  "productCard",
  "productSlider",
  "collectionSlider",
  "brandSlider",
  "categorySlider",
  "sportSlider",
  "latestProducts",
  "bestSellers",
  "amazingOffers",
  "usedProducts",
  "relatedArticles",
  "newsletterCta",
  "customHtml",
  // بلوکِ ادغام‌شده: چند بلوکِ کنارِ هم که یک بلوک شده‌اند (فقط با «ادغام» ساخته می‌شود).
  "merged",
];

export const ARTICLE_BLOCK_TYPE_SET = new Set(ARTICLE_BLOCK_TYPES);


// ——— بلوکِ ادغام‌شده ——————————————————————————————————————————————————
// data.blocks همان بلوک‌های اصلی را عیناً نگه می‌دارد (id، type، data، style،
// layout)، پس «جداسازی» دقیقاً همان ساختارِ قبلی را برمی‌گرداند. بلوکِ ادغام‌شده
// خودش یک بلوکِ عادی است و می‌تواند دوباره با بلوک‌های دیگر ادغام شود (تا
// MAX_MERGE_DEPTH سطح). جداسازی همیشه فقط یک سطح را باز می‌کند.
export const MERGED_BLOCK_TYPE = "merged";
export const MAX_MERGED_CHILDREN = 12;
export const MAX_MERGE_DEPTH = 3;

export const isMergedBlock = (block) => block?.type === MERGED_BLOCK_TYPE;
export const mergedChildren = (block) => (isMergedBlock(block) && Array.isArray(block.data?.blocks) ? block.data.blocks : []);

/** عمقِ تودرتوییِ ادغام: بلوکِ عادی ۰، ادغامِ بلوک‌های عادی ۱، … */
export function mergeDepth(block) {
  return isMergedBlock(block) ? 1 + Math.max(0, ...mergedChildren(block).map(mergeDepth)) : 0;
}

/**
 * همه‌ی بلوک‌ها، با فرزندانِ بلوک‌های ادغام‌شده (در هر عمقی) به‌جای خودشان. هر جا
 * که «بلوک‌ها را می‌گردد» (ارجاعِ محصول/برند، فهرستِ مطالب، FAQ، …) باید از این
 * استفاده کند، وگرنه محتوای داخلِ بلوکِ ادغام‌شده دیده نمی‌شود.
 */
export function flattenArticleBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).flatMap((block) => (isMergedBlock(block)
    // بلوکِ ادغام‌شده محتوای خودش را ندارد، پس *جایش* را فرزندانش می‌گیرند.
    ? flattenArticleBlocks(mergedChildren(block))
    // بلوکِ تصویر خودش محتواست و فرزندانش روی آن می‌نشینند، پس هر دو می‌آیند.
    : isImageSliderBlock(block)
      // اسلایدر خودش محتوایی ندارد؛ فقط ظرفِ تصویرهاست.
      ? flattenArticleBlocks(imageSliderChildren(block))
      : [block, ...flattenArticleBlocks(imageOverlayChildren(block))]));
}

// ——— بلوکی که بلوکِ دیگری در خود دارد ————————————————————————————————
// دو حالت هست و هر دو data.blocks را نگه می‌دارند: بلوکِ ادغام‌شده (کنارِ هم) و
// بلوکِ تصویر (روی تصویر). هر جا که «فرزندانِ یک بلوک» لازم است — پاک‌سازی،
// رونوشت، جمع‌کردنِ ارجاع‌ها — باید از این‌ها استفاده شود، وگرنه یکی از دو حالت
// خاموش از قلم می‌افتد.
export const HEADER_BLOCK_TYPE = "header";

/**
 * هدر جای ثابتی دارد: بالاترین چیزِ صفحه، بالای بردکرامب و بیرونِ ستونِ محتوا.
 * پس از جریانِ بلوک‌ها جدا می‌شود و صفحه خودش آن را در جای درست رندر می‌کند.
 *
 * جایی که هدر جدا نمی‌شود (پیش‌نمایش، مینی‌مقاله)، همان‌جا در جریان رندر می‌شود —
 * هیچ صفحه‌ای بی‌سر نمی‌ماند.
 */
export function splitHeaderBlock(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const at = list.findIndex((block) => block?.type === HEADER_BLOCK_TYPE);
  if (at < 0) return { header: null, blocks: list };
  return { header: list[at], blocks: list.filter((_, index) => index !== at) };
}

/** یک هدر، در صدر. هر چه بیشتر باشد کنار می‌رود — قاعده در *داده* است، نه در UI. */
export function normalizeHeaderPosition(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const headers = list.filter((block) => block?.type === HEADER_BLOCK_TYPE);
  if (!headers.length) return list;
  return [headers[0], ...list.filter((block) => block?.type !== HEADER_BLOCK_TYPE)];
}

export const IMAGE_BLOCK_TYPE = "image";
export const IMAGE_SLIDER_BLOCK_TYPE = "imageSlider";
// اسلایدرِ تصویر فقط بلوکِ تصویر می‌پذیرد — هم ویرایشگر همین را نشان می‌دهد هم
// پاک‌سازیِ سرور همین را نگه می‌دارد، پس از هیچ راهی نوعِ دیگری داخلش نمی‌ماند.
export const IMAGE_SLIDER_CHILD_TYPES = [IMAGE_BLOCK_TYPE];
export const isImageSliderBlock = (block) => block?.type === IMAGE_SLIDER_BLOCK_TYPE;
export const imageSliderChildren = (block) => (isImageSliderBlock(block) && Array.isArray(block.data?.blocks) ? block.data.blocks : []);
export const IMAGE_SLIDER_DELAY = { min: 1000, max: 20000, step: 500, default: 5000 };
export const IMAGE_SLIDER_HEIGHT = { min: 120, max: 900, step: 10, default: 320 };
export const isImageBlock = (block) => block?.type === IMAGE_BLOCK_TYPE;
export const imageOverlayChildren = (block) => (isImageBlock(block) && Array.isArray(block.data?.blocks) ? block.data.blocks : []);
export const blockHoldsBlocks = (block) => isMergedBlock(block) || isImageBlock(block) || isImageSliderBlock(block);
export const blockChildren = (block) => (isMergedBlock(block)
  ? mergedChildren(block)
  : isImageSliderBlock(block) ? imageSliderChildren(block) : imageOverlayChildren(block));

// ——— چیدمانِ شبکه‌ایِ بلوکِ ادغام‌شده (data.grid) ————————————————————————
// نبودنِ grid یعنی همان ردیفِ افقیِ پیش‌فرض (رفتارِ قبلی، بدونِ هیچ تغییر).
// هر breakpoint جدا: columns، rows، fit (هم‌اندازه‌ی صفحه) و کمینه‌ی عرضِ ستون.
//  - fit: دقیقاً columns ستون که کوچک می‌شوند؛ ردیف‌ها خودکار؛ هرگز اسکرولِ افقی.
//  - بدونِ fit: چیدمانِ columns × rows حفظ می‌شود؛ آیتم‌هایی که در rows ردیف جا
//    نمی‌شوند به کنار می‌روند و سطر به اسلایدرِ افقی تبدیل می‌شود.
export const MERGED_GRID_BREAKPOINTS = ["desktop", "mobile"];
export const MERGED_GRID_LIMITS = { columns: [1, 12], rows: [1, 12], minWidth: [0, 800], gap: [0, 8] };

// فاصله‌ی بینِ خانه‌ها به rem، جدا برای هر breakpoint. **پیش‌فرض صفر است**: بلوکِ
// ادغام‌شده از خودش هیچ فاصله‌ای اضافه نمی‌کند و فرزندها چسبیده رندر می‌شوند مگر
// اینکه ادمین صریحاً فاصله بگذارد. گامِ ۰٫۲۵ همان گامِ فاصله‌های بلوک است.
export const MERGED_GRID_GAP_STEP = 0.25;

const clampInt = (value, [min, max], fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const clampGap = (value) => {
  const [min, max] = MERGED_GRID_LIMITS.gap;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const stepped = Math.round(number / MERGED_GRID_GAP_STEP) * MERGED_GRID_GAP_STEP;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
};

/** پیش‌فرضِ پنجره‌ی تنظیمات برای بلوکی که هنوز grid ندارد. */
export function defaultMergedGrid(count) {
  const columns = Math.min(Math.max(count, 1), MERGED_GRID_LIMITS.columns[1]);
  return {
    desktop: { columns, rows: 1, fit: true, minWidth: 0, gap: 0 },
    mobile: { columns: Math.min(columns, 2), rows: Math.max(1, Math.ceil(count / Math.min(columns, 2))), fit: true, minWidth: 0, gap: 0 },
  };
}

/** grid → شکلِ امن و کامل، یا undefined (یعنی چیدمانِ ردیفیِ پیش‌فرض). */
export function sanitizeMergedGrid(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const grid = {};
  for (const key of MERGED_GRID_BREAKPOINTS) {
    const source = value[key] && typeof value[key] === "object" ? value[key] : null;
    if (!source) return undefined;
    grid[key] = {
      columns: clampInt(source.columns, MERGED_GRID_LIMITS.columns, 1),
      rows: clampInt(source.rows, MERGED_GRID_LIMITS.rows, 1),
      fit: source.fit === true,
      minWidth: clampInt(source.minWidth ?? 0, MERGED_GRID_LIMITS.minWidth, 0),
      // نبودِ کلید یعنی صفر — محتوای موجود بدونِ مهاجرت معتبر می‌ماند و فاصله‌ی
      // پیش‌فرضِ قبلی را scripts/pinMergedGap.mjs صریح می‌کند.
      gap: clampGap(source.gap ?? 0),
    };
  }
  return grid;
}

// عرضِ مرجع برای پیش‌نمایشِ مودال — همان فرمولِ رندر (MergedGrid) با عرضِ معلوم:
// موبایل = گوشیِ ۳۹۰px منهای حاشیه‌ی ۱۶px دو طرف؛ دسکتاپ = عرضِ متداولِ محتوا.
// فقط برای نمایش است و روی رندر اثری ندارد. مقدارِ gap اینجا صرفاً یک مرجعِ
// تاریخی است؛ پیش‌نمایشِ مودال فاصله‌ی *تنظیم‌شده* را می‌فرستد.
export const MERGED_GRID_REFERENCE = {
  mobile: { viewport: 390, width: 358, gap: 16 },
  desktop: { viewport: 1024, width: 1024, gap: 24 },
};

/**
 * نتیجه‌ی واقعیِ یک breakpoint در عرضِ داده‌شده: عرضِ هر ستون، چند ستونِ کامل در
 * دید است، و کمینه‌ی عرضی که columns ستون در آن جا می‌شوند. کمینه‌ی عرض (minWidth)
 * بر تعدادِ ستون غلبه می‌کند — این همان چیزی است که قبلاً در پیش‌نمایش دیده نمی‌شد.
 */
export function mergedGridColumnsAt(settings, { width, gap }) {
  const { columns } = settings;
  if (settings.fit) return { columnWidth: (width - (columns - 1) * gap) / columns, visible: columns, requiredWidth: 0 };
  const columnWidth = Math.max((width - (columns - 1) * gap) / columns, settings.minWidth);
  const visible = Math.max(1, Math.min(columns, Math.floor((width + gap) / (columnWidth + gap) + 1e-9)));
  return { columnWidth, visible, requiredWidth: columns * settings.minWidth + (columns - 1) * gap };
}
