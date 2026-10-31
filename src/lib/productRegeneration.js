/**
 * src/lib/productRegeneration.js  (pure — no DB, no network)
 *
 * «بازتولید محصول»: JSONِ تازه‌ی AI (همان خروجیِ پرامپتِ ساختِ محصول) روی یک
 * محصولِ *موجود* نوشته می‌شود — همه‌ی فیلدها به‌جز تصاویر و واریانت‌ها.
 *
 * قراردادها:
 * - **تصاویر و واریانت‌ها هرگز در `update` نمی‌آیند.** `mainImage`، `gallery`،
 *   `variantOptions`، `variantMeta` (تصاویر/واحدهای سطحِ مقدارِ واریانت) و هر
 *   کلیدِ واریانتیِ دیگر فقط «حفظ‌شده» گزارش می‌شوند. روت علاوه بر این پیش از
 *   ذخیره `PROTECTED_PRODUCT_PATHS` را روی سند چک می‌کند و به مدلِ Variant دست
 *   نمی‌زند — حفاظت در سطحِ داده است، نه فقط در فرم.
 * - **کلیدِ نیامده ≠ مقدارِ خالی** (همان قراردادِ PUT). کلیدی که در JSON نیست
 *   دست نمی‌خورد و در `missing` گزارش می‌شود؛ `""`/`[]`/`{}` یعنی «خالی کن».
 *   برای نگه‌داشتنِ یک فیلد (مثلاً قیمتِ واقعی) کافی است کلیدش از JSON حذف شود.
 * - **یا همه یا هیچ.** هر خطایی کلِ درخواست را رد می‌کند؛ نیمه‌نوشتن وجود ندارد.
 * - JSON باید برای *همین* دسته ساخته شده باشد: `category`/`sport`ِ ناهم‌خوان رد
 *   می‌شود (پرامپتِ دسته‌ی دیگر یعنی ویژگی‌ها و شاخص‌های دسته‌ی دیگر).
 */

import { attributeAppliesToAudience, normalizeTargetAudience } from '../../utils/targetAudience.js';
import { validateProductFields } from './productVariantValidation.js';
import { duplicateKeys, productAttributeType } from './productSectionJson.js';

/** فیلدهایی که بازتولید می‌نویسد، با برچسبِ فارسی برای پیش‌نمایش. */
export const REGENERATED_FIELDS = {
  name: 'نام محصول',
  shortDescription: 'توضیح کوتاه',
  longDescription: 'توضیح کامل',
  color: 'رنگ',
  basePrice: 'قیمت پایه',
  label: 'برچسب محصول',
  targetAudience: 'مخاطب هدف',
  brand: 'برند',
  serie: 'سری',
  limitedEdition: 'لیمیتد ادیشن',
  athlete: 'ورزشکاران',
  attributes: 'ویژگی‌های ثابت',
  technicalStats: 'شاخص‌های فنی',
  customTabItems: 'آیتم‌های تب اختصاصی',
  tag: 'برچسب‌های جستجو',
};

/** کلیدهای JSON که عمداً نادیده گرفته می‌شوند چون داده‌شان حفظ می‌شود. */
export const PRESERVED_DRAFT_KEYS = [
  'mainImage', 'gallery', 'variantOptions', 'variantMeta', 'variantDetails', 'selectedCombos', 'variants',
];

/** مسیرهای سندِ Product که بازتولید هرگز نباید تغییرشان دهد (گاردِ روت). */
export const PROTECTED_PRODUCT_PATHS = ['mainImage', 'gallery', 'variants', 'variantMeta'];

// همان enumِ models/Product.js — تستِ بازتولید برابری‌شان را قفل می‌کند.
export const PRODUCT_LABELS = ['none', 'new', 'hot', 'discount', 'limited'];

const CONTEXT_KEYS = ['category', 'sport'];
const MAX_DRAFT_LENGTH = 500_000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const idString = (v) => (v == null ? '' : String(v?._id ?? v));

/** متنِ چسبانده‌شده → شیءِ JSON. حصارِ ```json ... ``` که چت‌بات‌ها اضافه می‌کنند پذیرفته می‌شود. */
export function parseRegenerationDraft(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { error: 'JSON خروجی AI را وارد کنید' };
  }
  if (text.length > MAX_DRAFT_LENGTH) {
    return { error: 'متن JSON بیش از حد بزرگ است' };
  }
  let source = text.trim();
  const fenced = source.match(/^```[a-z]*\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fenced) source = fenced[1].trim();

  let draft;
  try {
    draft = JSON.parse(source);
  } catch (err) {
    return { error: `ساختار JSON درست نیست؛ خروجیِ AI را کامل و بدونِ توضیحِ اضافه کپی کنید. جزئیات: ${err.message}` };
  }
  if (!isPlainObject(draft)) {
    return { error: 'ریشه‌ی JSON باید یک شیء محصول باشد؛ آرایه، null و مقادیر ساده مجاز نیستند' };
  }
  const duplicates = duplicateKeys(source);
  if (duplicates.length) {
    return { error: `JSON کلیدِ تکراری دارد: ${duplicates.join('، ')}` };
  }
  return { draft };
}

/** شناسه‌هایی که planner برای اعتبارسنجی و نمایش لازم دارد (روت با آن کوئری می‌زند). */
export function collectRegenerationRefIds(draft, product) {
  const ids = { brands: new Set(), series: new Set(), limitedEditions: new Set(), athletes: new Set() };
  const add = (set, value) => {
    const id = idString(value).trim();
    if (OBJECT_ID.test(id)) set.add(id);
  };
  add(ids.brands, draft.brand); add(ids.brands, product.brand);
  add(ids.series, draft.serie); add(ids.series, product.serie);
  add(ids.limitedEditions, draft.limitedEdition); add(ids.limitedEditions, product.limitedEdition);
  for (const a of [draft.athlete, product.athlete].flat()) add(ids.athletes, a);
  return Object.fromEntries(Object.entries(ids).map(([k, set]) => [k, [...set]]));
}

function normalizeAttributeValue(def, value) {
  if (isBlank(value) || (Array.isArray(value) && value.length === 0)) return { skip: true };
  const label = def.label || def.name;
  const type = productAttributeType(def);
  const scalar = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

  if (type === 'number') {
    const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
    if (!Number.isFinite(num)) return { error: `«${label}» باید عدد باشد` };
    return { value: num };
  }
  if (type === 'select') {
    // همان شکلی که فرمِ ویرایش ذخیره می‌کند: آرایه‌ی متن، مقادیرِ کامادار از هم جدا
    const list = Array.isArray(value) ? value : [value];
    if (!list.every(scalar)) return { error: `«${label}» باید متن یا آرایه‌ای از متن‌ها باشد` };
    const values = [...new Set(list.flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean))];
    return values.length ? { value: values } : { skip: true };
  }
  if (!scalar(value)) return { error: `«${label}» باید یک متن یا عدد باشد` };
  return { value: typeof value === 'string' ? value.trim() : value };
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  if (value != null && typeof value === 'object' && typeof value.toString === 'function') {
    return JSON.stringify(String(value)); // ObjectId
  }
  return JSON.stringify(value ?? null);
}

/**
 * @param {object} args
 * @param {object} args.draft     شیءِ JSONِ AI (خروجیِ parseRegenerationDraft)
 * @param {object} args.product   محصولِ فعلی (lean)
 * @param {object} args.category  دسته‌ی محصول (lean)
 * @param {object} args.refs      Mapهای { brands, series, limitedEditions, athletes } — id → { name, brand? }
 * @param {boolean} [args.requireComplete]  حالتِ خودکار: خروجیِ مدل باید همه‌ی فیلدهایی را که
 *   پرامپت خواسته داشته باشد. در حالتِ دستی کلیدِ نیامده یعنی «دست نخورد» (ادمین عمداً حذفش
 *   کرده)، ولی مدلی که فیلدی را جا انداخته پاسخِ ناقص داده و ذخیره‌اش «بازتولید» نیست.
 * @returns {{ error?: string, fieldErrors?: object, update: object, changes: Array,
 *            missing: string[], ignored: string[], preserved: string[] }}
 */
export function planProductRegeneration({ draft, product, category, refs, requireComplete = false }) {
  const fieldErrors = {};
  const fail = (key, message) => { if (!fieldErrors[key]) fieldErrors[key] = message; };
  const has = (key) => Object.hasOwn(draft, key);
  const update = {};

  if (requireComplete) {
    // customTabItems فقط وقتی در قالبِ خروجیِ پرامپت هست که تب فعال و آیتم‌دار باشد
    const tab = category.customTab;
    const asked = Object.keys(REGENERATED_FIELDS)
      .filter((key) => key !== 'customTabItems' || (tab?.enabled && tab.items?.length));
    for (const key of asked) {
      if (!has(key)) fail(key, `پاسخِ AI فیلدِ «${REGENERATED_FIELDS[key]}» را نداشت`);
    }
  }

  // ── JSON باید برای همین دسته ساخته شده باشد ──
  if (has('category') && !isBlank(draft.category) && idString(draft.category) !== idString(product.category)) {
    fail('category', 'این JSON برای دسته‌بندیِ دیگری ساخته شده است؛ پرامپت را از صفحه‌ی بازتولیدِ همین محصول بسازید');
  }
  if (has('sport') && !isBlank(draft.sport) && idString(draft.sport) !== idString(category.sport)) {
    fail('sport', 'ورزشِ این JSON با ورزشِ دسته‌بندیِ محصول یکی نیست؛ پرامپت را دوباره بسازید');
  }

  // ── متن‌های الزامی ──
  for (const key of ['name', 'shortDescription', 'longDescription']) {
    if (!has(key)) continue;
    if (typeof draft[key] !== 'string' || !draft[key].trim()) fail(key, `«${REGENERATED_FIELDS[key]}» باید متنِ غیرخالی باشد`);
    else update[key] = draft[key].trim();
  }

  if (has('color')) {
    const color = draft.color ?? '';
    if (typeof color !== 'string' || (color.trim() && !HEX_COLOR.test(color.trim()))) {
      fail('color', 'رنگ باید کدِ هگز مثل #1a2b3c یا خالی باشد');
    } else update.color = color.trim();
  }

  if (has('basePrice')) {
    const raw = draft.basePrice;
    const price = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.trim()) : NaN;
    if (!Number.isFinite(price) || price < 0) fail('basePrice', 'قیمت پایه باید عددی صفر یا بزرگ‌تر از صفر باشد');
    else update.basePrice = price;
  }

  if (has('label')) {
    // قالبِ خروجیِ پرامپت `"label": ""` است و قاعده‌اش «پیش‌فرض none»
    const label = isBlank(draft.label) ? 'none' : draft.label;
    if (!PRODUCT_LABELS.includes(label)) fail('label', `برچسب باید یکی از ${PRODUCT_LABELS.join(' | ')} باشد`);
    else update.label = label;
  }

  if (has('targetAudience')) {
    if (isBlank(draft.targetAudience)) update.targetAudience = null;
    else {
      const audience = typeof draft.targetAudience === 'string' ? normalizeTargetAudience(draft.targetAudience) : null;
      if (!audience) fail('targetAudience', 'مخاطب هدف باید یکی از «مردانه | زنانه | بچگانه | یونی سکس» باشد');
      else update.targetAudience = audience;
    }
  }
  const effectiveAudience = has('targetAudience') ? update.targetAudience : product.targetAudience;

  // ── ارجاع‌ها ──
  const refId = (key) => {
    const value = draft[key];
    if (isBlank(value)) return '';
    if (typeof value !== 'string') { fail(key, `«${REGENERATED_FIELDS[key]}» باید شناسه‌ی متنی باشد`); return null; }
    return value.trim();
  };

  if (has('brand')) {
    const id = refId('brand');
    if (id === '') fail('brand', 'برند الزامی است');
    else if (id && !refs.brands.has(id)) fail('brand', `برندِ «${id}» یافت نشد`);
    else if (id) update.brand = id;
  }
  const effectiveBrand = has('brand') ? update.brand : idString(product.brand);
  const brandChanged = has('brand') && update.brand && update.brand !== idString(product.brand);

  // سری و لیمیتد ادیشن فقط زیرِ برندِ مالکِ خودشان معنا دارند. اگر برند عوض شده
  // ولی JSON این کلیدها را نیاورده، مقدارِ فعلی (متعلق به برندِ قبلی) هم بررسی می‌شود.
  for (const [key, map] of [['serie', refs.series], ['limitedEdition', refs.limitedEditions]]) {
    const noun = REGENERATED_FIELDS[key];
    if (has(key)) {
      const id = refId(key);
      if (id === '') update[key] = null;
      else if (id) {
        const ref = map.get(id);
        if (!ref) fail(key, `${noun}ِ «${id}» یافت نشد`);
        else if (ref.brand !== effectiveBrand) fail(key, `${noun}ِ انتخاب‌شده متعلق به برندِ این محصول نیست`);
        else update[key] = id;
      }
    } else if (brandChanged && product[key]) {
      const ref = map.get(idString(product[key]));
      if (!ref || ref.brand !== effectiveBrand) {
        fail(key, `برند عوض شده ولی ${noun}ِ فعلی متعلق به برندِ قبلی است؛ «${key}» را در JSON مشخص کنید`);
      }
    }
  }

  if (has('athlete')) {
    const raw = isBlank(draft.athlete) ? [] : Array.isArray(draft.athlete) ? draft.athlete : [draft.athlete];
    if (!raw.every((a) => typeof a === 'string')) fail('athlete', 'ورزشکاران باید آرایه‌ای از شناسه‌ها باشند');
    else {
      const ids = [...new Set(raw.map((a) => a.trim()).filter(Boolean))];
      const unknown = ids.filter((id) => !refs.athletes.has(id));
      if (unknown.length) fail('athlete', `ورزشکارِ ناموجود: ${unknown.join('، ')}`);
      else update.athlete = ids;
    }
  }

  // ── ویژگی‌های ثابت ──
  if (has('attributes')) {
    const raw = draft.attributes ?? {};
    if (!isPlainObject(raw)) fail('attributes', 'ویژگی‌ها باید یک شیء باشند');
    else {
      const defs = new Map((category.attributes || []).map((a) => [a.name, a]));
      const attributes = {};
      for (const [key, value] of Object.entries(raw)) {
        const def = defs.get(key);
        if (!def) { fail(key, `ویژگیِ «${key}» در این دسته‌بندی تعریف نشده است`); continue; }
        const result = normalizeAttributeValue(def, value);
        if (result.error) fail(key, result.error);
        else if (!result.skip) attributes[key] = result.value;
      }
      // ویژگیِ محدود به مخاطبِ دیگر را AI عمداً نمی‌آورد؛ مقدارِ ذخیره‌شده‌اش حفظ
      // می‌شود (همان قاعده‌ی فرمِ ویرایش) تا تغییرِ مخاطب داده‌ای را بی‌صدا پاک نکند.
      for (const def of category.attributes || []) {
        if (Object.hasOwn(attributes, def.name) || Object.hasOwn(raw, def.name)) continue;
        if (attributeAppliesToAudience(def.targetAudiences, effectiveAudience)) continue;
        const stored = product.attributes?.[def.name];
        if (!isBlank(stored) && !(Array.isArray(stored) && !stored.length)) attributes[def.name] = stored;
      }
      update.attributes = attributes;
    }
  }

  // ── شاخص‌های فنی ──
  if (has('technicalStats')) {
    const raw = draft.technicalStats ?? {};
    if (!isPlainObject(raw)) fail('technicalStats', 'شاخص‌های فنی باید یک شیء باشند');
    else {
      const stats = {};
      for (const [key, value] of Object.entries(raw)) {
        if (isBlank(value)) continue;
        const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
        stats[key] = Number.isFinite(num) ? num : value; // بازه و تعریف را validateProductFields بررسی می‌کند
      }
      update.technicalStats = stats;
    }
  }

  // ── تب اختصاصی: عنوان → شناسه‌ی آیتمِ دسته ──
  if (has('customTabItems')) {
    const raw = isBlank(draft.customTabItems) ? [] : draft.customTabItems;
    if (!Array.isArray(raw) || !raw.every((t) => typeof t === 'string')) {
      fail('customTabItems', 'آیتم‌های تب اختصاصی باید آرایه‌ای از عنوان‌ها باشند');
    } else {
      const items = category.customTab?.items || [];
      const titles = [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
      const unknown = titles.filter((t) => !items.some((it) => it.title === t));
      if (unknown.length) {
        fail('customTabItems', `عنوان‌های ناموجود در تب اختصاصی: ${unknown.join('، ')}`);
      } else {
        update.customTabItems = titles.map((t) => idString(items.find((it) => it.title === t)._id));
      }
    }
  }

  if (has('tag')) {
    const raw = isBlank(draft.tag) ? [] : typeof draft.tag === 'string' ? draft.tag.split(',') : draft.tag;
    if (!Array.isArray(raw) || !raw.every((t) => typeof t === 'string' || typeof t === 'number')) {
      fail('tag', 'برچسب‌ها باید آرایه‌ای از متن باشند');
    } else update.tag = [...new Set(raw.map((t) => String(t).trim()).filter(Boolean))];
  }

  // همان اعتبارسنجیِ مشترکِ create/edit — با مخاطبِ هدفِ مؤثر
  const shared = validateProductFields(category, {
    attributes: update.attributes,
    technicalStats: update.technicalStats,
    basePrice: update.basePrice,
    targetAudience: effectiveAudience,
  });
  for (const [key, message] of Object.entries(shared.fieldErrors || {})) fail(key, message);

  const known = new Set([...Object.keys(REGENERATED_FIELDS), ...PRESERVED_DRAFT_KEYS, ...CONTEXT_KEYS]);
  const summary = {
    missing: Object.keys(REGENERATED_FIELDS).filter((k) => !has(k)),
    ignored: Object.keys(draft).filter((k) => !known.has(k)),
    preserved: PRESERVED_DRAFT_KEYS.filter(has),
  };

  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors, update: {}, changes: [], ...summary };
  }

  const before = currentValues(product);
  const changes = Object.keys(update)
    .filter((field) => stable(before[field]) !== stable(update[field]))
    .map((field) => ({
      field,
      label: REGENERATED_FIELDS[field],
      before: display(field, before[field], { refs, category }),
      after: display(field, update[field], { refs, category }),
    }));

  return { update, changes, ...summary };
}

/** مقادیرِ فعلیِ محصول به همان شکلی که `update` ساخته می‌شود (برای مقایسه). */
function currentValues(product) {
  return {
    name: product.name ?? '',
    shortDescription: product.shortDescription ?? '',
    longDescription: product.longDescription ?? '',
    color: product.color ?? '',
    basePrice: product.basePrice ?? 0,
    label: product.label || 'none',
    targetAudience: product.targetAudience ?? null,
    brand: idString(product.brand),
    serie: product.serie ? idString(product.serie) : null,
    limitedEdition: product.limitedEdition ? idString(product.limitedEdition) : null,
    athlete: (product.athlete || []).map(idString),
    attributes: product.attributes || {},
    technicalStats: product.technicalStats || {},
    customTabItems: (product.customTabItems || []).map(idString),
    tag: product.tag || [],
  };
}

function display(field, value, { refs, category }) {
  const name = (map, id) => (id ? map.get(id)?.name || id : '');
  switch (field) {
    case 'brand': return name(refs.brands, value);
    case 'serie': return name(refs.series, value);
    case 'limitedEdition': return name(refs.limitedEditions, value);
    case 'athlete': return value.map((id) => name(refs.athletes, id));
    case 'customTabItems':
      return value.map((id) => (category.customTab?.items || []).find((it) => idString(it._id) === id)?.title || id);
    case 'targetAudience': return value || '';
    default: return value;
  }
}
