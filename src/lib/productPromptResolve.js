/**
 * src/lib/productPromptResolve.js
 *
 * سندِ ذخیره‌شده را به تنظیماتِ کامل تبدیل می‌کند. متنِ شروع داده است، نه کد
 * (productPromptSeed.json) و فقط وقتی به کار می‌رود که هنوز هیچ پرامپتی ذخیره نشده باشد:
 * اولین ذخیره همه‌چیز را به دیتابیس می‌برد و از آن پس سند تنها منبع است.
 *
 * سندهایی که با شکل‌های قبلی ذخیره شده‌اند بدونِ مهاجرت کار می‌کنند:
 *   base: [{section, rules}]                  قواعدِ ادمین روی seed نشانده می‌شوند
 *   document با top/title/bottom/description  همان متن‌ها یک سربرگ می‌شوند
 */
import { DATA_SECTION_KEYS, TEMPLATE_DEFS } from "./productPromptConfig.js";
import PROMPT_SEED from "./productPromptSeed.json" with { type: "json" };

export { PROMPT_SEED };

const SEED_FIELD_HEADING = new Map(PROMPT_SEED.fieldRules.map(({ field, heading }) => [field, heading]));
const seedSection = (key) => PROMPT_SEED.document.find((s) => s.key === key);
const TEMPLATE_KEYS = new Set(TEMPLATE_DEFS.map((t) => t.key));

const asTemplates = (stored) =>
  Array.isArray(stored) ? Object.fromEntries(stored.map(({ key, text }) => [key, text])) : stored || {};

const joinHead = (parts) => parts.filter((part) => part).join("\n");
const oldHead = (s, withDescription = true) => joinHead([s.top, s.title, s.bottom, withDescription ? s.description : ""]);

/** شکلِ قدیمیِ پرامپت پایه: بخشِ غایب = seed؛ `rules: []` = عمداً خالی، که کلِ بخش را حذف می‌کرد. */
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
  const fieldRules = PROMPT_SEED.fieldRules.map(({ field, heading, rules }) => ({
    field,
    heading,
    rules: [...(legacy.get(`field:${field}`) || rules)],
  }));
  return { document, fieldRules };
}

/**
 * سندی که سربرگِ یک‌تکه ندارد: top/title/bottom/description یک سربرگ می‌شوند و فاصله‌ی بعد از
 * بخش (blankLines) خطوطِ خالیِ بالای سربرگِ بخشِ بعد. جای گروه‌ها دیگر بخش نیست و کنار می‌رود.
 * «تعریف دسته» و «متن خام» حالا بخش‌های داده‌ای‌اند.
 */
function upgradeDocument(stored) {
  let gap = "";
  const document = stored
    .filter((section) => section.kind !== "groups")
    .flatMap((section) => {
      if (typeof section.heading === "string") return [section];
      const lead = gap;
      gap = "\n".repeat(section.blankLines ?? 1);
      if (section.key === "definition") {
        const parts = DATA_SECTION_KEYS.slice(0, 6).map((key) => seedSection(key));
        return parts.map((part, i) => (i === 0 ? { ...part, heading: `${lead}${oldHead(section, false)}` } : part));
      }
      const key = section.key === "source" ? "source_text" : section.key;
      if (DATA_SECTION_KEYS.includes(key)) {
        return [{ key, kind: "data", name: section.name, heading: `${lead}${oldHead(section, false)}`, rules: [] }];
      }
      return [{ key, kind: section.kind, name: section.name, heading: `${lead}${oldHead(section)}`, rules: [...(section.rules || [])] }];
    });
  // بخش‌های داده‌ای قابل حذف نیستند؛ اگر در سندی نبودند برمی‌گردند
  const present = new Set(document.map((s) => s.key));
  const missing = PROMPT_SEED.document.filter((s) => (s.kind === "data" || s.kind === "fields") && !present.has(s.key));
  return [...document, ...missing];
}

/** قاعده‌هایی که برنامه حالا خودش درج می‌کند نباید دو بار بیایند. */
const LOCKED = new Set(PROMPT_SEED.legacyLockedRules);

function upgradeFieldRules(entries, templates) {
  const customHeading = templates.field_heading;
  return (entries || []).map(({ field, heading, rules }) => {
    const seed = SEED_FIELD_HEADING.get(field) ?? `${field}:`;
    const lead = seed.startsWith("\n") ? "\n" : "";
    return {
      field,
      heading: typeof heading === "string"
        ? heading
        : customHeading ? `${lead}${customHeading.replace(/\{\{\s*field\s*\}\}/g, field)}` : seed,
      rules: (rules || []).filter((text) => !LOCKED.has(text)),
    };
  });
}

const upgradeGroupSection = (section) =>
  typeof section.heading === "string"
    ? section
    : { key: section.key, name: section.name, heading: oldHead(section) && `\n${oldHead(section)}`, rules: section.rules || [] };

/**
 * @param {object|null} stored سندِ ProductPromptConfig (lean) یا null
 * @returns {{document: Array, fieldRules: Array<{field, heading, rules}>, templates: Record<string,string>, groups: Array}}
 */
export function resolvePromptConfig(stored) {
  const groups = (Array.isArray(stored?.groups) ? stored.groups : []).map((group) => ({
    ...group,
    sections: (Array.isArray(group.sections) ? group.sections : []).map(upgradeGroupSection),
  }));
  const storedTemplates = asTemplates(stored?.templates);
  // قالبی که هنوز ذخیره نشده از seed می‌آید؛ متنِ خالی عمدی می‌ماند و قالبِ منسوخ کنار می‌رود
  const templates = {
    ...PROMPT_SEED.templates,
    ...Object.fromEntries(Object.entries(storedTemplates).filter(([key]) => TEMPLATE_KEYS.has(key))),
  };

  if (Array.isArray(stored?.document) && stored.document.length) {
    return {
      document: upgradeDocument(stored.document),
      fieldRules: upgradeFieldRules(stored.fieldRules, storedTemplates),
      templates,
      groups,
    };
  }
  return { ...upgradeLegacyBase(stored?.base), templates, groups };
}
