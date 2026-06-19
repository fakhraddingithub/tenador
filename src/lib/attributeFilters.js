/**
 * src/lib/attributeFilters.js
 *
 * منطق فیلتر کردن محصولات بر اساس ویژگی‌های پویای دسته‌بندی (category.attributes).
 * مقادیر ویژگی‌ها روی product.attributes به صورت یک شیِ تخت ذخیره می‌شوند
 * (کلید = نام ویژگی، مثلِ "Color"، "Head Size"). این هلپر از همان داده‌ای که
 * در صفحه لود شده استفاده می‌کند تا فیلتر کاملاً کلاینت‌ساید و بدون رفت‌وبرگشت
 * اضافه به سرور انجام شود — هم‌راستا با فیلترهای موجود (برند/دسته/قیمت).
 *
 * تطبیق متن = «شاملِ» (substring) و حساس‌نبودن به بزرگی/کوچکی حروف، تا
 * مثلاً color=صورتی محصولی با رنگ «صورتی کالباسی» را هم بیاورد.
 */

// آیا یک مقدار، یک عددِ خالص است؟ (مثل "98"، "305"، "21.5")
function isNumericValue(v) {
  const s = String(v).trim();
  return s !== "" && /^-?\d+(\.\d+)?$/.test(s);
}

const TOKEN_SPLIT = /[\s,،؛\/\\|()]+/;

/**
 * از روی ویژگی‌های دسته + محصولاتِ همان صفحه، متادیتای فیلتر می‌سازد:
 * - ویژگی‌هایی که هیچ مقداری بین محصولات ندارند حذف می‌شوند.
 * - اگر همه‌ی مقادیر عددی باشند → type:"number" با min/max واقعی.
 * - در غیر این صورت → type:"text" با گزینه‌هایی شاملِ مقادیرِ کامل + توکن‌های
 *   جداشده (مثلاً از «مشکی/قرمز» هم «مشکی» و هم «قرمز» به‌عنوان گزینه می‌آید)،
 *   مرتب‌شده بر اساس فراوانی.
 */
export function buildAttributeMeta(categoryAttributes = [], products = []) {
  return (categoryAttributes || [])
    .map((attr) => {
      const name = attr.name;
      const label = attr.label || name;

      const rawValues = products
        .map((p) => p?.attributes?.[name])
        .filter((v) => v != null && String(v).trim() !== "");

      if (rawValues.length === 0) return null;

      const allNumeric = rawValues.every(isNumericValue);
      if (allNumeric) {
        const nums = rawValues.map(Number);
        return {
          name,
          label,
          type: "number",
          min: Math.min(...nums),
          max: Math.max(...nums),
        };
      }

      const counts = new Map();
      const bump = (k) => counts.set(k, (counts.get(k) || 0) + 1);
      for (const v of rawValues) {
        const full = String(v).trim();
        bump(full);
        for (let tok of full.split(TOKEN_SPLIT)) {
          tok = tok.trim();
          if (tok.length >= 2 && tok !== full) bump(tok);
        }
      }

      const options = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fa"))
        .slice(0, 25)
        .map(([value, count]) => ({ value, count }));

      return { name, label, type: "text", options };
    })
    .filter(Boolean);
}

/**
 * وضعیت فیلتر را از روی query params می‌سازد (برای بازتولید نمای فیلترشده هنگام
 * باز شدن لینک). text → کلیدهای تکراری (?Color=قرمز&Color=آبی)، number → پسوندِ
 * _min/_max. ورودی می‌تواند URLSearchParams یا ReadonlyURLSearchParams باشد.
 */
export function parseAttrFiltersFromParams(searchParams, attrMeta = []) {
  const state = {};
  if (!searchParams) return state;

  for (const m of attrMeta) {
    if (m.type === "number") {
      const mn = searchParams.get(`${m.name}_min`);
      const mx = searchParams.get(`${m.name}_max`);
      if (mn != null || mx != null) {
        state[m.name] = {
          min: mn != null && mn !== "" ? Number(mn) : null,
          max: mx != null && mx !== "" ? Number(mx) : null,
        };
      }
    } else {
      const vals = searchParams.getAll(m.name).filter(Boolean);
      if (vals.length) state[m.name] = vals;
    }
  }
  return state;
}

/**
 * وضعیت فیلتر را روی یک URLSearchParams می‌نویسد (کلیدهای ویژگی‌ها را اول پاک
 * می‌کند تا پارامترهای غیرمرتبط مثل utm حفظ شوند). همان شیِ params را برمی‌گرداند.
 */
export function writeAttrFiltersToParams(params, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    params.delete(m.name);
    params.delete(`${m.name}_min`);
    params.delete(`${m.name}_max`);
  }
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (!sel) continue;
    if (m.type === "number") {
      if (sel.min != null) params.set(`${m.name}_min`, String(sel.min));
      if (sel.max != null) params.set(`${m.name}_max`, String(sel.max));
    } else if (Array.isArray(sel) && sel.length) {
      for (const v of sel) params.append(m.name, v);
    }
  }
  return params;
}

/**
 * آیا محصول با فیلترهای ویژگی مطابقت دارد؟ (AND بین ویژگی‌ها، OR درون هر ویژگی)
 * text = تطبیق substring بدون حساسیت به حروف؛ number = داخل بازه‌ی [min,max].
 */
export function productMatchesAttrFilters(product, attrFilters = {}, attrMeta = []) {
  for (const m of attrMeta) {
    const sel = attrFilters[m.name];
    if (!sel) continue;

    const pv = product?.attributes?.[m.name];

    if (m.type === "number") {
      const n = pv != null ? Number(pv) : NaN;
      if (Number.isNaN(n)) return false;
      if (sel.min != null && n < sel.min) return false;
      if (sel.max != null && n > sel.max) return false;
    } else {
      if (!Array.isArray(sel) || sel.length === 0) continue;
      const pvl = String(pv ?? "").toLowerCase();
      const ok = sel.some((val) => pvl.includes(String(val).toLowerCase()));
      if (!ok) return false;
    }
  }
  return true;
}

/** تعداد فیلترهای ویژگیِ فعال — برای بج شمارنده‌ی موبایل. */
export function countActiveAttrFilters(attrFilters = {}) {
  let n = 0;
  for (const sel of Object.values(attrFilters)) {
    if (Array.isArray(sel)) n += sel.length;
    else if (sel && (sel.min != null || sel.max != null)) n += 1;
  }
  return n;
}
