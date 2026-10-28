/**
 * src/lib/productPromptConfig.js
 *
 * تنظیماتِ پرامپتِ تولیدِ محصول: «پرامپت پایه» (قواعدِ تکیِ قابل‌ویرایش) و
 * «گروه‌های پرامپت دسته» — و تنها قاعده‌ی ترکیبِ آن‌ها با پرامپتِ خودِ دسته.
 *
 * خالص و بدونِ وابستگیِ سرور: هم buildProductTemplate (سرور)، هم روتِ API
 * (اعتبارسنجی) و هم صفحه‌ی پنل (پیش‌فرض‌ها و همان اعتبارسنجی) از همین فایل
 * می‌خوانند، پس «آنچه پنل نشان می‌دهد» و «آنچه در پرامپت می‌رود» یکی است.
 *
 * ترتیبِ قواعدِ هر فیلد ثابت است: پایه → گروه‌ها (به ترتیبِ گروه‌ها) → دسته.
 * قاعده‌ی تکراری (همان متن با چشم‌پوشی از فاصله‌ها و خط‌تیره‌ی اول) فقط بارِ
 * اول می‌آید. بخش‌های داده‌محور (شناسه‌ی ورزش/دسته، لیست‌ها، ساختارِ خروجی و…)
 * اینجا نیستند و در buildProductTemplate تولید می‌شوند.
 */

/* ─── پیش‌فرض‌های قدیمیِ صفحه‌ی «افزودن دسته» ──────────────────────────────
 * تا پیش از این سیستم، هر دسته‌ی تازه این متن‌ها را به‌عنوانِ پرامپتِ فیلد
 * ذخیره می‌کرد. حالا قواعدِ پایه‌اند و دسته‌ی تازه خالی شروع می‌شود؛ اما
 * دسته‌های قدیمی هنوز همین متن‌ها را دارند. چون قواعدِ پایه از روی همین
 * متن‌ها و با همان splitRuleUnits ساخته شده‌اند، کپیِ قدیمی در پرامپتِ نهایی
 * تکراری تشخیص داده و حذف می‌شود. scripts/checkCategoryPromptDefaults.mjs
 * دسته‌هایی را که هنوز کپیِ عینی دارند گزارش می‌کند. */
export const LEGACY_CATEGORY_PROMPT_DEFAULTS = {
  name: `- MUST strictly follow this exact pattern:
  "{Persian product type} {Persian brand name} {Exact model name from raw content}"
- Persian product type MUST be inferred from category and content (e.g. راکت تنیس)
- Persian brand name MUST be the Persian transliteration of the brand
  (e.g. Wilson → ویلسون, Nike → نایکی)
- Model name MUST be copied EXACTLY from raw content in English
- Do NOT translate, shorten, reorder, or modify the model name
- This rule overrides any other naming rule
Example:
Raw content: "Wilson Tour Slam Lite Adult Recreational Tennis Racket"
Correct name output:
"راکت تنیس ویلسون Tour Slam Lite"
      `,
  label: `- Choose ONE value ONLY from: ["none", "new", "hot", "discount", "limited"]
- If the text mentions things like "جدید" or "۲۰۲۴/۲۰۲۵" -> "new"
- If it's a best-seller or "پرفروش" -> "hot"
- If there is a clear discount mentioned in raw text -> "discount"
- If it says "تعداد محدود" or "نسخه محدود" -> "limited"
- DEFAULT is "none" if no specific label is detected.
      `,
  shortDescription: `- Persian
- 3 line concise sentences
- Marketing-friendly
- No emojis
      `,
  longDescription: `- Persian
- Detailed, structured
- Explain usage, benefits, materials if possible
- SEO-friendly but natural
      `,
  color: ` Read the provided product content carefully.
Detect and extract the product color code.
The color code may appear in formats like:
   - Color Code: 1234
   - Code: ABC-567
   - SKU variation with color identifier
   - Hex color format like #FFFFFF
 If multiple codes exist, select the one specifically related to color.
 If no color code exists, return null.`,
  basePrice: `- Number ONLY
- If price is missing, estimate realistically based on product type
- DO NOT write strings like "نامشخص"
      `,
  targetAudience: `- Decide who this specific product is actually made and marketed for.
- Prefer explicit signals in the raw content (e.g. "men's", "women's", "junior", "kids",
  "بزرگسال", "بچگانه", a junior size range, a youth-specific model name).
- If the product is made for children or juniors, always choose "بچگانه" — never "یونی سکس".
- Choose "یونی سکس" only for adult products genuinely suitable for both men and women.
- Never leave this field empty; pick the single best-fitting value.
      `,
  tag: `- Persian keywords
  - Array of short strings
  - Useful for search
      `,
};

/* ─── واحدِ قاعده ───────────────────────────────────────────────────────── */

const BULLET = /^\s*[-•]\s+/;

/**
 * متنِ آزاد را به «واحدهای قاعده» می‌شکند: هر خطی که با «- » شروع شود یک
 * واحدِ تازه است و خط‌های بعدیِ بدونِ خط‌تیره ادامه‌ی همان واحدند. فقط برای
 * تشخیصِ تکرار به کار می‌رود — متنِ دسته هرگز بازنویسی نمی‌شود مگر واحدی از
 * آن واقعاً تکراری باشد.
 */
export function splitRuleUnits(text) {
  const units = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (BULLET.test(line) || !units.length) units.push([line]);
    else units[units.length - 1].push(line);
  }
  return units.map((lines) => lines.join("\n").trim());
}

/** کلیدِ مقایسه‌ی تکرار: بدونِ خط‌تیره‌ی اول و با فاصله‌های یکسان‌شده. */
export const normalizeRule = (text) =>
  String(text ?? "").replace(BULLET, "").replace(/\s+/g, " ").trim();

/** قاعده‌ی ذخیره‌شده = یک واحد بدونِ «- » اول؛ رندر آن را برمی‌گرداند. */
const asRule = (unit) => unit.replace(BULLET, "");
const legacyRules = (field) => splitRuleUnits(LEGACY_CATEGORY_PROMPT_DEFAULTS[field]).map(asRule);

/* ─── فیلدها و بخش‌های پرامپت پایه ──────────────────────────────────────── */

export const PRODUCT_PROMPT_FIELDS = [
  { key: "name", title: "نام محصول" },
  { key: "shortDescription", title: "توضیح کوتاه" },
  { key: "longDescription", title: "توضیح کامل" },
  { key: "color", title: "رنگ" },
  { key: "basePrice", title: "قیمت پایه" },
  { key: "label", title: "لیبل محصول" },
  { key: "targetAudience", title: "مخاطب هدف" },
  { key: "score", title: "امتیاز", baseOnly: true },
  { key: "brand", title: "برند" },
  { key: "serie", title: "سری" },
  { key: "limitedEdition", title: "لیمیتد ادیشن" },
  { key: "sport", title: "ورزش", baseOnly: true, locked: "پیش از قواعد: «MUST be exactly: <شناسه‌ی ورزشِ دسته>»" },
  { key: "athlete", title: "ورزشکار" },
  { key: "category", title: "دسته‌بندی", baseOnly: true, locked: "پیش از قواعد: «MUST be exactly: <شناسه‌ی دسته>»" },
  { key: "attributes", title: "ویژگی‌های ثابت", locked: "پس از قواعد: قاعده‌ی ویژگی‌های محدود به مخاطب هدف (از تنظیمات ویژگی‌های دسته)" },
  { key: "variantOptions", title: "ویژگی‌های متغیر" },
  { key: "variantMeta", title: "متادیتای واریانت", locked: "پس از قواعد: دستورِ ویژگی‌های چندواحدیِ دسته" },
  { key: "technicalStats", title: "آمار فنی" },
  { key: "customTabItems", title: "آیتم‌های تب سفارشی", locked: "این فیلد فقط برای دسته‌ای که تب سفارشیِ فعال با آیتم دارد در پرامپت می‌آید" },
  { key: "tag", title: "تگ‌ها" },
  { key: "mainImage", title: "تصویر اصلی" },
  { key: "gallery", title: "گالری" },
];

/** فیلدهایی که گروه‌های دسته برایشان قاعده دارند — ورزش/دسته مقدارِ ثابت دارند. */
export const GROUP_PROMPT_FIELDS = PRODUCT_PROMPT_FIELDS.filter((f) => !f.baseOnly);
const GROUP_FIELD_KEYS = new Set(GROUP_PROMPT_FIELDS.map((f) => f.key));

export const BASE_PROMPT_SECTIONS = [
  { key: "role", title: "نقش مدل", style: "plain" },
  { key: "task", title: "قواعد کلی (برای همه‌ی محصولات)", style: "bullet" },
  { key: "output", title: "قواعد قالب خروجی", style: "numbered" },
  { key: "language", title: "قاعده‌ی زبان", style: "bullet" },
  ...PRODUCT_PROMPT_FIELDS.map((f) => ({ key: `field:${f.key}`, title: f.title, field: f.key, locked: f.locked, style: "bullet" })),
];
const SECTION_KEYS = new Set(BASE_PROMPT_SECTIONS.map((s) => s.key));

/** متنِ پرامپتِ پیشین، قاعده به قاعده. */
export const DEFAULT_BASE_PROMPT = {
  role: ["You are a senior Persian e-commerce product manager AI."],
  task: [
    "READ the raw product content provided below.",
    "EXTRACT and GENERATE a complete product JSON object.",
    "OUTPUT only the JSON — nothing else.",
  ],
  output: [
    "Output ONLY raw JSON. Start with { and end with }.",
    "NO markdown code fences (no ```json, no ```).",
    "NO explanations, comments, or text before or after the JSON.",
    "NO trailing commas anywhere.",
    "ALL string values must be wrapped in balanced double quotes.",
    "Validate JSON structure mentally before responding.",
    "If you detect any syntax error in your output, fix it before responding.",
    "Treat this output as production data — not a draft.",
  ],
  language: [
    "All human-readable content (name, descriptions, tag, etc.) → PERSIAN (fa-IR)",
    "JSON keys → Exactly as specified in the rules below (English)",
    'Attribute keys → MUST be the English KEY shown in "Category Attributes" section\n  DO NOT use Persian labels as keys — they are provided for context only.',
  ],
  "field:name": legacyRules("name"),
  "field:shortDescription": legacyRules("shortDescription"),
  "field:longDescription": legacyRules("longDescription"),
  // یک قاعده‌ی چندخطی: زیرخط‌های «- Color Code…» مثال‌اند، نه قاعده‌ی جدا
  "field:color": [LEGACY_CATEGORY_PROMPT_DEFAULTS.color.trim()],
  "field:basePrice": legacyRules("basePrice"),
  // «Allowed values: new | discount | best_seller» قبلی با enumِ مدلِ Product
  // نمی‌خواند؛ قاعده‌ی اولِ همین لیست دقیقاً همان enum را می‌گوید.
  "field:label": legacyRules("label"),
  "field:targetAudience": [
    ...legacyRules("targetAudience"),
    'Allowed values only: "مردانه" | "زنانه" | "بچگانه" | "یونی سکس"',
    "Choose exactly ONE based on who the product is actually made/marketed for.",
    'Use "یونی سکس" only when the product is genuinely suitable for both adults: men AND women.',
    'IMPORTANT: "یونی سکس" NEVER includes children. If the product is made for children, use "بچگانه".',
    'For general-purpose products (e.g. balls, courts, general accessories), choose "یونی سکس" only when\n  they are intended for adult men and women and no child-specific signal exists.',
  ],
  "field:score": ["DO NOT include this field at all."],
  "field:brand": [
    "Choose exactly ONE id from AVAILABLE BRANDS.",
    "Match by semantic meaning. Do NOT guess.",
  ],
  "field:serie": [
    'Choose exactly ONE id from AVAILABLE SERIES — OR an empty string "" if none matches.',
    'CRITICAL: The chosen serie\'s "parentBrandId" MUST match your selected brand\'s id.',
    'If a series is mentioned in the text but belongs to a different brand, ignore it and return "".',
    "A product can only have a serie from its own brand.",
  ],
  "field:limitedEdition": [
    "Limited editions are brand-specific special releases (e.g. Wilson's Roland Garros).",
    'Choose exactly ONE id from AVAILABLE LIMITED EDITIONS — OR an empty string "" if none applies.',
    'CRITICAL: The chosen limited edition\'s "parentBrandId" MUST match your selected brand\'s id.',
    'If a limited edition is mentioned in the text but belongs to a different brand, ignore it and return "".',
    "Only pick a limited edition if the raw content clearly and explicitly mentions it.",
    "A product can have BOTH a serie and a limited edition at the same time.",
  ],
  "field:sport": [
    "This is the selected category's owning sport. Do NOT change this value.",
    "Do NOT infer or select a sport from the raw content, product name, or category name.",
  ],
  "field:athlete": [
    "Pick ALL relevant athlete ids from AVAILABLE ATHLETES as a JSON array.",
    "If none mentioned → return [].",
  ],
  "field:category": ["Do NOT change this value."],
  "field:attributes": [
    "This is a flat JSON object of single string or number values.",
    'Keys MUST be the exact English "KEY" field defined in "Category Attributes" below.\n  ✗ Wrong: { "اندازه صفحه": "100" }\n  ✓ Correct: { "Head Size": "100" }',
    "If a value is NOT found in raw content:\n  - If the attribute is logically required → infer it from professional knowledge.\n  - If it is optional → omit the key entirely.",
  ],
  "field:variantOptions": [
    "This is a flat JSON object where each value is an ARRAY of strings.",
    'Keys MUST be the exact English "KEY" field defined in "Variant Attributes" below.',
    'Extract EVERY value mentioned in the raw content for each key.\n  Example: { "Grip": ["L2", "L3", "L4"] }',
    "If no variant attributes are defined → return {}.",
    "For normal/non-unit variant attributes, keep the current behavior: array of plain strings.",
    `For multi-unit variant attributes:
  - variantOptions MUST still be an array of strings, never objects.
  - Put ONLY the primary unit values in variantOptions. The primary unit is the first unit listed for that attribute.
  - Put all unit conversions/display values in variantMeta, keyed by the same primary value.
  - DO NOT write combined strings like "EU 47 / CM 30.5" in variantOptions.
  - DO NOT create separate variants for secondary units. Secondary units are display metadata only.
  - Preserve fractional or half-step values exactly as strings, e.g. "47 1/3" or "36.5" — only if the raw content actually
    uses that format for this product; do not invent fractional formatting that isn't present in the source.
  - If the raw content states a RANGE of sizes (e.g. "36 to 46") instead of listing each one, expand it into every individual
    size in that range — do not shorten it to just a couple of example values.
  - Every value you place in variantMeta.<key>.<value>.units MUST be a real, accurate, mutually-consistent conversion of that
    exact size across all listed units (use standard real-world conversion tables for this product type). Never derive a
    secondary unit value by an arbitrary formula or pattern — only use correct, known conversions.`,
  ],
  "field:variantMeta": [
    "This is a JSON object for value-level variant metadata.",
    "Always include this field. If there is no metadata → return {}.",
    `Shape:
  {
    "variantAttributeKey": {
      "variantOptionPrimaryValue": {
        "units": { "unitLabel": "value as string" },
        "images": []
      }
    }
  }`,
    "For every multi-unit variant value, variantMeta is REQUIRED.",
    "The variantMeta key must exactly match a value from variantOptions for the same attribute.",
    "The units object must include every unit label defined for that attribute, including the primary unit.",
    "Use strings for unit values, even when they look numeric.",
    "If an attribute is not multi-unit, do not add units for it. You may omit it from variantMeta unless value-level images are explicitly available.",
  ],
  "field:technicalStats": [
    "A flat JSON object for radar chart scoring.",
    'Keys MUST exactly match the names in "Category Technical Stats" below.',
    "Values MUST be integers between 0 and 100.",
    "Use professional judgment when the raw content does not explicitly state a score.",
    "If no technical stats are defined for this category → return {}.",
  ],
  "field:customTabItems": [
    "customTabItems must be a plain array of strings, each EXACTLY matching one of the titles listed below (character-for-character).",
    "Pick ONLY the titles that genuinely apply to this specific product based on the raw content.",
    "Do not paraphrase, translate, or invent new titles not in the list.",
    "Omit this field entirely (or use an empty array) if none of the listed items apply to this product.",
  ],
  "field:tag": [
    ...legacyRules("tag"),
    "Must be a JSON array of Persian strings.",
    "If none → return [].",
  ],
  "field:mainImage": [
    "A direct image URL string if available in raw content.",
    'If not found → return "".',
  ],
  "field:gallery": [
    "An array of direct image URL strings.",
    "If none found → return [].",
  ],
};

/**
 * بخش‌های ذخیره‌شده را روی پیش‌فرض‌ها می‌نشاند. بخشی که ذخیره نشده پیش‌فرض
 * می‌گیرد؛ بخشی که با [] ذخیره شده عمداً خالی است (undefined ≠ []).
 * @returns {Record<string, string[]>}
 */
export function resolveBasePrompt(storedBase) {
  const stored = new Map(
    (Array.isArray(storedBase) ? storedBase : [])
      .filter((s) => SECTION_KEYS.has(s?.section) && Array.isArray(s.rules))
      .map((s) => [s.section, s.rules]),
  );
  return Object.fromEntries(
    BASE_PROMPT_SECTIONS.map(({ key }) => [key, [...(stored.get(key) ?? DEFAULT_BASE_PROMPT[key])]]),
  );
}

/* ─── اعتبارسنجی ─────────────────────────────────────────────────────────── */

export const PROMPT_LIMITS = { ruleLength: 4000, rulesPerSection: 100, groups: 100, rulesPerGroup: 500, titleLength: 120 };
const OBJECT_ID = /^[a-f\d]{24}$/i;
const idList = (value) => (Array.isArray(value) ? value.map((id) => String(id?._id ?? id)) : null);

/**
 * کلِ تنظیمات را اعتبارسنجی و پاک‌سازی می‌کند — همان تابع در سرور و پنل.
 *
 * @param {object} input            { base: [{section, rules}], groups: [{title, categories, rules: [{field, text, categories}]}] }
 * @param {object} opts
 * @param {Set<string>} opts.knownCategoryIds  دسته‌هایی که مجازند: موجود در دیتابیس ∪ همان‌هایی که قبلاً
 *   ذخیره شده بودند (دسته‌ی حذف‌شده بی‌صدا می‌ماند و قاعده‌اش غیرفعال است، ولی دسته‌ی ناموجودِ تازه رد می‌شود)
 * @returns {{ value: object|null, errors: Array<{path: string, message: string}> }}
 */
export function validatePromptConfig(input, { knownCategoryIds = null } = {}) {
  const errors = [];
  const fail = (path, message) => errors.push({ path, message });
  const known = (id) => !knownCategoryIds || knownCategoryIds.has(id);

  const checkRuleText = (text, path) => {
    if (typeof text !== "string" || !text.trim()) {
      fail(path, "متن قاعده خالی است");
      return null;
    }
    if (text.length > PROMPT_LIMITS.ruleLength) {
      fail(path, `متن قاعده بیش از ${PROMPT_LIMITS.ruleLength} نویسه است`);
      return null;
    }
    return text.trim();
  };

  // ── پایه
  const base = [];
  const seenSections = new Set();
  for (const [i, section] of (Array.isArray(input?.base) ? input.base : []).entries()) {
    const key = section?.section;
    if (!SECTION_KEYS.has(key)) { fail(`base.${i}`, "بخشِ ناشناخته"); continue; }
    if (seenSections.has(key)) { fail(`base.${key}`, "بخشِ تکراری"); continue; }
    seenSections.add(key);
    if (!Array.isArray(section.rules)) { fail(`base.${key}`, "قواعد باید آرایه باشند"); continue; }
    if (section.rules.length > PROMPT_LIMITS.rulesPerSection) fail(`base.${key}`, `حداکثر ${PROMPT_LIMITS.rulesPerSection} قاعده`);
    const seen = new Set();
    const rules = [];
    section.rules.forEach((raw, r) => {
      const text = checkRuleText(raw, `base.${key}.${r}`);
      if (text === null) return;
      if (seen.has(normalizeRule(text))) return fail(`base.${key}.${r}`, "این قاعده در همین بخش تکراری است");
      seen.add(normalizeRule(text));
      rules.push(text);
    });
    base.push({ section: key, rules });
  }

  // ── گروه‌ها
  const rawGroups = Array.isArray(input?.groups) ? input.groups : [];
  if (rawGroups.length > PROMPT_LIMITS.groups) fail("groups", `حداکثر ${PROMPT_LIMITS.groups} گروه`);
  const groups = rawGroups.map((group, g) => {
    const at = `groups.${g}`;
    const title = typeof group?.title === "string" ? group.title.trim() : "";
    if (title.length > PROMPT_LIMITS.titleLength) fail(`${at}.title`, "عنوانِ گروه خیلی بلند است");

    const categories = idList(group?.categories) ?? [];
    if (!categories.length) fail(`${at}.categories`, "حداقل یک دسته برای گروه انتخاب کنید");
    if (new Set(categories).size !== categories.length) fail(`${at}.categories`, "دسته‌ی تکراری در گروه");
    categories.forEach((id) => {
      if (!OBJECT_ID.test(id) || !known(id)) fail(`${at}.categories`, `دسته‌ی «${id}» وجود ندارد`);
    });
    const inGroup = new Set(categories);

    const rawRules = Array.isArray(group?.rules) ? group.rules : [];
    if (rawRules.length > PROMPT_LIMITS.rulesPerGroup) fail(`${at}.rules`, `حداکثر ${PROMPT_LIMITS.rulesPerGroup} قاعده در هر گروه`);
    const seen = new Set();
    const rules = [];
    rawRules.forEach((rule, r) => {
      const path = `${at}.rules.${r}`;
      if (!GROUP_FIELD_KEYS.has(rule?.field)) return fail(path, "فیلدِ ناشناخته");
      const text = checkRuleText(rule.text, path);
      const targets = idList(rule.categories ?? []);
      if (!targets) return fail(path, "دسته‌های قاعده باید آرایه باشند");
      if (new Set(targets).size !== targets.length) fail(path, "دسته‌ی تکراری در قاعده");
      // عضوِ گروه نبودن یعنی قاعده به دسته‌ای اشاره می‌کند که از گروه برداشته شده:
      // خالی‌کردنِ بی‌صدای آن، قاعده را به «همه‌ی دسته‌ها» گسترش می‌داد.
      if (targets.some((id) => !inGroup.has(id))) fail(path, "این قاعده به دسته‌ای اشاره می‌کند که در این گروه نیست");
      if (text === null) return;
      const dup = `${rule.field}\u0000${normalizeRule(text)}`;
      if (seen.has(dup)) return fail(path, "همین قاعده برای همین فیلد در این گروه تکراری است؛ دسته‌ها را در یک قاعده ترکیب کنید");
      seen.add(dup);
      rules.push({ field: rule.field, text, categories: targets });
    });
    return { title, categories, rules };
  });

  return { value: errors.length ? null : { base, groups }, errors };
}

/* ─── ترکیب برای یک دسته ────────────────────────────────────────────────── */

/**
 * قواعدِ هر فیلد برای دسته‌ی داده‌شده: { base, groups, category } که تکرارها از آن‌ها
 * حذف شده‌اند. category متنِ آزادِ خودِ دسته است (یا null).
 *
 * قاعده‌ی گروه وقتی اعمال می‌شود که دسته عضوِ گروه باشد و (قاعده هیچ دسته‌ای
 * نداشته باشد یا این دسته در دسته‌های قاعده باشد). قاعده‌ای که همه‌ی دسته‌هایش
 * حذف شده‌اند خودبه‌خود به هیچ دسته‌ای نمی‌خورد — هرگز به «همه» گسترش نمی‌یابد.
 */
export function resolveFieldRules({ base, groups = [], categoryId, field, categoryText = "" }) {
  const id = String(categoryId);
  const seen = new Set();
  const take = (text) => {
    const units = splitRuleUnits(text).map(normalizeRule);
    const fresh = !seen.has(normalizeRule(text)) && units.some((u) => !seen.has(u));
    seen.add(normalizeRule(text));
    units.forEach((u) => seen.add(u));
    return fresh;
  };

  const baseRules = (base[`field:${field}`] || []).filter(take);
  const groupRules = [];
  for (const group of groups) {
    if (!(group.categories || []).map(String).includes(id)) continue;
    for (const rule of group.rules || []) {
      if (rule.field !== field) continue;
      const targets = (rule.categories || []).map(String);
      if (targets.length && !targets.includes(id)) continue;
      if (take(rule.text)) groupRules.push(rule.text);
    }
  }

  let category = String(categoryText ?? "").trim() || null;
  if (category) {
    const units = splitRuleUnits(category);
    const kept = units.filter((u) => !seen.has(normalizeRule(u)));
    if (kept.length !== units.length) category = kept.length ? kept.join("\n") : null;
  }
  return { base: baseRules, groups: groupRules, category };
}

/* ─── رندر ──────────────────────────────────────────────────────────────── */

export const bulletRule = (text) => `- ${text}`;
export const numberedRule = (text, i) => `${i + 1}. ${text}`;

export const FIELD_PRECEDENCE_NOTE =
  "Each field's rules are listed from general to specific: base rules first, then category-group rules, then this category's own rules\n" +
  "(the per-attribute Extraction Rules and variant Guides in CATEGORY DEFINITION are also this category's own rules).\n" +
  "When two rules conflict, follow the more specific one.";

/**
 * یک فیلدِ «FIELD RULES»: قیدهای قفلِ «پیش»، قواعدِ پایه، قیدهای قفلِ «پس»،
 * سپس گروه و دسته — هر کدام با یک سطرِ عنوان تا تقدم روشن باشد.
 */
export function renderFieldRules(field, { before = [], after = [], rules }) {
  const lines = [...before, ...rules.base.map(bulletRule), ...after];
  if (rules.groups.length) {
    lines.push("Category-group rules (more specific — override the rules above on conflict):");
    lines.push(...rules.groups.map(bulletRule));
  }
  if (rules.category) {
    lines.push("Category-specific rules (most specific — override every rule above on conflict):");
    lines.push(rules.category);
  }
  return `${field}:\n${lines.length ? lines.join("\n") : "No specific rule defined."}`;
}
