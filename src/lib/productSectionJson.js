import { filterAttributesByAudience } from '../../utils/targetAudience.js';
import { validateProductFields } from './productVariantValidation.js';

export const BASIC_PRODUCT_FIELDS = {
  name: 'نام محصول',
  shortDescription: 'توضیح کوتاه',
  longDescription: 'توضیح کامل',
};

export function productAttributeType(attr) {
  if (attr.type) return attr.type;
  if (attr.uiType === 'number-input') return 'number';
  if (['dropdown', 'swatch', 'button-toggle'].includes(attr.uiType)) return 'select';
  return 'text';
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const empty = (value) => value === '' || value === undefined;

// JSON.parse accepts duplicate keys silently. Detect them before accepting a draft,
// including escaped equivalents such as "name" and "\u006eame".
function duplicateKeys(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  let index = 0;
  const errors = [];
  function visit(path) {
    const token = tokens[index++];
    if (token === '{') {
      const keys = new Set();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]);
        if (keys.has(key)) errors.push(`${path}.${key}: کلید تکراری است`);
        keys.add(key);
        index++; // colon
        visit(`${path}.${key}`);
        if (tokens[index] !== ',') break;
        index++;
      }
      index++;
    } else if (token === '[') {
      let item = 0;
      while (tokens[index] !== ']') {
        visit(`${path}[${item++}]`);
        if (tokens[index] !== ',') break;
        index++;
      }
      index++;
    }
  }
  visit('$');
  return errors;
}

export function getProductSectionJson(section, form, category) {
  if (section === 'basicInfo') {
    return Object.fromEntries(Object.keys(BASIC_PRODUCT_FIELDS).map(key => [key, form[key] ?? '']));
  }
  const definitions = section === 'fixedAttributes'
    ? filterAttributesByAudience(category?.attributes || [], form.targetAudience)
    : category?.technicalStats || [];
  const source = section === 'fixedAttributes' ? form.attributes : form.technicalStats;
  return Object.fromEntries(definitions.map(def => {
    let value = source?.[def.name] ?? '';
    const type = section === 'technicalStats' ? 'number' : productAttributeType(def);
    if (type === 'number' && value !== '' && Number.isFinite(Number(value))) value = Number(value);
    if (type === 'select' && typeof value === 'string') value = value.split(',').map(v => v.trim()).filter(Boolean);
    return [def.name, value];
  }));
}

/** Returns an atomic form patch; never mutates the current form or parsed draft. */
export function validateProductSectionJson(section, text, form, category) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { errors: [`ساختار JSON درست نیست؛ کلیدها و متن‌ها باید داخل نقل‌قول دوتایی باشند. جزئیات: ${error.message}`] };
  }
  if (!isObject(data)) return { errors: ['ریشه JSON باید یک شیء باشد؛ آرایه، null و مقادیر ساده مجاز نیستند.'] };
  const errors = duplicateKeys(text);
  const fail = (key, message) => errors.push(`${key}: ${message}`);
  if (!['basicInfo', 'fixedAttributes', 'technicalStats'].includes(section)) return { errors: ['بخش نامعتبر است.'] };
  if (section === 'basicInfo') {
    for (const key of Object.keys(data)) {
      if (!Object.hasOwn(BASIC_PRODUCT_FIELDS, key)) fail(key, 'این فیلد در اطلاعات پایه وجود ندارد');
    }
    for (const [key, label] of Object.entries(BASIC_PRODUCT_FIELDS)) {
      if (typeof data[key] !== 'string' || !data[key].trim()) fail(key, `${label} باید متن غیرخالی باشد`);
    }
    return errors.length ? { errors } : { patch: data, errors: [] };
  }
  if (!category) return { errors: ['دسته‌بندی معتبر در دسترس نیست؛ ابتدا دسته‌بندی را انتخاب کنید.'] };
  const fixed = section === 'fixedAttributes';
  const definitions = fixed
    ? filterAttributesByAudience(category.attributes || [], form.targetAudience)
    : category.technicalStats || [];
  const allowed = new Map(definitions.map(def => [def.name, def]));
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const def = allowed.get(key);
    if (!def || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      fail(key, 'این فیلد در این بخش برای دسته‌بندی و مخاطب فعلی مجاز نیست');
      continue;
    }
    const type = fixed ? productAttributeType(def) : 'number';
    const label = def.label || key;
    if (empty(value)) continue;
    if (type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(key, `«${label}» باید عدد JSON باشد، نه متن، null یا مقدار منطقی`);
        continue;
      }
      const min = Number.isFinite(def.min) ? def.min : fixed ? -Infinity : 0;
      const max = Number.isFinite(def.max) ? def.max : fixed ? Infinity : 100;
      if (value < min || value > max) fail(key, `«${label}» باید بین ${min} و ${max} باشد`);
    } else if (type === 'select') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !v.trim() || v.includes(','))) {
        fail(key, `«${label}» باید آرایه‌ای از متن‌های غیرخالی و بدون کاما باشد`);
        continue;
      }
      const values = value.map(v => v.trim());
      if (new Set(values).size !== values.length) fail(key, `«${label}» مقدار تکراری دارد`);
      const invalid = values.filter(v => def.options?.length && !def.options.includes(v));
      if (invalid.length) fail(key, `گزینه‌های نامعتبر: ${invalid.join('، ')}؛ گزینه‌های مجاز: ${def.options.join('، ')}`);
      normalized[key] = values;
      continue;
    } else if (typeof value !== 'string') {
      fail(key, `«${label}» باید متن باشد`);
      continue;
    }
    normalized[key] = value;
  }
  // Validate only this section. Hidden audience-specific attributes stay intact.
  const validation = validateProductFields(
    fixed ? { ...category, attributes: definitions } : category,
    { [fixed ? 'attributes' : 'technicalStats']: normalized, targetAudience: form.targetAudience },
  );
  for (const [key, message] of Object.entries(validation.fieldErrors || {})) fail(key, message);
  if (errors.length) return { errors };
  if (!fixed) return { errors: [], patch: { technicalStats: normalized } };
  const attributes = { ...form.attributes };
  for (const def of definitions) {
    const value = normalized[def.name];
    attributes[def.name] = Array.isArray(value) ? value.join(', ') : value ?? '';
  }
  return { errors: [], patch: { attributes } };
}
