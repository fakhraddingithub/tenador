export const ARTICLE_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
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
  return (Array.isArray(blocks) ? blocks : []).flatMap((block) => (isMergedBlock(block) ? flattenArticleBlocks(mergedChildren(block)) : [block]));
}

// ——— چیدمانِ شبکه‌ایِ بلوکِ ادغام‌شده (data.grid) ————————————————————————
// نبودنِ grid یعنی همان ردیفِ افقیِ پیش‌فرض (رفتارِ قبلی، بدونِ هیچ تغییر).
// هر breakpoint جدا: columns، rows، fit (هم‌اندازه‌ی صفحه) و کمینه‌ی عرضِ ستون.
//  - fit: دقیقاً columns ستون که کوچک می‌شوند؛ ردیف‌ها خودکار؛ هرگز اسکرولِ افقی.
//  - بدونِ fit: چیدمانِ columns × rows حفظ می‌شود؛ آیتم‌هایی که در rows ردیف جا
//    نمی‌شوند به کنار می‌روند و سطر به اسلایدرِ افقی تبدیل می‌شود.
export const MERGED_GRID_BREAKPOINTS = ["desktop", "mobile"];
export const MERGED_GRID_LIMITS = { columns: [1, 12], rows: [1, 12], minWidth: [0, 800] };

const clampInt = (value, [min, max], fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/** پیش‌فرضِ پنجره‌ی تنظیمات برای بلوکی که هنوز grid ندارد. */
export function defaultMergedGrid(count) {
  const columns = Math.min(Math.max(count, 1), MERGED_GRID_LIMITS.columns[1]);
  return {
    desktop: { columns, rows: 1, fit: true, minWidth: 0 },
    mobile: { columns: Math.min(columns, 2), rows: Math.max(1, Math.ceil(count / Math.min(columns, 2))), fit: true, minWidth: 0 },
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
    };
  }
  return grid;
}
