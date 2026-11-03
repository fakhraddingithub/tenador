/**
 * src/lib/productPromptResolve.js
 *
 * سندِ ذخیره‌شده را به تنظیماتِ کامل تبدیل می‌کند. متنِ شروع داده است، نه کد
 * (productPromptSeed.json) و فقط وقتی به کار می‌رود که هنوز هیچ پرامپتی ذخیره نشده باشد:
 * اولین ذخیره همه‌چیز را به دیتابیس می‌برد و از آن پس سند تنها منبع است.
 *
 * سندی که پیش از این ساختار ذخیره شده (`base: [{section, rules}]`) بدونِ مهاجرت کار می‌کند:
 * قواعدِ ادمین روی seed نشانده می‌شوند.
 */
import PROMPT_SEED from "./productPromptSeed.json" with { type: "json" };

export { PROMPT_SEED };

const asFieldRules = (entries) => (entries || []).map(({ field, rules }) => ({ field, rules: [...rules] }));

const asTemplates = (stored) =>
  Array.isArray(stored) ? Object.fromEntries(stored.map(({ key, text }) => [key, text])) : stored || {};

/** سندِ قدیمی: بخشِ غایب = seed؛ `rules: []` = عمداً خالی، که قبلاً کلِ بخش را حذف می‌کرد. */
function upgradeLegacyBase(base) {
  const legacy = new Map(
    (Array.isArray(base) ? base : [])
      .filter((s) => Array.isArray(s?.rules))
      .map((s) => [s.section, s.rules]),
  );
  const document = PROMPT_SEED.document.flatMap((section) => {
    if (section.kind !== "text" || !legacy.has(section.key)) return [section];
    const rules = legacy.get(section.key);
    return rules.length ? [{ ...section, rules: [...rules] }] : [];
  });
  // قاعده‌هایی که کدِ قبلی دورِ قواعدِ پایه می‌چید (legacyLocks) حالا قاعده‌ی معمولی‌اند
  const fieldRules = PROMPT_SEED.fieldRules.map(({ field, rules }) => {
    const stored = legacy.get(`field:${field}`);
    if (!stored) return { field, rules: [...rules] };
    const lock = PROMPT_SEED.legacyLocks[field] || {};
    return { field, rules: [...(lock.before || []), ...stored, ...(lock.after || [])] };
  });
  return { document, fieldRules };
}

/**
 * @param {object|null} stored سندِ ProductPromptConfig (lean) یا null
 * @returns {{document: Array, fieldRules: Array<{field, rules}>, templates: Record<string,string>, groups: Array}}
 */
export function resolvePromptConfig(stored) {
  const groups = (Array.isArray(stored?.groups) ? stored.groups : []).map((group) => ({
    ...group,
    sections: Array.isArray(group.sections) ? group.sections : [],
  }));
  // قالبی که کدِ تازه‌تر اضافه کرده و هنوز ذخیره نشده از seed می‌آید؛ متنِ خالی عمدی می‌ماند
  const templates = { ...PROMPT_SEED.templates, ...asTemplates(stored?.templates) };

  if (Array.isArray(stored?.document) && stored.document.length) {
    return { document: stored.document, fieldRules: asFieldRules(stored.fieldRules), templates, groups };
  }
  return { ...upgradeLegacyBase(stored?.base), templates, groups };
}
