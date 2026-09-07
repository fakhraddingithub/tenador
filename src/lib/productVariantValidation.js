import { makeComboKey } from './variantKey.js';

// Shared by the create form, the create API and the edit API; optional empty
// dimensions create no variants. Keeping both validators here is what stops
// create and edit from drifting apart (edit used to validate nothing at all).
//
// `allowEmpty` exists only for the edit path. Enforcing "a required variant
// attribute needs at least one combination" on every save would lock the admin
// out of legacy products that were created (before this validation existed)
// with no variants at all — an edit to their description would be refused for a
// variant they never had. The rule that actually protects data is "an edit must
// not delete the last variant", so the caller passes `allowEmpty: true` exactly
// when the product currently has none and nothing can be lost.
export function validateProductVariants(
  definitions = [], options = {}, selectedCombos, { allowEmpty = false } = {},
) {
  const fieldErrors = {};
  const fail = (key, message) => { fieldErrors[key] = message; };
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { error: 'ساختار ویژگی‌های واریانت معتبر نیست', fieldErrors: {} };
  }
  const allowed = new Map(definitions.map((attr) => [attr.name, attr]));
  for (const [key, values] of Object.entries(options)) {
    const label = allowed.get(key)?.label || key;
    if (!allowed.has(key)) {
      fail(key, `ویژگی واریانت «${label}» در این دسته‌بندی تعریف نشده است`);
    } else if (!Array.isArray(values) || values.some((value) =>
      !['string', 'number'].includes(typeof value) || !String(value).trim() ||
      (typeof value === 'number' && !Number.isFinite(value)))) {
      fail(key, `مقادیر واریانت «${label}» باید متن یا عدد غیرخالی باشند`);
    } else if (values.some((value) => String(value) !== String(value).trim())) {
      // Rejected rather than trimmed on the way in: silently rewriting the value
      // would change the combination key, and the key is the variant's identity —
      // an existing variant would be deleted and recreated with a fresh _id.
      fail(key, `مقادیر واریانت «${label}» نباید با فاصله شروع یا تمام شوند`);
    }
  }
  // A malformed value is always an error, whatever `allowEmpty` says
  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }

  const entries = Object.entries(options).filter(([, values]) => values.length);
  let combinations = entries.length ? [{}] : [];
  for (const [key, values] of entries) {
    combinations = combinations.flatMap((combo) =>
      [...new Set(values.map(String))].map((value) => ({ ...combo, [key]: value })));
  }
  if (selectedCombos !== undefined) {
    if (!Array.isArray(selectedCombos)) {
      return { error: 'فهرست ترکیب‌های انتخاب‌شده معتبر نیست', fieldErrors: {} };
    }
    const selected = new Set(selectedCombos);
    combinations = combinations.filter((combo) => selected.has(makeComboKey(combo)));
  }

  if (allowEmpty && !combinations.length) return { combinations: [] };

  for (const attr of definitions) {
    if (attr.required && (!Array.isArray(options[attr.name]) || !options[attr.name].length)) {
      fail(attr.name, `برای واریانت الزامی «${attr.label || attr.name}» حداقل یک مقدار وارد کنید`);
    }
  }
  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }
  if (definitions.some((attr) => attr.required) && !combinations.length) {
    return { error: 'حداقل یک ترکیب واریانت را برای ساخت محصول انتخاب کنید', fieldErrors: {} };
  }
  return { combinations };
}

/**
 * Product-level fields (base price, fixed attributes, technical stats) against
 * the category definition.
 *
 * `undefined` means "this request is not setting that field" and is skipped;
 * `{}` means "no values" and is validated. That distinction is what lets the
 * edit route leave untouched fields alone while still refusing invalid ones.
 */
export function validateProductFields(category, { attributes, technicalStats, basePrice } = {}) {
  const fieldErrors = {};
  const fail = (key, message) => { if (!fieldErrors[key]) fieldErrors[key] = message; };

  if (basePrice !== undefined && basePrice !== null && basePrice !== '') {
    const price = Number(basePrice);
    if (!Number.isFinite(price) || price < 0) {
      fail('basePrice', 'قیمت پایه باید عددی صفر یا بزرگ‌تر از صفر باشد');
    }
  }

  if (attributes !== undefined) {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      fail('attributes', 'ساختار ویژگی‌های محصول معتبر نیست');
    } else {
      const defined = new Map((category?.attributes || []).map((attr) => [attr.name, attr]));
      for (const key of Object.keys(attributes)) {
        if (!defined.has(key)) fail(key, `ویژگی «${key}» در این دسته‌بندی مجاز نیست`);
      }
      for (const attr of category?.attributes || []) {
        if (!attr.required) continue;
        const value = attributes[attr.name];
        const empty = value === undefined || value === null
          || (Array.isArray(value) ? value.length === 0 : String(value).trim() === '');
        if (empty) fail(attr.name, `ویژگی «${attr.label || attr.name}» را وارد کنید`);
      }
    }
  }

  if (technicalStats !== undefined) {
    if (!technicalStats || typeof technicalStats !== 'object' || Array.isArray(technicalStats)) {
      fail('technicalStats', 'ساختار شاخص‌های فنی معتبر نیست');
    } else {
      const defined = new Map((category?.technicalStats || []).map((stat) => [stat.name, stat]));
      for (const [key, raw] of Object.entries(technicalStats)) {
        const stat = defined.get(key);
        if (!stat) {
          fail(key, `شاخص فنی «${key}» در این دسته تعریف نشده است`);
          continue;
        }
        // The radar chart draws on this scale, so a value outside it is not a
        // cosmetic problem — it silently breaks the product page.
        const min = Number.isFinite(stat.min) ? stat.min : 0;
        const max = Number.isFinite(stat.max) ? stat.max : 100;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < min || value > max) {
          fail(key, `مقدار شاخص «${stat.label || key}» باید عددی بین ${min} تا ${max} باشد`);
        }
      }
    }
  }

  if (Object.keys(fieldErrors).length) {
    return { error: Object.values(fieldErrors)[0], fieldErrors };
  }
  return {};
}
