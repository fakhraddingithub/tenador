import { normalizeTargetAudience } from "base/utils/targetAudience";

/** Apply the server's category/sport context before handing AI data to the form. */
export function parseAiProductDraft(json, categoryId, meta) {
  const product = JSON.parse(json);
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw new Error("پاسخ AI باید یک شیء JSON محصول باشد");
  }
  if (!categoryId || meta?.categoryId !== categoryId || !meta?.sport?.id) {
    throw new Error("اطلاعات ورزش دسته‌بندی در دسترس نیست؛ پرامپت را دوباره بسازید");
  }
  if (product.targetAudience != null && product.targetAudience !== "") {
    const normalized = normalizeTargetAudience(product.targetAudience);
    if (!normalized) throw new Error("مخاطب هدف نامعتبر است");
    product.targetAudience = normalized;
  }
  return { ...product, category: categoryId, sport: meta.sport.id };
}
