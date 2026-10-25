/**
 * تصاویرِ واقعیِ یک ورزش، برند، سری یا دسته — منبعِ بلوکِ «آیکن و لوگو».
 *
 * هر فیلدِ تصویریِ مدل اینجا یک بار با برچسبش آمده است؛ هیچ فهرستِ ثابتی از
 * تصویرها وجود ندارد. فیلدِ تازه‌ای که به یکی از این مدل‌ها اضافه شود فقط باید
 * در ENTITY_IMAGE_SOURCES هم بیاید تا در انتخابگر دیده شود.
 *
 *   sport    icon · image
 *   brand    logo · icon · monochromeLogo · image
 *   serie    logo · headImage · image · sportImages[].image / .headImage (برای هر ورزش)
 *   category icon · image · customTab.icon · customTab.items[].image
 *
 * فقط داده است (بی‌وابستگی به پایگاه‌داده)، پس هم در route و هم در تست مصرف می‌شود.
 */
export const ENTITY_IMAGE_SOURCES = {
  sport: { label: "ورزش", fields: [["icon", "آیکن"], ["image", "تصویر"]] },
  brand: { label: "برند", fields: [["logo", "لوگو"], ["icon", "آیکن"], ["monochromeLogo", "لوگوی تک‌رنگ"], ["image", "تصویر"]] },
  serie: { label: "سری", fields: [["logo", "لوگو"], ["headImage", "تصویرِ سربرگ"], ["image", "تصویر"]] },
  category: { label: "دسته", fields: [["icon", "آیکن"], ["image", "تصویر"]] },
};

export const ENTITY_IMAGE_TYPES = Object.keys(ENTITY_IMAGE_SOURCES);

/** «brand:<id>» ↔ { type, id } — شناسه‌ی منبع در داده‌ی بلوک و در جستجو. */
export function parseImageSource(value) {
  const match = /^([a-z]+):([a-f\d]{24})$/i.exec(String(value ?? ""));
  return match && ENTITY_IMAGE_SOURCES[match[1]] ? { type: match[1], id: match[2].toLowerCase() } : null;
}

const filled = (value) => typeof value === "string" && value.trim() !== "";

/**
 * تصاویرِ یک سند → [{ key, label, url }]. خالی‌ها کنار می‌روند و یک آدرس فقط یک بار
 * می‌آید (برندی که لوگو و آیکنش یک فایل است دو گزینه‌ی یکسان نشان نمی‌دهد).
 * sportImages[].sport اگر populate شده باشد نامِ ورزش در برچسب می‌آید.
 */
export function entityImageOptions(type, doc) {
  const source = ENTITY_IMAGE_SOURCES[type];
  if (!source || !doc) return [];
  const options = source.fields.map(([key, label]) => ({ key, label, url: doc[key] }));
  if (type === "serie") {
    (doc.sportImages || []).forEach((entry, index) => {
      const sport = entry?.sport?.title || entry?.sport?.name || `ورزشِ ${index + 1}`;
      options.push({ key: `sportImages.${index}.image`, label: `تصویر — ${sport}`, url: entry?.image });
      options.push({ key: `sportImages.${index}.headImage`, label: `تصویرِ سربرگ — ${sport}`, url: entry?.headImage });
    });
  }
  if (type === "category") {
    options.push({ key: "customTab.icon", label: "آیکنِ تبِ سفارشی", url: doc.customTab?.icon });
    (doc.customTab?.items || []).forEach((item, index) => {
      options.push({ key: `customTab.items.${index}.image`, label: `تبِ سفارشی — ${item?.title || index + 1}`, url: item?.image });
    });
  }
  const seen = new Set();
  return options.filter((option) => {
    if (!filled(option.url)) return false;
    const url = option.url.trim();
    if (seen.has(url)) return false;
    seen.add(url);
    option.url = url;
    return true;
  });
}

/** اندازه‌ها و پیش‌فرض‌های بلوک — مشترکِ registry، validator و رندر. */
export const ICON_LOGO_SIZE = { min: 16, max: 800, default: 120 };
export const ICON_LOGO_RADIUS = { min: 0, max: 200, default: 6 };
export const ICON_LOGO_PADDING = { min: 0, max: 120, default: 24 };
// زمینه‌ی پیش‌فرض: همان لایه‌ی رنگِ بلوکِ تصویر، خاکستریِ خیلی روشن و کامل.
export const ICON_LOGO_BACKGROUND = { shade: 100, shadeColor: "#f4f4f5", shadeColor2: "#ffffff" };

/**
 * کادرِ تصویرِ «آیکن و لوگو» — فقط از تنظیماتِ بلوک، هرگز از ابعادِ خودِ فایل.
 * بی‌ارتفاع («حفظِ نسبت») یعنی کادرِ مربعِ عرض×عرض؛ با ارتفاع، عرض×ارتفاع. تصویر در
 * هر دو حالت با contain داخلِ کادر می‌نشیند، پس نسبتِ خودش هم هرگز به‌هم نمی‌خورد.
 * دو بلوک با تنظیماتِ یکسان، هر تصویری که داشته باشند، کادرِ یکسان دارند.
 */
export function iconLogoBox(data) {
  const width = data?.width || ICON_LOGO_SIZE.default;
  return { width, height: data?.height || width };
}
