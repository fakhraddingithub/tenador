/**
 * شکلِ دادهٔ بلوکِ «تصویر».
 *
 * قدیمی (همچنان معتبر): { url, alt, caption, width, height } — یک تصویر.
 * جدید (همه اختیاری):
 *   images: [{ url, alt, width, height, href }]  — چند تصویر
 *   displayHeight: عدد (px) — ارتفاعِ نمایش؛ نبودنش یعنی نسبتِ اصلیِ تصویر، مثل قبل
 *   shade: ۰ تا ۱۰۰ — شدتِ لایه‌ی رنگ (درصد)؛ ۰ یعنی بدونِ لایه. رنگ، گرادیان و
 *          جای لایه (روی/پشتِ تصویر) کلیدهای shade* هستند — پایین‌تر
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
// شدتِ لایه‌ی رنگ (درصد). پیش‌تر ۰ تا ۹۰ با پله‌ی ۵ بود؛ هر مقدارِ ذخیره‌شده‌ی قبلی
// (مضربِ ۵، حداکثر ۹۰) در بازه‌ی تازه همان معنا را دارد، پس چیزی مهاجرت نمی‌خواهد.
export const IMAGE_SHADE = { min: 0, max: 100, step: 1 };

/**
 * لایه‌ی رنگِ تصویر. همه‌ی کلیدها اختیاری‌اند و پیش‌فرض‌ها ذخیره نمی‌شوند؛
 * پیش‌فرض دقیقاً رفتارِ قبلی است — رنگِ سیاهِ ساده، *روی* تصویر — پس تصویرِ
 * موجود با همان `shade` همان‌طور که بود رندر می‌شود.
 *
 *   shade           ۰–۱۰۰ — شدت (آلفای رنگ‌ها؛ نه opacityِ تصویر یا بلوک‌های رویی)
 *   shadeMode       "gradient" (نبودن = رنگِ ساده)
 *   shadeColor      #rrggbb — رنگ (یا رنگِ اولِ گرادیان)
 *   shadeColor2     #rrggbb — رنگِ دومِ گرادیان
 *   shadeDirection  to-bottom | to-top | to-right | to-left
 *   shadeLayer      "below" — پشتِ تصویر (نبودن = روی تصویر)
 */
export const IMAGE_SHADE_DIRECTIONS = ["to-bottom", "to-top", "to-right", "to-left"];
export const IMAGE_SHADE_DEFAULTS = { mode: "solid", layer: "above", color: "#000000", color2: "#ffffff", direction: "to-bottom" };

/** «#abc»، «abc»، «#AABBCC» → «#aabbcc»؛ هر چیزِ دیگر → null. */
export function normalizeHexColor(value) {
  const raw = typeof value === "string" ? value.trim().replace(/^#/, "") : "";
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${[...raw].map((char) => char + char).join("")}`.toLowerCase();
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toLowerCase()}` : null;
}

/** تنظیماتِ مؤثرِ لایه، با پیش‌فرض‌ها پر شده — خواننده‌ی مشترکِ ویرایشگر و رندر. */
export function imageShadeSettings(data) {
  return {
    shade: clampImageShade(data?.shade),
    mode: data?.shadeMode === "gradient" ? "gradient" : IMAGE_SHADE_DEFAULTS.mode,
    layer: data?.shadeLayer === "below" ? "below" : IMAGE_SHADE_DEFAULTS.layer,
    color: normalizeHexColor(data?.shadeColor) || IMAGE_SHADE_DEFAULTS.color,
    color2: normalizeHexColor(data?.shadeColor2) || IMAGE_SHADE_DEFAULTS.color2,
    direction: IMAGE_SHADE_DIRECTIONS.includes(data?.shadeDirection) ? data.shadeDirection : IMAGE_SHADE_DEFAULTS.direction,
  };
}

const rgba = (hex, alpha) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;

/**
 * لایه‌ای که باید رندر شود، یا null وقتی شدت صفر است (یعنی هیچ لایه‌ای — همان
 * تصویرِ ساده). شدت در آلفای *رنگ‌ها* می‌نشیند، نه در opacityِ یک عنصر، پس نه
 * تصویر کم‌رنگ می‌شود نه متن و دکمه‌های رویش.
 */
export function imageShadeLayer(data) {
  const settings = imageShadeSettings(data);
  if (!settings.shade) return null;
  const alpha = settings.shade / 100;
  const background = settings.mode === "gradient"
    ? `linear-gradient(${settings.direction.replace("-", " ")}, ${rgba(settings.color, alpha)}, ${rgba(settings.color2, alpha)})`
    : rgba(settings.color, alpha);
  return { layer: settings.layer, background };
}

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
 * شدتِ لایه‌ی رنگ، عددِ صحیحِ ۰ تا ۱۰۰. ۰ (و هر مقدارِ نامعتبر) یعنی هیچ لایه‌ای
 * رندر نمی‌شود — پس تصویرِ موجود ذره‌ای عوض نمی‌شود.
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
