/**
 * src/lib/variantValueOps.js
 *
 * عملیاتِ ویرایشِ «مقادیرِ واریانت» در فرم‌های ساخت/ویرایشِ محصول:
 *   - تغییرِ نامِ یک مقدار (rename)  — مثلاً «قرمز» → «قرمزِ آجری»
 *   - جابه‌جایی (reorder)           — کشیدن‌ورها کردنِ ترتیبِ مقادیر
 *
 * چرا اینجا و نه در خودِ فرم؟ منطقِ rename باید هم‌زمان چند استیت را هماهنگ نگه دارد
 * (variantOptions, variantMeta و ساختارهای کلید-ترکیبی) و در هر دو فرم یکسان است؛
 * پس یک‌بار به‌صورتِ تابعِ خالص نوشته می‌شود تا دو نسخه از هم واگرا نشوند.
 *
 * نکته‌ی کلیدی درباره‌ی ترتیب: ترتیبِ نمایشِ مقادیر در صفحه‌ی محصول از ترتیبِ
 * آرایه‌ی variantOptions[attr] مشتق می‌شود (واریانت‌ها به همان ترتیبِ کارتزینی
 * ساخته و ذخیره می‌شوند و صفحه‌ی محصول با «اولین ظهور» گروه‌بندی می‌کند). بنابراین
 * تنها کافی است آرایه را مرتب/ویرایش کنیم؛ نیازی به فیلدِ ترتیبِ جداگانه در دیتابیس نیست.
 *
 * makeComboKey کلید را بر اساسِ «نامِ ویژگی» مرتب می‌کند، نه مقدار؛ پس جابه‌جایی
 * مقادیر هیچ کلیدِ ترکیبی را عوض نمی‌کند و فقط rename نیاز به مهاجرتِ کلید دارد.
 */

import { makeComboKey } from "./variantKey";

/** یک comboKey (خروجی makeComboKey) را به آبجکتِ ترکیب برمی‌گرداند. */
function parseComboKey(key) {
  const combo = {};
  if (!key) return combo;
  for (const pair of key.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1));
    combo[k] = v;
  }
  return combo;
}

/** آبجکتی که کلیدهایش comboKey هستند را برای یک rename مهاجرت می‌دهد. */
function remapComboKeyedObject(obj = {}, attrName, oldVal, newVal) {
  const next = {};
  for (const [key, entry] of Object.entries(obj)) {
    const combo = parseComboKey(key);
    if (combo[attrName] === oldVal) combo[attrName] = newVal;
    next[makeComboKey(combo)] = entry;
  }
  return next;
}

/** مجموعه‌ای که اعضایش comboKey هستند را برای یک rename مهاجرت می‌دهد. */
function remapComboKeyedSet(set, attrName, oldVal, newVal) {
  const next = new Set();
  for (const key of set) {
    const combo = parseComboKey(key);
    if (combo[attrName] === oldVal) combo[attrName] = newVal;
    next.add(makeComboKey(combo));
  }
  return next;
}

/**
 * تغییرِ نامِ یک مقدارِ واریانت، با حفظِ ترتیب و انتقالِ همه‌ی متادیتای وابسته.
 *
 * ورودی، تصویری از استیت‌های مرتبطِ فرم است؛ خروجی، نسخه‌ی مهاجرت‌یافته‌ی همان‌ها.
 * فراخوان مسئولِ اعتبارسنجی (خالی‌نبودن، تکراری‌نبودن) پیش از صداکردنِ این تابع است.
 *
 * @returns {{ variantOptions, variantMeta, variantDetails, deselectedCombos, expandedPrices }}
 */
export function renameVariantValue({
  attrName,
  oldVal,
  newVal,
  variantOptions = {},
  variantMeta = {},
  variantDetails = {},
  deselectedCombos = new Set(),
  expandedPrices = new Set(),
}) {
  // آرایه‌ی مقادیر: جایگزینیِ درجا (ترتیب حفظ می‌شود)
  const values = variantOptions[attrName] || [];
  const newVariantOptions = {
    ...variantOptions,
    [attrName]: values.map((v) => (v === oldVal ? newVal : v)),
  };

  // variantMeta: انتقالِ ورودیِ مقدار (تصاویر/واحدها) از کلیدِ قدیمی به جدید
  let newVariantMeta = variantMeta;
  if (variantMeta[attrName] && Object.prototype.hasOwnProperty.call(variantMeta[attrName], oldVal)) {
    const attrMeta = { ...variantMeta[attrName] };
    attrMeta[newVal] = attrMeta[oldVal];
    delete attrMeta[oldVal];
    newVariantMeta = { ...variantMeta, [attrName]: attrMeta };
  }

  return {
    variantOptions: newVariantOptions,
    variantMeta: newVariantMeta,
    variantDetails: remapComboKeyedObject(variantDetails, attrName, oldVal, newVal),
    deselectedCombos: remapComboKeyedSet(deselectedCombos, attrName, oldVal, newVal),
    expandedPrices: remapComboKeyedSet(expandedPrices, attrName, oldVal, newVal),
  };
}
