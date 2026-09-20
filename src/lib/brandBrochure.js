import { sanitizeArticleBlocks } from "@/lib/articleValidation";

/**
 * بروشورِ برند (Brand.brochure): محتوای بلوکیِ تمام‌صفحه‌ی برند.
 *
 * همان بلوک‌های مقاله است (همان sanitizeArticleBlocks)، ولی بدونِ فیلدهای مقاله
 * (دسته، برچسب، نامک، سئو) — بروشور آدرسِ عمومیِ خودش را ندارد و روی همان آدرسِ
 * برند رندر می‌شود. فقط دو وضعیت دارد و فقط «published» عمومی است.
 */
export const BRAND_BROCHURE_STATUSES = ["draft", "published"];

export function sanitizeBrandBrochure(value, errors) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = BRAND_BROCHURE_STATUSES.includes(source.status) ? source.status : "draft";
  if (source.status !== undefined && !BRAND_BROCHURE_STATUSES.includes(source.status)) {
    errors.status = "وضعیت بروشور نامعتبر است";
  }
  const blocks = sanitizeArticleBlocks(source.blocks ?? [], errors);
  return { status, blocks, updatedAt: new Date() };
}

/** بروشور فقط وقتی جای صفحه‌ی برند را می‌گیرد که منتشر شده و دست‌کم یک بلوک داشته باشد. */
export function isBrochureLive(brochure) {
  return brochure?.status === "published" && Array.isArray(brochure.blocks) && brochure.blocks.length > 0;
}
