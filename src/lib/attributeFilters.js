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
 * شکلِ وضعیتِ فیلتر همه‌جا یکسان است: { [name]: [value, ...] } (چندانتخابی).
 */

import {
  isColorAttribute,
  getSwatchByName,
  productColorMatchesSwatch,
} from "./colorMatch";
import { normalizeForCompare } from "./persianNormalize";

// آیا یک مقدار، یک عددِ خالص است؟ (مثل "98"، "305"، "21.5")
function isNumericValue(v) {
  const s = String(v).trim();
  return s !== "" && /^-?\d+(\.\d+)?$/.test(s);
}

const TOKEN_SPLIT = /[\s,،؛\/\\|()]+/;

/**
 * از روی ویژگی‌های دسته + محصولاتِ همان صفحه، متادیتای فیلتر می‌سازد:
 * - فقط ویژگی‌هایی که ادمین در فرمِ دسته‌بندی «قابل فیلتر» (filterable) علامت زده
 *   وارد می‌شوند؛ بقیه نادیده گرفته می‌شوند. (لیست‌هایی که از getFilterableAttributes
 *   می‌آیند از قبل filterable:true دارند، پس همگی همین قرارداد را رعایت می‌کنند.)
 * - ویژگیِ «رنگ» همیشه به صورت type:"color" برمی‌گردد (پالتِ ثابت؛ گزینه نمی‌گیرد).
 * - ویژگی‌هایی که هیچ مقداری بین محصولات ندارند حذف می‌شوند (به‌جز رنگ).
 * - اگر همه‌ی مقادیر عددی باشند → type:"number" و گزینه‌ها به‌ترتیبِ عددی.
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
        entries.sort((a, b) => Number(a[0]) - Number(b[0]));
      } else {
        entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"));
      }
      const options = entries
        .slice(0, 30)
        .map(([value, count]) => ({ value, count }));

      return { name, label, type: allNumeric ? "number" : "text", options };
    })
    .filter(Boolean);
}

/**
 * وضعیت فیلتر را از روی query params می‌سازد (برای بازتولید نمای فیلترشده هنگام
 * باز شدن لینک). همهٔ ویژگی‌ها چندانتخابی‌اند → کلیدهای تکراری (?Color=قرمز&Color=آبی).
 * ورودی می‌تواند URLSearchParams یا ReadonlyURLSearchParams باشد.
 */
export function parseAttrFiltersFromParams(searchParams, attrMeta = []) {
  const state = {};
  if (!searchParams) return state;
  for (const m of attrMeta) {
    const vals = searchParams.getAll(m.name).filter(Boolean);
    if (vals.length) state[m.name] = vals;
  }
  return state;
}

/**
 * وضعیت فیلتر را روی یک URLSearchParams می‌نویسد (کلیدهای ویژگی‌ها را اول پاک
 * می‌کند تا پارامترهای غیرمرتبط مثل utm حفظ شوند). پسوندهای قدیمیِ _min/_max نیز
 * پاک می‌شوند تا لینک‌های قدیمی باقی نمانند. همان شیِ params را برمی‌گرداند.
 */
export function writeAttrFiltersToParams(params, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    params.delete(m.name);
    params.delete(`${m.name}_min`);
    params.delete(`${m.name}_max`);
  }
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (Array.isArray(sel) && sel.length) {
      for (const v of sel) params.append(m.name, v);
    }
  }
  return params;
}

/**
 * آیا محصول با فیلترهای ویژگی مطابقت دارد؟ (AND بین ویژگی‌ها، OR درون هر ویژگی)
 * - رنگ → تطبیقِ هیبریدیِ هر سواچِ انتخاب‌شده (متن + hue).
 * - عددی → تطبیقِ دقیق با یکی از مقادیرِ انتخاب‌شده.
 * - متنی → تطبیقِ substring بدون حساسیت به حروف (مثلاً «صورتی» در «صورتی کالباسی»).
 */
export function productMatchesAttrFilters(product, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (!Array.isArray(sel) || sel.length === 0) continue;

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
      entries.sort((a, b) => Number(a[0]) - Number(b[0]));
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

/** تعداد فیلترهای ویژگیِ فعال — برای بج شمارنده‌ی موبایل. */
export function countActiveAttrFilters(attrFilters = {}) {
  let n = 0;
  for (const sel of Object.values(attrFilters)) {
    if (Array.isArray(sel)) n += sel.length;
  }
  return n;
}
