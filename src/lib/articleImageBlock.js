/**
 * شکلِ دادهٔ بلوکِ «تصویر».
 *
 * قدیمی (همچنان معتبر): { url, alt, caption, width, height } — یک تصویر.
 * جدید (همه اختیاری):
 *   images: [{ url, alt, width, height, href, overlayText }]  — چند تصویر
 *   displayHeight: عدد (px) — ارتفاعِ نمایش؛ نبودنش یعنی نسبتِ اصلیِ تصویر، مثل قبل
 *   overlay: { color, size, align, dir, position, shade } — ظاهرِ متنِ روی تصویر
 *
 * وقتی images هست، url/alt/width/height همیشه آینه‌ی images[0] نگه داشته می‌شوند
 * تا هر خواننده‌ی قدیمی (اسکریپتِ ابعاد، …) همچنان تصویرِ اول را ببیند.
 */

export const MAX_IMAGE_BLOCK_ITEMS = 12;
export const IMAGE_DISPLAY_HEIGHT = { min: 80, max: 1200 };
export const OVERLAY_SIZES = ["sm", "md", "lg", "xl"];
export const OVERLAY_ALIGNS = ["right", "center", "left"];
export const OVERLAY_DIRS = ["rtl", "ltr"];
export const OVERLAY_POSITIONS = ["top", "center", "bottom"];

/** تصاویرِ بلوک، چه با شکلِ قدیمی ذخیره شده باشد چه جدید. */
export function imageBlockItems(data) {
  const images = Array.isArray(data?.images) ? data.images.filter((item) => item?.url) : [];
  if (images.length) return images;
  return data?.url
    ? [{ url: data.url, alt: data.alt || "", width: data.width, height: data.height }]
    : [];
}

/**
 * پیوندِ تصویر، همان‌طور که ادمین تایپ می‌کند. «tenador.com/tennis» → https://…،
 * «tennis/racket» → /tennis/racket. خالی → ""؛ نامعتبر (پروتکلِ ناامن مثلِ
 * javascript:، یا //host) → null.
 *
 * چرا این‌قدر بخشنده: یک مقدارِ ردشده در هر بلوک، ذخیره‌ی *کلِ* برند را با ۴۰۰
 * رد می‌کرد؛ ادمین نه می‌توانست ویرایش کند نه حذف، و محتوا روی سایت می‌ماند.
 * سرور و ویرایشگر هر دو از همین تابع استفاده می‌کنند تا قضاوتشان یکی باشد.
 */
export function normalizeImageHref(value) {
  const raw = typeof value === "string" ? value.trim().slice(0, 2000) : "";
  if (!raw) return "";
  let candidate = raw;
  if (!raw.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    candidate = /^[^/\s?#]+\.[a-z]{2,}(?:[/?#]|$)/i.test(raw) ? `https://${raw}` : `/${raw}`;
  }
  if (candidate.startsWith("//")) return null;
  if (candidate.startsWith("/")) return /\s/.test(candidate) ? null : candidate;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** فیلدهای قدیمیِ سطحِ بلوک را از تصویرِ اول می‌سازد. */
export function mirrorFirstImage(images) {
  const first = images[0] || {};
  return { url: first.url || "", alt: first.alt || "", width: first.width, height: first.height };
}
