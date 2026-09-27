/**
 * شکلِ دادهٔ بلوکِ «تصویر».
 *
 * قدیمی (همچنان معتبر): { url, alt, caption, width, height } — یک تصویر.
 * جدید (همه اختیاری):
 *   images: [{ url, alt, width, height, href }]  — چند تصویر
 *   displayHeight: عدد (px) — ارتفاعِ نمایش؛ نبودنش یعنی نسبتِ اصلیِ تصویر، مثل قبل
 *   shade: ۰ تا ۹۰ — تیرگیِ لایه‌ی روی تصویر (درصد)؛ ۰ یعنی بدونِ لایه
 *   blocks: [بلوک] — بلوک‌هایی که *روی* تصویر می‌نشینند
 *   contentPosition: top|center|bottom — جای عمودیِ آن بلوک‌ها روی تصویر
 *
 * وقتی images هست، url/alt/width/height همیشه آینه‌ی images[0] نگه داشته می‌شوند
 * تا هر خواننده‌ی قدیمی (اسکریپتِ ابعاد، …) همچنان تصویرِ اول را ببیند.
 *
 * **`overlayText` دیگر وجود ندارد.** متنِ روی تصویر یک بلوکِ کوچکِ مخصوص بود با
 * تنظیماتِ خودش (اندازه، رنگ، جهت) که با هیچ بلوکِ دیگری مشترک نبود. جایش را
 * بلوک‌های واقعی گرفته‌اند: هر نوع بلوکی می‌تواند روی تصویر بنشیند و *همه‌ی*
 * تنظیماتِ خودش را داشته باشد. `npm run migrate:image-overlay-text` متن‌های
 * موجود را به بلوکِ پاراگرافِ تودرتو تبدیل می‌کند.
 */

export const MAX_IMAGE_BLOCK_ITEMS = 12;
export const IMAGE_DISPLAY_HEIGHT = { min: 80, max: 1200 };
export const IMAGE_CONTENT_POSITIONS = ["top", "center", "bottom"];
export const IMAGE_SHADE = { min: 0, max: 90, step: 5 };

/** تصاویرِ بلوک، چه با شکلِ قدیمی ذخیره شده باشد چه جدید. */
export function imageBlockItems(data) {
  const images = Array.isArray(data?.images) ? data.images.filter((item) => item?.url) : [];
  if (images.length) return images;
  return data?.url
    ? [{ url: data.url, alt: data.alt || "", width: data.width, height: data.height }]
    : [];
}

/** بلوک‌هایی که روی تصویر می‌نشینند. نبودنشان یعنی تصویرِ ساده، مثلِ همیشه. */
export function imageBlockChildren(data) {
  return Array.isArray(data?.blocks) ? data.blocks : [];
}

/**
 * تیرگیِ لایه‌ی روی تصویر، ۰ تا ۹۰ درصد و روی پله‌های ۵تایی. ۰ (و هر مقدارِ
 * نامعتبر) یعنی هیچ لایه‌ای رندر نمی‌شود — پس تصویرِ موجود ذره‌ای عوض نمی‌شود.
 */
export function clampImageShade(value) {
  const shade = Math.round(Number(value) / IMAGE_SHADE.step) * IMAGE_SHADE.step;
  if (!Number.isFinite(shade) || shade <= IMAGE_SHADE.min) return 0;
  return Math.min(IMAGE_SHADE.max, shade);
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
