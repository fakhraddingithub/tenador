/**
 * src/lib/customTabTexts.js  (pure — no DB, no network)
 *
 * عنوان و توضیحاتی که AI برای هر آیتمِ انتخاب‌شده‌ی تب سفارشی، مخصوصِ همان محصول می‌نویسد.
 *
 *   خروجیِ AI و payloadِ فرم‌ها:  customTabTitles / customTabDescriptions
 *                                { "<عنوانِ دقیقِ آیتم در دسته>": "<متن>" }
 *   ذخیره روی محصول:              Product.customTabTexts = [{ item: <_idِ آیتم>, title, description }]
 *
 * با شناسه‌ی آیتم ذخیره می‌شود، نه با عنوان: تغییرِ نامِ آیتم در دسته متنِ محصول را از بین نمی‌برد.
 * متنِ خالی یعنی «ساخته نشده»؛ صفحه‌ی محصول برای همان بخش متنِ دستیِ آیتم را نشان می‌دهد.
 * همه‌ی مسیرهای نوشتن (ساخت، ویرایش، بازتولید) و خواندن (فرمِ ویرایش، صفحه‌ی محصول) از این فایل می‌گذرند.
 */

export const CUSTOM_TAB_TEXT_LIMITS = { title: 200, description: 3000 };

const LIMIT_OF = { customTabTitles: CUSTOM_TAB_TEXT_LIMITS.title, customTabDescriptions: CUSTOM_TAB_TEXT_LIMITS.description };
const NOUN_OF = { customTabTitles: "عنوان", customTabDescriptions: "توضیحات" };

const idOf = (v) => (v == null ? "" : String(v?._id ?? v));
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * نقشه‌ی { عنوانِ آیتم: متن } را بررسی و trim می‌کند.
 * `undefined` = «این درخواست درباره‌ی این بخش نیست» و همان‌طور می‌ماند؛ null / "" = خالی ({}).
 * @returns {{value: Record<string,string>|undefined}|{error: string}}
 */
export function checkTextMap(value, field) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: {} };
  const noun = NOUN_OF[field] || "متن";
  if (!isPlainObject(value)) return { error: `${noun}ِ آیتم‌های تب اختصاصی باید یک شیء { عنوانِ آیتم: متن } باشد` };
  const limit = LIMIT_OF[field] ?? CUSTOM_TAB_TEXT_LIMITS.description;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null) { out[key] = ""; continue; }
    if (typeof raw !== "string") return { error: `${noun}ِ آیتمِ «${key}» باید متن باشد` };
    const text = raw.trim();
    if (text.length > limit) return { error: `${noun}ِ آیتمِ «${key}» بیش از ${limit} نویسه است` };
    out[key] = text;
  }
  return { value: out };
}

/** کلیدهایی که عنوانِ هیچ آیتمی از دسته نیستند. */
export function unknownTextKeys(items, map) {
  if (!isPlainObject(map)) return [];
  const titles = new Set((items || []).map((it) => it.title));
  return Object.keys(map).filter((key) => !titles.has(key));
}

/**
 * متن‌های ذخیره‌شدنی برای آیتم‌های انتخاب‌شده، به ترتیبِ انتخاب.
 * نقشه‌ای که نیامده (`undefined`) متنِ ذخیره‌شده‌ی همان بخش را نگه می‌دارد؛ `{}` پاکش می‌کند.
 * آیتمِ انتخاب‌نشده و آیتمی که هر دو متنش خالی است ذخیره نمی‌شود.
 */
export function mergeCustomTabTexts({ items = [], selectedIds = [], existing = [], titles, descriptions }) {
  const byId = new Map((items || []).map((it) => [idOf(it._id), it]));
  const stored = new Map((existing || []).map((t) => [idOf(t.item), t]));
  const seen = new Set();
  const out = [];
  for (const raw of selectedIds || []) {
    const id = idOf(raw);
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    seen.add(id);
    const prev = stored.get(id);
    const title = titles === undefined ? prev?.title || "" : String(titles[item.title] ?? "").trim();
    const description = descriptions === undefined ? prev?.description || "" : String(descriptions[item.title] ?? "").trim();
    if (title || description) out.push({ item: id, title, description });
  }
  return out;
}

/** متن‌های ذخیره‌شده → دو نقشه با عنوانِ *فعلیِ* آیتم‌ها (برای فرمِ ویرایش و بازتولید). */
export function customTabTextMaps(items, texts) {
  const byId = new Map((items || []).map((it) => [idOf(it._id), it]));
  const customTabTitles = {};
  const customTabDescriptions = {};
  for (const t of texts || []) {
    const item = byId.get(idOf(t.item));
    if (!item) continue;
    if (t.title) customTabTitles[item.title] = t.title;
    if (t.description) customTabDescriptions[item.title] = t.description;
  }
  return { customTabTitles, customTabDescriptions };
}

/**
 * آنچه صفحه‌ی محصول نشان می‌دهد: آیتم‌های انتخاب‌شده به ترتیبِ دسته. عنوان و توضیحات هر کدام
 * جدا: متنِ ساخته‌شده برای محصول، وگرنه متنِ دستیِ آیتم.
 */
export function resolveCustomTabItems(customTab, selectedIds = [], texts = []) {
  if (!customTab?.enabled || !Array.isArray(customTab.items)) return [];
  const selected = new Set((selectedIds || []).filter(Boolean).map(idOf));
  const byItem = new Map((texts || []).map((t) => [idOf(t.item), t]));
  return customTab.items
    .filter((item) => selected.has(idOf(item._id)))
    .map((item) => {
      const text = byItem.get(idOf(item._id));
      return {
        ...item,
        title: text?.title || item.title,
        description: text?.description || item.description,
      };
    });
}
