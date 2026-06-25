/**
 * src/lib/variantImages.js
 *
 * حل‌وفصلِ تصاویرِ واریانت با پشتیبانی از «تصاویر سطحِ مقدار» (Change 2).
 *
 * تصاویر می‌توانند در دو جا تعریف شوند:
 *   ۱) سطحِ مقدار  → product.variantMeta[attrName][value].images
 *      (مثلاً ۲ عکس برای رنگ «قرمز» که بین همه‌ی واریانت‌های قرمز مشترک است)
 *   ۲) سطحِ واریانت → variant.images  (رفتار قدیمی، همچنان پشتیبانی می‌شود)
 *
 * این توابع هر دو منبع را با هم ترکیب و یکتاسازی (dedupe) می‌کنند تا گالریِ صفحه
 * محصول به‌جای ۱۰ کپی، فقط ۲ تصویرِ یکتا را نشان دهد.
 *
 * نکته: هیچ‌کدام از این توابع به دیتابیس وابسته نیستند؛ روی آبجکتِ محصول/واریانتِ
 * lean یا hydrate شده کار می‌کنند (variant.attributes می‌تواند Map یا Object باشد).
 */

function dedupe(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// attributes یک واریانت را به‌صورت Object برمی‌گرداند (Map یا Object هر دو پشتیبانی می‌شوند)
function variantAttrsToObject(variant) {
  const a = variant?.attributes;
  if (!a) return {};
  return a instanceof Map ? Object.fromEntries(a) : a;
}

// تصاویرِ تعریف‌شده برای یک مقدار مشخص از یک ویژگی
export function valueImages(product, attrName, value) {
  const imgs = product?.variantMeta?.[attrName]?.[value]?.images;
  return Array.isArray(imgs) ? imgs.filter(Boolean) : [];
}

/**
 * سوآچ‌های تصویریِ سطحِ مقدار برای نمایش روی کارتِ محصول (Change 2/4): برای هر
 * مقداری که در variantMeta تصویر دارد یک سوآچ (اولین تصویرش) برمی‌گرداند.
 *   [{ key: 'color=قرمز', attr: 'color', value: 'قرمز', image: '...' }]
 * اگر هیچ تصویرِ سطحِ مقداری نبود، فراخواننده می‌تواند به variant.images (رفتار
 * قدیمی) برگردد.
 */
export function valueImageSwatches(product) {
  const meta = product?.variantMeta || {};
  const out = [];
  for (const [attr, values] of Object.entries(meta)) {
    for (const [value, data] of Object.entries(values || {})) {
      const img = Array.isArray(data?.images) ? data.images.filter(Boolean)[0] : null;
      if (img) out.push({ key: `${attr}=${value}`, attr, value, image: img });
    }
  }
  return out;
}

/**
 * در دسترس بودنِ یک مقدار با توجه به انتخابِ جاری (cascade filtering, Bug 2):
 * مقدار «در دسترس» است اگر دستِ‌کم یک واریانت وجود داشته باشد که آن مقدار را برای
 * این ویژگی داشته باشد و با همه‌ی ویژگی‌های *دیگرِ* انتخاب‌شده هم‌خوان باشد.
 * انتخابِ خودِ همین ویژگی نادیده گرفته می‌شود تا کاربر بتواند آزادانه عوضش کند.
 * برای ۲+ ویژگی هم درست کار می‌کند و به API اضافی نیازی ندارد.
 */
export function valueAvailable(variants, optionKeys, selection, attrKey, value) {
  return (variants || []).some((variant) => {
    const attrs = variantAttrsToObject(variant);
    if (attrs[attrKey] !== value) return false;
    for (const k of optionKeys) {
      if (k === attrKey) continue;
      const sel = selection?.[k];
      if (sel != null && sel !== "" && attrs[k] !== sel) return false;
    }
    return true;
  });
}

// همه‌ی تصاویرِ سطحِ مقدار در کل محصول (یکتا)
export function allValueImages(product) {
  const meta = product?.variantMeta || {};
  const out = [];
  for (const attr of Object.values(meta)) {
    for (const val of Object.values(attr || {})) {
      if (Array.isArray(val?.images)) out.push(...val.images.filter(Boolean));
    }
  }
  return dedupe(out);
}

// ── چندواحدی (Change 3) ───────────────────────────────────────────────────

// واحدهای یک ویژگیِ چندواحدی (از تعریفِ دسته‌بندی)؛ برای ویژگی‌های معمولی [] برمی‌گرداند
export function attrUnits(product, attrName) {
  const defs = product?.category?.variantAttributes || [];
  const def = defs.find((a) => a.name === attrName);
  return def?.multiUnit && Array.isArray(def.units) ? def.units.filter(Boolean) : [];
}

// مقدارِ یک value در واحدِ مشخص؛ اگر نبود به مقدارِ اصلی (primary) برمی‌گردد
export function unitValue(product, attrName, value, unit) {
  const units = product?.variantMeta?.[attrName]?.[value]?.units;
  return units && unit && units[unit] ? units[unit] : value;
}

// همه‌ی مقادیرِ واحدهای یک value: { EU: '42', 'سانتی‌متر': '26.5' } یا null
export function valueUnits(product, attrName, value) {
  const units = product?.variantMeta?.[attrName]?.[value]?.units;
  return units && Object.keys(units).length ? units : null;
}

/**
 * اسنپ‌شاتِ نمایشیِ واریانت برای ذخیره در سفارش (Change 5).
 * مستقل از زنده‌بودنِ واریانت یا دسته‌بندی است؛ پس از حذف/بازسازیِ واریانت‌ها هم
 * نمایشِ سفارش درست می‌ماند و شاملِ تصویر (image-based) و مقادیرِ چندواحدی است.
 *   [{ name, label, value, image?, units? }]
 *
 * product باید category.variantAttributes (برای label) و variantMeta را داشته باشد.
 */
export function buildVariantSnapshot(variant, product) {
  if (!variant) return [];
  const attrs = variantAttrsToObject(variant);
  const defs = product?.category?.variantAttributes || [];
  const labelOf = (name) => defs.find((d) => d.name === name)?.label || name;

  const out = [];
  for (const [name, value] of Object.entries(attrs)) {
    const entry = { name, label: labelOf(name), value };
    const img = valueImages(product, name, value)[0];
    if (img) entry.image = img;
    const units = valueUnits(product, name, value);
    if (units) entry.units = units;
    out.push(entry);
  }
  return out;
}

// نگاشتِ «ویژگی → مقادیرِ واحدها» برای یک واریانت (برای سبد/سفارش)
export function variantAttributeUnits(variant, product) {
  const attrs = variantAttrsToObject(variant);
  const out = {};
  for (const [attr, value] of Object.entries(attrs)) {
    const units = valueUnits(product, attr, value);
    if (units) out[attr] = units;
  }
  return out;
}

// تصاویرِ مربوط به انتخابِ جاری (ممکن است ناقص باشد، مثلاً فقط رنگ انتخاب شده)
export function selectionImages(product, selection = {}) {
  const out = [];
  for (const [attr, value] of Object.entries(selection || {})) {
    out.push(...valueImages(product, attr, value));
  }
  return dedupe(out);
}

/**
 * نگاشتِ «ویژگی → تصویرِ نماینده» برای یک واریانت: فقط ویژگی‌هایی که مقدارشان
 * تصویرِ سطحِ مقدار دارد. برای نمایشِ thumbnail در سبد/سفارش (Change 4) به کار می‌رود.
 *   { color: 'red1.jpg' }
 */
export function variantAttributeImages(variant, product) {
  const attrs = variantAttrsToObject(variant);
  const out = {};
  for (const [attr, value] of Object.entries(attrs)) {
    const imgs = valueImages(product, attr, value);
    if (imgs.length) out[attr] = imgs[0];
  }
  return out;
}

// تصاویرِ مؤثرِ یک واریانت: ترکیبِ تصاویرِ سطحِ مقدارِ ویژگی‌هایش + تصاویرِ خودِ واریانت
export function resolveVariantImages(variant, product) {
  const attrs = variantAttrsToObject(variant);
  const out = [];
  for (const [attr, value] of Object.entries(attrs)) {
    out.push(...valueImages(product, attr, value));
  }
  if (Array.isArray(variant?.images)) out.push(...variant.images.filter(Boolean));
  return dedupe(out);
}

/**
 * گالریِ نهاییِ صفحه محصول/کوییک‌ویو را می‌سازد.
 *  - اگر تصویرِ سطحِ مقدار یا واریانت وجود داشته باشد، mainImage از ابتدای گالری
 *    کنار گذاشته می‌شود (هم‌رفتار با منطقِ قبلی) تا گالری با تصاویرِ واقعیِ واریانت‌ها شروع شود.
 *  - تصاویرِ مقادیرِ انتخاب‌شده (selection) ابتدای گالری می‌آیند تا با انتخاب رنگ،
 *    گالری همان رنگ را نشان دهد.
 *  - همه‌چیز یکتاسازی می‌شود (رفعِ تکرارِ ۱۰→۲).
 */
export function buildGalleryImages(product, selection = {}) {
  if (!product) return [];
  const variants = product.variants || [];
  const metaImages = allValueImages(product);
  const variantImages = variants.flatMap((v) => v.images || []).filter(Boolean);
  const hasExtra = metaImages.length > 0 || variantImages.length > 0;

  const base = [
    ...(!hasExtra ? [product.mainImage] : []),
    ...(product.gallery || []),
  ].filter(Boolean);

  const pool = dedupe([...base, ...metaImages, ...variantImages]);

  const priority = selectionImages(product, selection);
  return priority.length ? dedupe([...priority, ...pool]) : pool;
}
