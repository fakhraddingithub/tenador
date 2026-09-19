import { normalizeTargetAudience } from "base/utils/targetAudience";

/**
 * نرمال‌سازی و اعتبارسنجیِ `targetAudiences` روی فهرستِ ویژگی‌های یک دسته.
 *
 * چرا اینجا و نه فقط enum مدل؟ چون enum مقدارِ قدیمیِ «همه» را رد می‌کند، در حالی
 * که در کلِ سیستم «همه» معادلِ «یونی سکس» خوانده می‌شود. بنابراین ورودی ابتدا
 * canonical می‌شود و بعد به مدل می‌رسد؛ مقدارِ واقعاً ناشناخته با پیغامِ فارسی رد
 * می‌شود، نه با ValidationError خامِ mongoose.
 *
 * `targetAudiences` نبودن (undefined) یعنی «این درخواست درباره‌ی مخاطب هدفِ این
 * ویژگی نیست» و ویژگی دست‌نخورده رد می‌شود — همان قراردادِ undefined ≠ {} که در
 * productVariantValidation.js هم رعایت شده است.
 *
 * @returns {{attributes: any[]}|{error: string}}
 */
export function normalizeAttributeAudiences(list, label) {
  if (!Array.isArray(list)) return { attributes: list };

  const attributes = [];
  for (const attr of list) {
    const raw = attr?.targetAudiences;
    if (raw === undefined || raw === null) {
      attributes.push(attr);
      continue;
    }

    const name = attr?.label || attr?.name || "";
    if (!Array.isArray(raw)) {
      return { error: `مخاطب هدف ویژگی «${name}» در بخش ${label} باید فهرست باشد` };
    }

    const normalized = [];
    for (const value of raw) {
      const canonical = normalizeTargetAudience(value);
      if (!canonical) {
        return {
          error: `مخاطب هدف «${value}» برای ویژگی «${name}» در بخش ${label} معتبر نیست`,
        };
      }
      if (!normalized.includes(canonical)) normalized.push(canonical);
    }

    attributes.push({ ...attr, targetAudiences: normalized });
  }

  return { attributes };
}
