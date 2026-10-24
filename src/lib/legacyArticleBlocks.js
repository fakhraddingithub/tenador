/**
 * بلوک‌های حذف‌شده و جانشینشان — یک تابعِ خالص، برای هر جایی که محتوای قدیمی
 * ممکن است برسد: ذخیره (articleValidation)، رندر (resolver + renderer)، ویرایشگر
 * (BlockEditor، PreviewCanvas) و مهاجرت (scripts/migrateLegacyBlocks.mjs).
 *
 * | قدیمی | جانشین |
 * |---|---|
 * | gallery | image — همان تصویرها؛ بیش از ۱۲ تا در چند بلوکِ تصویرِ پشتِ‌سرِ‌هم، و زیرنویسِ هر تصویر به‌جای alt ـِ خالی |
 * | usedProducts | productSlider با همان آگهی‌ها (usedProducts) |
 * | brandSlider | brandBar با همان برندها |
 * | latestProducts / bestSellers / amazingOffers | — (پویا بودند؛ مهاجرت پیش از این تابع محصولاتِ امروزشان را در یک productSlider ثبت می‌کند) |
 * | collectionSlider / categorySlider / sportSlider | — (جانشینی ندارند؛ مهاجرت فهرستشان را گزارش می‌کند) |
 *
 * بلوکِ بی‌جانشین در ذخیره حذف می‌شود (همان قاعده‌ی overlayText)؛ برای همین
 * `npm run migrate:legacy-blocks` باید پیش از ویرایشِ دوباره‌ی محتوا اجرا شود.
 * ویرایشگر با keepRemoved آن‌ها را نگه می‌دارد تا ادمین ببیند چه چیزی با ذخیره
 * پاک می‌شود، نه اینکه بی‌صدا گم شود.
 */
import { MAX_IMAGE_BLOCK_ITEMS } from "./articleImageBlock.js";

export const DYNAMIC_PRODUCT_BLOCK_TYPES = ["latestProducts", "bestSellers", "amazingOffers"];
export const REMOVED_BLOCK_TYPES = [...DYNAMIC_PRODUCT_BLOCK_TYPES, "collectionSlider", "categorySlider", "sportSlider"];
export const LEGACY_BLOCK_TYPES = new Set(["gallery", "usedProducts", "brandSlider", ...REMOVED_BLOCK_TYPES]);

const REMOVED = new Set(REMOVED_BLOCK_TYPES);
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));
const ids = (value) => (Array.isArray(value) ? value : []).map(String);
// style/layout/version همان می‌مانند؛ فقط نوع و داده عوض می‌شود.
const rebuild = (block, type, data, id = block.id) => ({ ...block, id, type, data });

function galleryImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((item) => (typeof item === "string" ? { url: item } : item))
    .filter((item) => item?.url)
    .map((item) => {
      const image = { url: item.url, alt: item.alt || item.caption || "" };
      if (Number.isInteger(item.width) && item.width > 0) image.width = item.width;
      if (Number.isInteger(item.height) && item.height > 0) image.height = item.height;
      return image;
    });
}

/** یک بلوکِ قدیمی → صفر، یک یا چند بلوکِ جانشین. بلوکِ غیرقدیمی دست‌نخورده برمی‌گردد. */
export function upgradeLegacyBlock(block, { keepRemoved = false } = {}) {
  if (!block || !LEGACY_BLOCK_TYPES.has(block.type)) return [block];
  const data = block.data || {};
  if (block.type === "gallery") {
    const groups = chunk(galleryImages(data.images), MAX_IMAGE_BLOCK_ITEMS);
    return groups.map((images, index) => rebuild(block, "image", {
      url: images[0].url, alt: images[0].alt, caption: "",
      ...(images[0].width ? { width: images[0].width } : {}), ...(images[0].height ? { height: images[0].height } : {}),
      images,
    }, index ? `${block.id}-${index + 1}` : block.id));
  }
  if (block.type === "usedProducts") return [rebuild(block, "productSlider", { title: data.title || "", products: [], usedProducts: ids(data.products) })];
  if (block.type === "brandSlider") return [rebuild(block, "brandBar", { brands: ids(data.brands) })];
  return REMOVED.has(block.type) && keepRemoved ? [block] : [];
}

/** کلِ درخت — فرزندانِ بلوکِ ادغام‌شده، روی تصویر و اسلایدرِ تصویر هم. */
export function upgradeLegacyBlocks(blocks, options) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.flatMap((block) => upgradeLegacyBlock(block, options)).map((block) => {
    if (!Array.isArray(block?.data?.blocks)) return block;
    return { ...block, data: { ...block.data, blocks: upgradeLegacyBlocks(block.data.blocks, options) } };
  });
}

const CONVERTIBLE = new Set(["gallery", "usedProducts", "brandSlider"]);

/** بلوکِ قدیمی‌ای که جانشین دارد؟ (ویرایشگر فقط این‌ها را بی‌درنگ تبدیل می‌کند.) */
export function hasConvertibleLegacyBlocks(blocks) {
  return Array.isArray(blocks) && blocks.some((block) => CONVERTIBLE.has(block?.type) || hasConvertibleLegacyBlocks(block?.data?.blocks));
}

/** آیا جایی از درخت بلوکِ قدیمی هست؟ (تا وقتی نیست، هیچ کپی‌ای ساخته نمی‌شود.) */
export function hasLegacyBlocks(blocks) {
  return Array.isArray(blocks) && blocks.some((block) => LEGACY_BLOCK_TYPES.has(block?.type) || hasLegacyBlocks(block?.data?.blocks));
}
