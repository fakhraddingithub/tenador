/**
 * src/lib/attributeFilters.js
 *
 * منطق فیلتر کردن محصولات بر اساس ویژگی‌های پویای دسته‌بندی (category.attributes).
 * مقادیر ویژگی‌ها روی product.attributes به صورت یک شیِ تخت ذخیره می‌شوند
 * (کلید = نام ویژگی، مثلِ "Color"، "Head Size"). این هلپر از همان داده‌ای که
 * در صفحه لود شده استفاده می‌کند تا فیلتر کاملاً کلاینت‌ساید و بدون رفت‌وبرگشت
 * اضافه به سرور انجام شود — هم‌راستا با فیلترهای موجود (برند/دسته/قیمت).
 *
 * همهٔ فیلترهای ویژگی به‌صورت «دکمه‌های انتخابی» هستند: گزینه‌ها از مقادیرِ
 * موجودِ بین محصولات ساخته می‌شوند، به‌جز ویژگیِ «رنگ» که از پالتِ ثابتِ ۱۶ رنگ
 * استفاده می‌کند و با منطقِ هیبریدیِ colorMatch تطبیق داده می‌شود.
 *
 * شکلِ وضعیتِ فیلتر: { [name]: [value, ...] } (دکمه‌ها؛ رنگ در فروشگاه تک‌انتخابی)،
 * و برای ویژگیِ عددی { [name]: { min, max } } — بازه، مثلِ قیمت (null = بدونِ کف/سقف).
 * ویژگی فقط وقتی عددی است که «همه‌ی» مقادیرش عددِ خالص باشند؛ یک حرف کافی است
 * تا دکمه‌ای بماند. فرمِ کمپین (exactValues) همچنان آرایه‌ی مقادیرِ دقیق می‌سازد،
 * و تطبیقِ آرایه روی ویژگیِ عددی همان «تطبیقِ دقیق» است.
 */

import {
  isColorAttribute,
  getSwatchByName,
  productColorMatchesSwatch,
} from "./colorMatch";
import { normalizeForCompare } from "./persianNormalize";

// مقدارِ عددیِ خالص → Number، وگرنه null (مثل "98"، "305"، "21.5"، «۳۰۵»).
// ارقامِ فارسی/عربی و ممیزِ «٫» عدد حساب می‌شوند (حرف نیستند)؛ هر حرف یا واحدی
// («305g»، «۲۷ سانت») یعنی متن.
export function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "")
    .trim()
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace("٫", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

const isNumericValue = (v) => toNumber(v) !== null;

/** آیا انتخابِ یک ویژگی، بازه‌ی عددی است؟ ({min, max}، نه آرایه) */
export const isRangeSelection = (sel) =>
  !!sel && typeof sel === "object" && !Array.isArray(sel);

const isActiveSelection = (sel) =>
  isRangeSelection(sel) ? sel.min != null || sel.max != null : Array.isArray(sel) && sel.length > 0;

// دامنه‌ی بازه + گامی که دقیقاً به همه‌ی مقادیر برسد (۲۱٫۵ → گامِ ۰٫۱).
function numberBounds(values) {
  const nums = values.map(toNumber);
  const decimals = Math.max(0, ...nums.map((n) => (String(n).split(".")[1] || "").length));
  return { min: Math.min(...nums), max: Math.max(...nums), step: 10 ** -decimals };
}

const TOKEN_SPLIT = /[\s,،؛\/\\|()]+/;

/**
 * از روی ویژگی‌های دسته + محصولاتِ همان صفحه، متادیتای فیلتر می‌سازد:
 * - فقط ویژگی‌هایی که ادمین در فرمِ دسته‌بندی «قابل فیلتر» (filterable) علامت زده
 *   وارد می‌شوند؛ بقیه نادیده گرفته می‌شوند. (لیست‌هایی که از getFilterableAttributes
 *   می‌آیند از قبل filterable:true دارند، پس همگی همین قرارداد را رعایت می‌کنند.)
 * - ویژگیِ «رنگ» همیشه به صورت type:"color" برمی‌گردد (پالتِ ثابت؛ گزینه نمی‌گیرد).
 * - ویژگی‌هایی که هیچ مقداری بین محصولات ندارند حذف می‌شوند (به‌جز رنگ).
 * - اگر همه‌ی مقادیر عددی باشند → type:"number" با min/max/step (برای بازه) و
 *   گزینه‌ها به‌ترتیبِ عددی (برای فرمِ کمپین و انتخابگرِ سفارش).
 * - در غیر این صورت → type:"text" با گزینه‌هایی شاملِ مقادیرِ کامل + توکن‌های
 *   جداشده (مثلاً از «مشکی/قرمز» هم «مشکی» و هم «قرمز»)، مرتب‌شده بر اساس فراوانی.
 */
export function buildAttributeMeta(categoryAttributes = [], products = []) {
  return (categoryAttributes || [])
    .filter((attr) => attr && attr.filterable) // فقط ویژگی‌های «قابل فیلتر»
    .map((attr) => {
      const name = attr.name;
      const label = attr.label || name;

      // رنگ: همیشه گرید سواچ — مستقل از مقادیرِ موجود.
      if (isColorAttribute(name)) {
        return { name, label, type: "color" };
      }

      const rawValues = products
        .map((p) => p?.attributes?.[name])
        .filter((v) => v != null && String(v).trim() !== "");

      if (rawValues.length === 0) return null;

      const allNumeric = rawValues.every(isNumericValue);

      const counts = new Map();
      const bump = (k) => counts.set(k, (counts.get(k) || 0) + 1);
      for (const v of rawValues) {
        const full = String(v).trim();
        bump(full);
        if (!allNumeric) {
          for (let tok of full.split(TOKEN_SPLIT)) {
            tok = tok.trim();
            if (tok.length >= 2 && tok !== full) bump(tok);
          }
        }
      }

      let entries = [...counts.entries()];
      if (allNumeric) {
        entries.sort((a, b) => toNumber(a[0]) - toNumber(b[0]));
      } else {
        entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"));
      }
      const options = entries
        .slice(0, 30)
        .map(([value, count]) => ({ value, count }));

      if (allNumeric) return { name, label, type: "number", ...numberBounds(rawValues), options };
      return { name, label, type: "text", options };
    })
    .filter(Boolean);
}

/**
 * وضعیت فیلتر را از روی query params می‌سازد (برای بازتولید نمای فیلترشده هنگام
 * باز شدن لینک). دکمه‌ها → کلیدهای تکراری (?Size=M&Size=L)، رنگ → فقط یک مقدار،
 * عددی → پسوندِ _min/_max. لینکِ قدیمیِ ?Weight=300 روی ویژگیِ عددی بازه‌ی
 * [کمینه، بیشینه]ِ همان مقادیر می‌شود. ورودی URLSearchParams یا ReadonlyURLSearchParams.
 */
export function parseAttrFiltersFromParams(searchParams, attrMeta = []) {
  const state = {};
  if (!searchParams) return state;
  for (const m of attrMeta) {
    const vals = searchParams.getAll(m.name).filter(Boolean);
    if (m.type === "number") {
      const legacy = vals.map(toNumber).filter((n) => n !== null);
      let min = toNumber(searchParams.get(`${m.name}_min`)) ?? (legacy.length ? Math.min(...legacy) : null);
      let max = toNumber(searchParams.get(`${m.name}_max`)) ?? (legacy.length ? Math.max(...legacy) : null);
      if (min != null && max != null && min > max) [min, max] = [max, min];
      if (min != null || max != null) state[m.name] = { min, max };
    } else if (vals.length) {
      state[m.name] = isColorAttribute(m.name) ? vals.slice(0, 1) : vals;
    }
  }
  return state;
}

/**
 * وضعیت فیلتر را روی یک URLSearchParams می‌نویسد (کلیدهای ویژگی‌ها را اول پاک
 * می‌کند تا پارامترهای غیرمرتبط مثل utm حفظ شوند)، پسوندهای _min/_max هم. بازه
 * با همان پسوندها نوشته می‌شود. همان شیِ params را برمی‌گرداند.
 */
export function writeAttrFiltersToParams(params, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    params.delete(m.name);
    params.delete(`${m.name}_min`);
    params.delete(`${m.name}_max`);
  }
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (isRangeSelection(sel)) {
      if (sel.min != null) params.set(`${m.name}_min`, String(sel.min));
      if (sel.max != null) params.set(`${m.name}_max`, String(sel.max));
    } else if (Array.isArray(sel) && sel.length) {
      for (const v of sel) params.append(m.name, v);
    }
  }
  return params;
}

/**
 * فیلترهای ویژگی را روی نوار آدرس می‌نویسد — همان قراردادِ صفحه‌ی دسته، حالا
 * مشترک با صفحه‌های برند+دسته و سری، تا یک لینکِ فیلترشده همه‌جا قابلِ اشتراک باشد.
 *
 * replaceState (نه router.push): داده‌ی این صفحه‌ها یا از قبل در حافظه است یا خودِ
 * کامپوننت آن را واکشی می‌کند، پس رفتن به سرور فقط یک رفت‌وبرگشتِ اضافه بود.
 * attrMeta باید «همه‌ی» ویژگی‌های ممکنِ صفحه باشد، نه فقط دیده‌شده‌ها، وگرنه
 * پارامترِ یک ویژگیِ پنهان‌شده در آدرس جا می‌ماند.
 */
export function syncAttrFiltersToUrl(attrFilters, attrMeta) {
  if (typeof window === "undefined") return;
  const params = writeAttrFiltersToParams(
    new URLSearchParams(window.location.search),
    attrFilters,
    attrMeta,
  );
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

/**
 * آیا محصول با فیلترهای ویژگی مطابقت دارد؟ (AND بین ویژگی‌ها، OR درون هر ویژگی)
 * - رنگ → تطبیقِ هیبریدیِ هر سواچِ انتخاب‌شده (متن + hue).
 * - بازه ({min,max}) → فقط روی ویژگیِ عددی، شاملِ دو سر؛ محصولِ بدونِ مقدارِ عددی حذف
 *   می‌شود. روی ویژگیِ غیرعددی (مثلاً پس از ادغامِ دسته‌ها) نادیده گرفته می‌شود.
 * - آرایه روی ویژگیِ عددی → تطبیقِ دقیق با یکی از مقادیر (قوانینِ کمپین).
 * - متنی → تطبیقِ substring بدون حساسیت به حروف (مثلاً «صورتی» در «صورتی کالباسی»).
 */
export function productMatchesAttrFilters(product, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (!isActiveSelection(sel)) continue;

    if (isRangeSelection(sel)) {
      if (m.type !== "number") continue;
      const n = toNumber(product?.attributes?.[m.name]);
      if (n === null) return false;
      if (sel.min != null && n < sel.min) return false;
      if (sel.max != null && n > sel.max) return false;
      continue;
    }

    if (isColorAttribute(m.name)) {
      const ok = sel.some((nm) =>
        productColorMatchesSwatch(product, getSwatchByName(nm)),
      );
      if (!ok) return false;
      continue;
    }

    const pv = product?.attributes?.[m.name];

    if (m.type === "number") {
      const pvs = String(pv ?? "").trim();
      if (!sel.some((v) => String(v).trim() === pvs)) return false;
    } else {
      const pvl = normalizeForCompare(String(pv ?? "")).toLowerCase();
      if (
        !sel.some((v) =>
          pvl.includes(normalizeForCompare(String(v)).toLowerCase()),
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * متادیتای فیلتر برای «ویژگی‌های واریانت» (مثل سایز گریپ، وزن، …) — مقادیر از
 * variant.attributes همه‌ی محصولاتِ لودشده جمع می‌شوند (کلاینت‌ساید، بدون درخواست
 * اضافه). برچسب‌ها از تعریفِ دسته (category.variantAttributes) خوانده می‌شوند و
 * ترتیبِ نمایش هم مطابق همان تعریف است؛ ویژگی‌های خارج از تعریف در انتها.
 * count = تعدادِ محصولاتی که آن مقدار را دارند (نه تعداد واریانت‌ها).
 */
export function buildVariantAttributeMeta(variantAttributeDefs = [], products = []) {
  const defs = Array.isArray(variantAttributeDefs) ? variantAttributeDefs : [];
  const labelByName = new Map(defs.map((a) => [a.name, a.label || a.name]));
  const orderByName = new Map(defs.map((a, i) => [a.name, i]));

  // name -> Map(value -> تعداد محصولات دارای آن مقدار)
  const counts = new Map();
  for (const p of products) {
    const seen = new Map(); // مقادیرِ یکتای هر ویژگی در همین محصول
    for (const v of p?.variants || []) {
      for (const [name, raw] of Object.entries(v?.attributes || {})) {
        const val = String(raw ?? "").trim();
        if (!val) continue;
        if (!seen.has(name)) seen.set(name, new Set());
        seen.get(name).add(val);
      }
    }
    for (const [name, vals] of seen) {
      if (!counts.has(name)) counts.set(name, new Map());
      const m = counts.get(name);
      for (const val of vals) m.set(val, (m.get(val) || 0) + 1);
    }
  }

  const meta = [];
  for (const [name, m] of counts) {
    let entries = [...m.entries()];
    const allNumeric = entries.every(([v]) => isNumericValue(v));
    if (allNumeric) {
      entries.sort((a, b) => toNumber(a[0]) - toNumber(b[0]));
    } else {
      entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"));
    }
    meta.push({
      name,
      label: labelByName.get(name) || name,
      type: allNumeric ? "number" : "text",
      options: entries.slice(0, 30).map(([value, count]) => ({ value, count })),
    });
  }

  meta.sort(
    (a, b) =>
      (orderByName.has(a.name) ? orderByName.get(a.name) : Number.MAX_SAFE_INTEGER) -
      (orderByName.has(b.name) ? orderByName.get(b.name) : Number.MAX_SAFE_INTEGER),
  );
  return meta;
}

/**
 * آیا محصول با فیلترهای ویژگیِ واریانت مطابقت دارد؟
 * منطق: یک واریانتِ واحد باید «همه‌ی» ویژگی‌های انتخاب‌شده را هم‌زمان داشته باشد
 * (AND بین ویژگی‌ها روی همان واریانت، OR درون هر ویژگی) — تا ترکیب‌های ناموجود
 * (مثلاً گریپ ۲ + قرمز که با هم در هیچ واریانتی نیستند) نمایش داده نشوند.
 */
export function productMatchesVariantAttrFilters(product, variantFilters = {}) {
  const active = Object.entries(variantFilters).filter(
    ([, sel]) => Array.isArray(sel) && sel.length > 0,
  );
  if (active.length === 0) return true;

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length === 0) return false;

  return variants.some((v) =>
    active.every(([name, sel]) => {
      const pv = String(v?.attributes?.[name] ?? "").trim();
      return sel.some((s) => String(s).trim() === pv);
    }),
  );
}

/** تعداد فیلترهای ویژگیِ فعال — برای بج شمارنده‌ی موبایل (هر بازه = ۱). */
export function countActiveAttrFilters(attrFilters = {}) {
  let n = 0;
  for (const sel of Object.values(attrFilters || {})) {
    if (Array.isArray(sel)) n += sel.length;
    else if (isActiveSelection(sel)) n += 1;
  }
  return n;
}

/**
 * متادیتای فیلترِ چند دسته را در یک لیستِ واحد ادغام می‌کند — برای صفحه‌هایی که
 * چند دسته هم‌زمان قابلِ انتخاب‌اند (سری). کلیدِ یکتایی «نامِ ویژگی» است: گزینه‌ها
 * یکی می‌شوند و شمارنده‌ها جمع؛ اگر نوعِ دو دسته یکی نباشد «متن» (عام‌ترین حالت)
 * برنده است. دامنه‌ی عددی اجتماعِ دامنه‌هاست. ترتیب و سقفِ ۳۰ گزینه همان
 * قراردادِ buildAttributeMeta است.
 */
export function mergeAttributeMeta(categories = []) {
  const byName = new Map();
  for (const category of categories) {
    for (const attr of category?.attributeMeta || []) {
      let entry = byName.get(attr.name);
      if (!entry) {
        entry = { name: attr.name, label: attr.label, type: attr.type, counts: new Map(), min: Infinity, max: -Infinity, step: Infinity };
        byName.set(attr.name, entry);
      }
      if (entry.type !== attr.type) entry.type = "text";
      if (attr.type === "number") {
        entry.min = Math.min(entry.min, attr.min);
        entry.max = Math.max(entry.max, attr.max);
        entry.step = Math.min(entry.step, attr.step);
      }
      for (const opt of attr.options || []) {
        entry.counts.set(opt.value, (entry.counts.get(opt.value) || 0) + (opt.count || 0));
      }
    }
  }
  return [...byName.values()].map(({ counts, min, max, step, ...meta }) => {
    if (meta.type === "color") return meta;
    const options = [...counts.entries()].map(([value, count]) => ({ value, count }));
    options.sort(
      meta.type === "number"
        ? (a, b) => toNumber(a.value) - toNumber(b.value)
        : (a, b) => b.count - a.count || a.value.localeCompare(b.value, "fa"),
    );
    const bounds = meta.type === "number" ? { min, max, step } : {};
    return { ...meta, ...bounds, options: options.slice(0, 30) };
  });
}
