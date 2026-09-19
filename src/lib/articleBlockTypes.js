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
// layout)، پس «جداسازی» دقیقاً همان ساختارِ قبلی را برمی‌گرداند. فقط یک سطح:
// بلوکِ ادغام‌شده داخلِ بلوکِ ادغام‌شده مجاز نیست.
export const MERGED_BLOCK_TYPE = "merged";
export const MAX_MERGED_CHILDREN = 12;

export const isMergedBlock = (block) => block?.type === MERGED_BLOCK_TYPE;
export const mergedChildren = (block) => (isMergedBlock(block) && Array.isArray(block.data?.blocks) ? block.data.blocks : []);

/**
 * همه‌ی بلوک‌ها، با فرزندانِ بلوک‌های ادغام‌شده به‌جای خودشان. هر جا که «بلوک‌ها
 * را می‌گردد» (ارجاعِ محصول/برند، فهرستِ مطالب، FAQ، …) باید از این استفاده کند،
 * وگرنه محتوای داخلِ بلوکِ ادغام‌شده دیده نمی‌شود.
 */
export function flattenArticleBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).flatMap((block) => (isMergedBlock(block) ? mergedChildren(block) : [block]));
}
