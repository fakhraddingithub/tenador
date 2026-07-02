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

/** تعداد فیلترهای ویژگیِ فعال — برای بج شمارنده‌ی موبایل. */
export function countActiveAttrFilters(attrFilters = {}) {
  let n = 0;
  for (const sel of Object.values(attrFilters)) {
    if (Array.isArray(sel)) n += sel.length;
  }
  return n;
}
