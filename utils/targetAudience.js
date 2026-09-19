/**
 * منبع واحد مقادیر و منطق «مخاطب هدف» محصول.
 *
 * «یونی سکس» فقط معادل مردانه + زنانه است و هرگز در فیلتر بچگانه قرار نمی‌گیرد.
 * مقدار قدیمی «همه» فقط برای سازگاریِ زمان مهاجرت خوانده می‌شود و در نوشتن‌های
 * جدید همیشه به «یونی سکس» تبدیل خواهد شد.
 */
export const TARGET_AUDIENCE = Object.freeze({
  MEN: "مردانه",
  WOMEN: "زنانه",
  KIDS: "بچگانه",
  UNISEX: "یونی سکس",
});

export const LEGACY_ALL_TARGET_AUDIENCE = "همه";

export const TARGET_AUDIENCE_VALUES = Object.freeze([
  TARGET_AUDIENCE.MEN,
  TARGET_AUDIENCE.WOMEN,
  TARGET_AUDIENCE.KIDS,
  TARGET_AUDIENCE.UNISEX,
]);

export const TARGET_AUDIENCE_FILTER_VALUES = Object.freeze([
  TARGET_AUDIENCE.MEN,
  TARGET_AUDIENCE.WOMEN,
  TARGET_AUDIENCE.KIDS,
]);

export const TARGET_AUDIENCE_SELECT_OPTIONS = Object.freeze(
  TARGET_AUDIENCE_VALUES.map((value) => Object.freeze({ value, label: value })),
);

const TARGET_AUDIENCE_ALIASES = new Map([
  [LEGACY_ALL_TARGET_AUDIENCE, TARGET_AUDIENCE.UNISEX],
  ["یونیسکس", TARGET_AUDIENCE.UNISEX],
  ["یونی‌سکس", TARGET_AUDIENCE.UNISEX],
]);

/** مقدار ورودی/قدیمی را به یکی از چهار مقدار canonical تبدیل می‌کند. */
export function normalizeTargetAudience(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (TARGET_AUDIENCE_VALUES.includes(trimmed)) return trimmed;
  return TARGET_AUDIENCE_ALIASES.get(trimmed) || null;
}

/**
 * مقادیر واقعیِ ذخیره‌شده‌ای که برای یک فیلتر باید در Mongo تطبیق داده شوند.
 * «همه» تا پایان اجرای migration پشتیبانی می‌شود، اما برای بچگانه عمداً وجود ندارد.
 */
export function getTargetAudienceStorageMatches(value) {
  const normalized = normalizeTargetAudience(value);
  if (!normalized) return [];

  if (normalized === TARGET_AUDIENCE.MEN || normalized === TARGET_AUDIENCE.WOMEN) {
    return [normalized, TARGET_AUDIENCE.UNISEX, LEGACY_ALL_TARGET_AUDIENCE];
  }
  if (normalized === TARGET_AUDIENCE.UNISEX) {
    return [TARGET_AUDIENCE.UNISEX, LEGACY_ALL_TARGET_AUDIENCE];
  }
  return [TARGET_AUDIENCE.KIDS];
}

export function buildTargetAudienceMatch(value) {
  const values = getTargetAudienceStorageMatches(value);
  return values.length > 0 ? { $in: values } : null;
}

/** مخاطب‌های قابل‌فیلتر را از مقادیر ذخیره‌شده استخراج می‌کند. */
export function getEffectiveTargetAudienceFilters(values = []) {
  const available = new Set();

  for (const value of values || []) {
    const normalized = normalizeTargetAudience(value);
    if (normalized === TARGET_AUDIENCE.UNISEX) {
      available.add(TARGET_AUDIENCE.MEN);
      available.add(TARGET_AUDIENCE.WOMEN);
    } else if (TARGET_AUDIENCE_FILTER_VALUES.includes(normalized)) {
      available.add(normalized);
    }
  }

  return TARGET_AUDIENCE_FILTER_VALUES.filter((value) => available.has(value));
}

export function targetAudienceListMatches(values, selected) {
  const normalizedSelected = normalizeTargetAudience(selected);
  if (!normalizedSelected) return !selected;
  return getEffectiveTargetAudienceFilters(values).includes(normalizedSelected);
}

/**
 * آیا یک ویژگیِ ثابتِ دسته برای محصولی با این مخاطب هدف کاربرد دارد؟
 *
 * `targetAudiences` روی ویژگی یعنی «این ویژگی فقط برای این مخاطب‌ها معنی دارد»
 * (مثلاً بالانس فقط روی راکتِ بزرگسال). قاعده‌ی تطبیق دقیقاً همان قاعده‌ی
 * فیلترهاست تا رفتارِ «یونی سکس» در کلِ سیستم یکی بماند: تگِ «یونی سکس» یعنی
 * بزرگسال — مردانه و زنانه را هم می‌گیرد و هرگز بچگانه را نمی‌گیرد.
 *
 * سه حالت عمداً «کاربرد دارد» برمی‌گردانند تا هیچ داده‌ای بی‌صدا پنهان نشود:
 *   - فهرستِ خالی/نبود  → بدونِ محدودیت (رفتارِ همه‌ی ویژگی‌های موجود، بدون مهاجرت)
 *   - مخاطبِ هدفِ محصول خالی یا ناشناخته → محصولِ قدیمیِ Backfill‌نشده
 *   - فهرستی که هیچ مقدارِ معتبری ندارد → داده‌ی خراب، نه دستورِ پنهان‌سازی
 */
export function attributeAppliesToAudience(targetAudiences, productAudience) {
  if (!Array.isArray(targetAudiences) || targetAudiences.length === 0) return true;

  const allowed = targetAudiences
    .map(normalizeTargetAudience)
    .filter(Boolean);
  if (allowed.length === 0) return true;

  const productMatches = getTargetAudienceStorageMatches(productAudience);
  if (productMatches.length === 0) return true;

  return allowed.some((value) => productMatches.includes(value));
}

/** همان قاعده، اعمال‌شده روی آرایه‌ی ویژگی‌های دسته. */
export function filterAttributesByAudience(attributes, productAudience) {
  if (!Array.isArray(attributes)) return [];
  return attributes.filter((attr) =>
    attributeAppliesToAudience(attr?.targetAudiences, productAudience),
  );
}
