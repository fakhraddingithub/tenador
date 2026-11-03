/**
 * src/lib/productPromptConfig.js
 *
 * ساختارِ «تنظیماتِ پرامپتِ تولیدِ محصول» — بدونِ هیچ متنِ پرامپت. همه‌ی متن‌ها (عنوان‌ها،
 * جداکننده‌ها، توضیح‌ها، قواعد و قالبِ سطرهای داده) مالِ ادمین‌اند و در دیتابیس می‌مانند؛
 * نقطه‌ی شروع در productPromptSeed.json است (productPromptResolve.js).
 *
 * خالص و بدونِ وابستگیِ سرور: buildProductTemplate (سرور)، روتِ API و صفحه‌های پنل همگی
 * از همین فایل می‌خوانند، پس «آنچه پنل قبول می‌کند» و «آنچه در پرامپت می‌رود» یکی است.
 *
 * شکلِ تنظیمات:
 *   document   : بخش‌های پرامپت به ترتیب. kind: text | fields (جای قواعدِ فیلدها) | groups (جای قواعدِ عمومیِ گروه‌ها)
 *   fieldRules : قواعدِ پایه‌ی هر فیلدِ ثابتِ محصول
 *   templates  : قالبِ سطرهای داده‌محور (TEMPLATE_DEFS)
 *   groups     : گروه‌ها — rules (قواعدِ فیلدها) و sections (قواعدِ عمومیِ خودِ گروه)
 *
 * هر متن همان‌طور که ادمین نوشته در پرامپت می‌آید؛ کد نه شماره می‌زند نه پیشوند. تنها
 * جایگزینی، placeholderهای {{نام}} است.
 */

/* ─── واحدِ قاعده (فقط برای تشخیصِ تکرار) ───────────────────────────────── */

const BULLET = /^\s*[-•]\s+/;

/**
 * متنِ آزاد را به «واحدهای قاعده» می‌شکند: هر خطی که با «- » شروع شود یک واحدِ تازه است و
 * خط‌های بعدیِ بدونِ خط‌تیره ادامه‌ی همان واحدند. فقط برای تشخیصِ تکرار به کار می‌رود — متنِ
 * دسته هرگز بازنویسی نمی‌شود مگر واحدی از آن واقعاً تکراری باشد.
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

/* ─── فیلدها ────────────────────────────────────────────────────────────── */

/** فیلدهای ثابتِ محصول. تعریفشان مالِ مدلِ Product است؛ اینجا فقط کلید و نامِ نمایشی. */
export const PRODUCT_PROMPT_FIELDS = [
  { key: "name", title: "نام محصول" },
  { key: "shortDescription", title: "توضیح کوتاه" },
  { key: "longDescription", title: "توضیح کامل" },
  { key: "color", title: "رنگ" },
  { key: "basePrice", title: "قیمت پایه" },
  { key: "label", title: "لیبل محصول" },
  { key: "targetAudience", title: "مخاطب هدف" },
  { key: "score", title: "امتیاز" },
  { key: "brand", title: "برند" },
  { key: "serie", title: "سری" },
  { key: "limitedEdition", title: "لیمیتد ادیشن" },
  { key: "sport", title: "ورزش" },
  { key: "athlete", title: "ورزشکار" },
  { key: "category", title: "دسته‌بندی" },
  { key: "attributes", title: "ویژگی‌های ثابت" },
  { key: "variantOptions", title: "ویژگی‌های متغیر" },
  { key: "variantMeta", title: "متادیتای واریانت" },
  { key: "technicalStats", title: "آمار فنی" },
  { key: "customTabItems", title: "آیتم‌های تب سفارشی" },
  { key: "tag", title: "تگ‌ها" },
  { key: "mainImage", title: "تصویر اصلی" },
  { key: "gallery", title: "گالری" },
];
const FIXED_FIELD_KEYS = new Set(PRODUCT_PROMPT_FIELDS.map((f) => f.key));

/**
 * فیلدهایی که بخشِ «تنظیمات هوش مصنوعی» در فرمِ دسته برایشان پرامپت دارد —
 * تنها منبعِ این لیست؛ هر دو صفحه‌ی افزودن/ویرایشِ دسته از همین می‌خوانند.
 */
export const CATEGORY_PROMPT_FIELDS = [
  "name", "label", "shortDescription", "longDescription", "color", "basePrice", "targetAudience", "tag",
];

/**
 * فیلدهای پویا: تعریفشان در خودِ هر دسته است (ویژگی‌ها، شاخص‌ها، آیتم‌های تب). قاعده‌ی گروه با
 * کلیدِ «نوع:نام» به آن‌ها اشاره می‌کند و فقط روی دسته‌ای اعمال می‌شود که آن فیلد را دارد.
 */
export const DYNAMIC_FIELD_KINDS = [
  { kind: "attribute", title: "ویژگی‌های ثابت" },
  { kind: "variant", title: "ویژگی‌های متغیر" },
  { kind: "stat", title: "شاخص‌های فنی" },
  { kind: "tabItem", title: "آیتم‌های تب سفارشی" },
];
const DYNAMIC_FIELD = /^(attribute|variant|stat|tabItem):([\s\S]+)$/;

export const dynamicFieldKey = (kind, name) => `${kind}:${name}`;

/** @returns {{kind: string, name: string}|null} kind = "fixed" یا یکی از DYNAMIC_FIELD_KINDS */
export function parseFieldKey(key) {
  if (FIXED_FIELD_KEYS.has(key)) return { kind: "fixed", name: key };
  const match = DYNAMIC_FIELD.exec(String(key ?? ""));
  return match ? { kind: match[1], name: match[2] } : null;
}

export const fieldTitle = (key) => {
  const parsed = parseFieldKey(key);
  if (parsed?.kind === "fixed") return PRODUCT_PROMPT_FIELDS.find((f) => f.key === key).title;
  return parsed?.name || key;
};

/* ─── placeholderها و قالب‌ها ───────────────────────────────────────────── */

export const SOURCE_TEXT_TOKEN = "source_text";

/** آنچه کد در متن‌های ادمین جای می‌گذارد. جز source_text همه اختیاری‌اند. */
export const PROMPT_TOKENS = [
  { key: SOURCE_TEXT_TOKEN, label: "متن خام محصول (اجباری، دقیقاً یک بار، فقط در بخش‌های پرامپت)" },
  { key: "category_title", label: "نام دسته" },
  { key: "category_id", label: "شناسه‌ی دسته" },
  { key: "sport_name", label: "نام انگلیسی ورزش" },
  { key: "sport_title", label: "نام فارسی ورزش" },
  { key: "sport_id", label: "شناسه‌ی ورزش" },
  { key: "brands", label: "فهرست JSON برندها" },
  { key: "athletes", label: "فهرست JSON ورزشکاران" },
  { key: "series", label: "فهرست JSON سری‌ها" },
  { key: "limited_editions", label: "فهرست JSON لیمیتد ادیشن‌ها" },
  { key: "attributes", label: "ویژگی‌های ثابت دسته" },
  { key: "variant_attributes", label: "ویژگی‌های متغیر دسته" },
  { key: "multi_unit_rule", label: "دستور ویژگی‌های چندواحدی" },
  { key: "multi_unit_definition", label: "تعریف ویژگی‌های چندواحدی" },
  { key: "audience_rule", label: "قاعده‌ی ویژگی‌های محدود به مخاطب" },
  { key: "technical_stats", label: "شاخص‌های فنی دسته" },
  { key: "custom_tab", label: "تب سفارشی و آیتم‌هایش (بدون تب: خالی)" },
  { key: "custom_tab_name", label: "نام تب سفارشی" },
  { key: "custom_tab_output", label: "سطر customTabItems در ساختار خروجی (بدون تب: خالی)" },
];
const PROMPT_TOKEN_KEYS = new Set(PROMPT_TOKENS.map((t) => t.key));

/** قالب‌ها: کلید، گروهِ نمایش، توضیحِ فارسی و placeholderهای خودِ آن قالب. متنشان در دیتابیس است. */
export const TEMPLATE_DEFS = [
  { key: "field_heading", group: "قواعد فیلدها", label: "عنوان هر فیلد", tokens: ["field"] },
  { key: "field_empty", group: "قواعد فیلدها", label: "فیلدی که هیچ قاعده‌ای ندارد", tokens: [] },
  { key: "group_heading", group: "قواعد فیلدها", label: "عنوان بالای قواعد گروه در هر فیلد", tokens: [] },
  { key: "category_heading", group: "قواعد فیلدها", label: "عنوان بالای قاعده‌ی دسته در هر فیلد", tokens: [] },

  { key: "attribute_line", group: "ویژگی‌های ثابت", label: "سطر هر ویژگی", tokens: ["name", "label", "rules", "scope"] },
  { key: "attribute_rule", group: "ویژگی‌های ثابت", label: "هر قاعده‌ی ویژگی (در {{rules}})", tokens: ["text"] },
  { key: "attribute_scope", group: "ویژگی‌های ثابت", label: "محدودیت مخاطب ویژگی (در {{scope}})", tokens: ["audiences"] },
  { key: "attributes_empty", group: "ویژگی‌های ثابت", label: "دسته‌ی بدون ویژگی", tokens: [] },
  { key: "audience_rule", group: "ویژگی‌های ثابت", label: "قاعده‌ی ویژگی‌های محدود به مخاطب", tokens: ["items"] },
  { key: "audience_rule_item", group: "ویژگی‌های ثابت", label: "هر ویژگیِ محدود (در {{items}})", tokens: ["name", "label", "audiences"] },
  { key: "audience_rule_empty", group: "ویژگی‌های ثابت", label: "وقتی هیچ ویژگی‌ای محدود نیست", tokens: [] },

  { key: "variant_line", group: "ویژگی‌های متغیر", label: "سطر هر ویژگی متغیر", tokens: ["name", "label", "rules"] },
  { key: "variant_multi_unit_line", group: "ویژگی‌های متغیر", label: "سطر ویژگی متغیر چندواحدی", tokens: ["name", "label", "primary_unit", "units", "rules"] },
  { key: "variant_rule", group: "ویژگی‌های متغیر", label: "هر قاعده‌ی ویژگی متغیر (در {{rules}})", tokens: ["text"] },
  { key: "variants_empty", group: "ویژگی‌های متغیر", label: "دسته‌ی بدون ویژگی متغیر", tokens: [] },
  { key: "multi_unit_item", group: "ویژگی‌های متغیر", label: "توضیح هر ویژگی چندواحدی", tokens: ["name", "label", "primary_unit", "units", "placeholder_units"] },
  { key: "multi_unit_placeholder", group: "ویژگی‌های متغیر", label: "نمونه‌ی مقدار هر واحد (در {{placeholder_units}})", tokens: ["unit"] },
  { key: "multi_unit_rule", group: "ویژگی‌های متغیر", label: "دستور چندواحدی", tokens: ["items"] },
  { key: "multi_unit_rule_empty", group: "ویژگی‌های متغیر", label: "دستور چندواحدی وقتی چنین ویژگی‌ای نیست", tokens: [] },
  { key: "multi_unit_definition", group: "ویژگی‌های متغیر", label: "تعریف چندواحدی", tokens: ["items"] },
  { key: "multi_unit_definition_empty", group: "ویژگی‌های متغیر", label: "تعریف چندواحدی وقتی چنین ویژگی‌ای نیست", tokens: [] },

  { key: "technical_stat_line", group: "شاخص‌های فنی", label: "سطر هر شاخص", tokens: ["name", "label", "rules"] },
  { key: "technical_stat_rule", group: "شاخص‌های فنی", label: "هر قاعده‌ی شاخص (در {{rules}})", tokens: ["text"] },
  { key: "technical_stats_empty", group: "شاخص‌های فنی", label: "دسته‌ی بدون شاخص", tokens: [] },

  { key: "custom_tab", group: "تب سفارشی", label: "متن تب سفارشی", tokens: ["items", "custom_tab_name"] },
  { key: "custom_tab_item", group: "تب سفارشی", label: "سطر هر آیتم", tokens: ["title", "rules"] },
  { key: "custom_tab_item_rule", group: "تب سفارشی", label: "هر قاعده‌ی آیتم (در {{rules}})", tokens: ["text"] },
  { key: "custom_tab_output", group: "تب سفارشی", label: "سطر customTabItems در ساختار خروجی", tokens: [] },
];
const TEMPLATE_KEYS = new Set(TEMPLATE_DEFS.map((t) => t.key));

const TOKEN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * placeholderها را در یک گذر جایگزین می‌کند. مقدارِ جایگذاری‌شده دوباره بررسی نمی‌شود، پس
 * «{{brands}}» داخلِ متنِ خامِ محصول متن می‌ماند. placeholderِ ناشناخته دست‌نخورده می‌ماند.
 */
export const expandTokens = (text, values) =>
  String(text ?? "").replace(TOKEN, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );

const tokensIn = (text) => [...String(text ?? "").matchAll(TOKEN)].map((m) => m[1]);

/** placeholderهایی که این متن دارد ولی شناخته نیستند — فقط برای هشدار در پنل. */
export const unknownTokens = (text, allowed = PROMPT_TOKEN_KEYS) => {
  const known = allowed instanceof Set ? allowed : new Set(allowed);
  return [...new Set(tokensIn(text).filter((key) => !known.has(key)))];
};

/* ─── اعتبارسنجی ─────────────────────────────────────────────────────────── */

export const PROMPT_LIMITS = {
  ruleLength: 4000,
  rulesPerSection: 100,
  sections: 60,
  groups: 100,
  rulesPerGroup: 500,
  titleLength: 120,
  textLength: 20000,
  blankLines: 10,
};
const OBJECT_ID = /^[a-f\d]{24}$/i;
const SECTION_KEY = /^[\w-]{1,60}$/;
const SECTION_TEXTS = ["top", "title", "bottom", "description"];
const idList = (value) => (Array.isArray(value) ? value.map((id) => String(id?._id ?? id)) : null);
const lineCount = (value, fallback) => {
  const n = value === undefined ? fallback : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= PROMPT_LIMITS.blankLines ? n : null;
};

/**
 * تنظیمات را اعتبارسنجی و پاک‌سازی می‌کند — همان تابع در سرور و پنل. هر بخش اختیاری است
 * (undefined ≠ [])؛ بخشِ نفرستاده در خروجی هم undefined می‌ماند تا روت آن را دست نزند.
 * متن‌ها دقیقاً همان‌طور که نوشته شده‌اند نگه داشته می‌شوند (بدونِ trim).
 *
 * @param {object} input { document?, fieldRules?: [{field, rules}], templates?: {key: text}, groups? }
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
    if (tokensIn(text).includes(SOURCE_TEXT_TOKEN) && !path.startsWith("document.")) {
      fail(path, `{{${SOURCE_TEXT_TOKEN}}} فقط در بخش‌های پرامپت پایه مجاز است`);
      return null;
    }
    return text;
  };

  /** بخشِ پرامپت (پایه یا گروه) بدونِ قواعدش. */
  const cleanSectionHead = (section, path, seenKeys, seenNames) => {
    const key = section?.key;
    if (typeof key !== "string" || !SECTION_KEY.test(key)) fail(path, "شناسه‌ی بخش نامعتبر است");
    else if (seenKeys.has(key)) fail(path, "شناسه‌ی بخش تکراری است");
    else seenKeys.add(key);

    const name = typeof section?.name === "string" ? section.name.trim() : "";
    if (!name) fail(`${path}.name`, "نام بخش را وارد کنید");
    else if (name.length > PROMPT_LIMITS.titleLength) fail(`${path}.name`, "نام بخش خیلی بلند است");
    else if (seenNames.has(name)) fail(`${path}.name`, "بخشی با همین نام وجود دارد");
    else seenNames.add(name);

    const head = { key, name };
    for (const part of SECTION_TEXTS) {
      const value = section?.[part] ?? "";
      if (typeof value !== "string") { fail(`${path}.${part}`, "متن نامعتبر است"); continue; }
      if (value.length > PROMPT_LIMITS.textLength) fail(`${path}.${part}`, "متن خیلی بلند است");
      head[part] = value;
    }
    const blankLines = lineCount(section?.blankLines, 1);
    if (blankLines === null) fail(`${path}.blankLines`, `فاصله باید عددی بین ۰ تا ${PROMPT_LIMITS.blankLines} باشد`);
    head.blankLines = blankLines;
    return head;
  };

  // ── بخش‌های پرامپت پایه
  const document = input?.document === undefined ? undefined : [];
  if (document) {
    if (!Array.isArray(input.document)) fail("document", "بخش‌های پرامپت باید آرایه باشند");
    const raw = Array.isArray(input.document) ? input.document : [];
    if (raw.length > PROMPT_LIMITS.sections) fail("document", `حداکثر ${PROMPT_LIMITS.sections} بخش`);
    const seenKeys = new Set();
    const seenNames = new Set();
    const kinds = { fields: 0, groups: 0 };
    let sourceSlots = 0;
    for (const [i, section] of raw.entries()) {
      const path = `document.${section?.key ?? i}`;
      const kind = section?.kind;
      if (!["text", "fields", "groups"].includes(kind)) { fail(path, "نوع بخش نامعتبر است"); continue; }
      if (kind !== "text") kinds[kind] += 1;
      const clean = { ...cleanSectionHead(section, path, seenKeys, seenNames), kind, rules: [] };
      if (kind === "fields") {
        clean.fieldBlankLines = lineCount(section.fieldBlankLines, 1);
        if (clean.fieldBlankLines === null) fail(`${path}.fieldBlankLines`, `فاصله باید عددی بین ۰ تا ${PROMPT_LIMITS.blankLines} باشد`);
      }
      if (kind === "text") {
        const rules = Array.isArray(section.rules) ? section.rules : [];
        if (rules.length > PROMPT_LIMITS.rulesPerSection) fail(path, `حداکثر ${PROMPT_LIMITS.rulesPerSection} قاعده`);
        const seen = new Set();
        rules.forEach((raw_, r) => {
          const text = checkRuleText(raw_, `${path}.rules.${r}`);
          if (text === null) return;
          if (seen.has(normalizeRule(text))) return fail(`${path}.rules.${r}`, "این قاعده در همین بخش تکراری است");
          seen.add(normalizeRule(text));
          clean.rules.push(text);
        });
      }
      sourceSlots += [...SECTION_TEXTS.map((part) => clean[part]), ...clean.rules]
        .flatMap(tokensIn).filter((t) => t === SOURCE_TEXT_TOKEN).length;
      document.push(clean);
    }
    if (Array.isArray(input.document)) {
      if (kinds.fields !== 1) fail("document", "بخش «قواعد فیلدها» باید دقیقاً یک بار وجود داشته باشد");
      if (kinds.groups !== 1) fail("document", "جای «قواعد عمومی گروه‌ها» باید دقیقاً یک بار وجود داشته باشد");
      if (sourceSlots !== 1) {
        fail("document", `{{${SOURCE_TEXT_TOKEN}}} باید دقیقاً یک بار در بخش‌های پرامپت بیاید؛ بدونِ آن هوش مصنوعی متن محصول را نمی‌بیند (الان: ${sourceSlots} بار)`);
      }
    }
  }

  // ── قواعدِ پایه‌ی فیلدها
  const fieldRules = input?.fieldRules === undefined ? undefined : [];
  if (fieldRules) {
    if (!Array.isArray(input.fieldRules)) fail("fieldRules", "قواعد فیلدها باید آرایه باشند");
    const seenFields = new Set();
    for (const [i, entry] of (Array.isArray(input.fieldRules) ? input.fieldRules : []).entries()) {
      const field = entry?.field;
      if (!FIXED_FIELD_KEYS.has(field)) { fail(`fieldRules.${i}`, "فیلد ناشناخته"); continue; }
      if (seenFields.has(field)) { fail(`fieldRules.${field}`, "فیلد تکراری"); continue; }
      seenFields.add(field);
      if (!Array.isArray(entry.rules)) { fail(`fieldRules.${field}`, "قواعد باید آرایه باشند"); continue; }
      if (entry.rules.length > PROMPT_LIMITS.rulesPerSection) fail(`fieldRules.${field}`, `حداکثر ${PROMPT_LIMITS.rulesPerSection} قاعده`);
      const seen = new Set();
      const rules = [];
      entry.rules.forEach((raw, r) => {
        const text = checkRuleText(raw, `fieldRules.${field}.${r}`);
        if (text === null) return;
        if (seen.has(normalizeRule(text))) return fail(`fieldRules.${field}.${r}`, "این قاعده در همین فیلد تکراری است");
        seen.add(normalizeRule(text));
        rules.push(text);
      });
      fieldRules.push({ field, rules });
    }
  }

  // ── قالب‌ها: متنِ خالی مجاز است (یعنی آن قطعه چیزی چاپ نکند)
  let templates;
  if (input?.templates !== undefined) {
    templates = {};
    if (!input.templates || typeof input.templates !== "object" || Array.isArray(input.templates)) {
      fail("templates", "قالب‌ها نامعتبرند");
    } else {
      for (const [key, value] of Object.entries(input.templates)) {
        if (!TEMPLATE_KEYS.has(key)) { fail(`templates.${key}`, "قالب ناشناخته"); continue; }
        if (typeof value !== "string") { fail(`templates.${key}`, "متن نامعتبر است"); continue; }
        if (value.length > PROMPT_LIMITS.textLength) fail(`templates.${key}`, "متن خیلی بلند است");
        if (tokensIn(value).includes(SOURCE_TEXT_TOKEN)) fail(`templates.${key}`, `{{${SOURCE_TEXT_TOKEN}}} فقط در بخش‌های پرامپت پایه مجاز است`);
        templates[key] = value;
      }
    }
  }

  // ── گروه‌ها
  if (input?.groups !== undefined && !Array.isArray(input.groups)) fail("groups", "گروه‌ها باید آرایه باشند");
  const rawGroups = Array.isArray(input?.groups) ? input.groups : [];
  if (rawGroups.length > PROMPT_LIMITS.groups) fail("groups", `حداکثر ${PROMPT_LIMITS.groups} گروه`);
  const seenGroupIds = new Set();
  const groups = input?.groups === undefined ? undefined : rawGroups.map((group, g) => {
    const at = `groups.${g}`;
    // شناسه فقط اگر معتبر باشد نگه داشته می‌شود؛ گروهِ تازه شناسه را از mongoose می‌گیرد
    const _id = OBJECT_ID.test(String(group?._id ?? "")) ? String(group._id) : undefined;
    if (_id && seenGroupIds.has(_id)) fail(at, "شناسه‌ی گروه تکراری است");
    if (_id) seenGroupIds.add(_id);
    const title = typeof group?.title === "string" ? group.title.trim() : "";
    if (title.length > PROMPT_LIMITS.titleLength) fail(`${at}.title`, "عنوانِ گروه خیلی بلند است");

    const categories = idList(group?.categories) ?? [];
    if (!categories.length) fail(`${at}.categories`, "حداقل یک دسته برای گروه انتخاب کنید");
    if (new Set(categories).size !== categories.length) fail(`${at}.categories`, "دسته‌ی تکراری در گروه");
    categories.forEach((id) => {
      if (!OBJECT_ID.test(id) || !known(id)) fail(`${at}.categories`, `دسته‌ی «${id}» وجود ندارد`);
    });
    const inGroup = new Set(categories);

    /** دسته‌های هدفِ یک قاعده. عضوِ گروه نبودن یعنی قاعده به دسته‌ای اشاره می‌کند که از گروه
     *  برداشته شده: خالی‌کردنِ بی‌صدای آن، قاعده را به «همه‌ی دسته‌ها» گسترش می‌داد. */
    const targetsOf = (rule, path) => {
      const targets = idList(rule?.categories ?? []);
      if (!targets) { fail(path, "دسته‌های قاعده باید آرایه باشند"); return null; }
      if (new Set(targets).size !== targets.length) fail(path, "دسته‌ی تکراری در قاعده");
      if (targets.some((id) => !inGroup.has(id))) fail(path, "این قاعده به دسته‌ای اشاره می‌کند که در این گروه نیست");
      return targets;
    };

    const rawRules = Array.isArray(group?.rules) ? group.rules : [];
    if (rawRules.length > PROMPT_LIMITS.rulesPerGroup) fail(`${at}.rules`, `حداکثر ${PROMPT_LIMITS.rulesPerGroup} قاعده در هر گروه`);
    const seen = new Set();
    const rules = [];
    rawRules.forEach((rule, r) => {
      const path = `${at}.rules.${r}`;
      if (!parseFieldKey(rule?.field)) return fail(path, "فیلدِ ناشناخته");
      const text = checkRuleText(rule.text, path);
      const targets = targetsOf(rule, path);
      if (text === null || !targets) return;
      const dup = `${rule.field}\u0000${normalizeRule(text)}`;
      if (seen.has(dup)) return fail(path, "همین قاعده برای همین فیلد در این گروه تکراری است؛ دسته‌ها را در یک قاعده ترکیب کنید");
      seen.add(dup);
      rules.push({ field: rule.field, text, categories: targets });
    });

    // قواعدِ عمومیِ خودِ گروه — همان شکلِ بخش‌های پایه، با دسته‌های هدف برای هر قاعده
    const rawSections = Array.isArray(group?.sections) ? group.sections : [];
    if (rawSections.length > PROMPT_LIMITS.sections) fail(`${at}.sections`, `حداکثر ${PROMPT_LIMITS.sections} بخش`);
    const seenKeys = new Set();
    const seenNames = new Set();
    const sections = rawSections.map((section, s) => {
      const path = `${at}.sections.${s}`;
      const head = cleanSectionHead(section, path, seenKeys, seenNames);
      const seenRules = new Set();
      const sectionRules = [];
      (Array.isArray(section?.rules) ? section.rules : []).forEach((rule, r) => {
        const rulePath = `${path}.rules.${r}`;
        const text = checkRuleText(rule?.text, rulePath);
        const targets = targetsOf(rule, rulePath);
        if (text === null || !targets) return;
        if (seenRules.has(normalizeRule(text))) return fail(rulePath, "این قاعده در همین بخش تکراری است");
        seenRules.add(normalizeRule(text));
        sectionRules.push({ text, categories: targets });
      });
      return { ...head, rules: sectionRules };
    });

    return { ...(_id ? { _id } : {}), title, categories, rules, sections };
  });

  return { value: errors.length ? null : { document, fieldRules, templates, groups }, errors };
}

/* ─── ترکیب برای یک دسته ────────────────────────────────────────────────── */

/**
 * قواعدِ یک فیلد برای دسته‌ی داده‌شده: { base, groups, category } که تکرارها از آن‌ها حذف
 * شده‌اند. هر قاعده `{ text, source }` است و source دقیقاً می‌گوید قاعده از کجا آمده (همان
 * چیزی که پیش‌نمایش نشان می‌دهد و ویرایشِ از پیش‌نمایش با آن منبع را پیدا می‌کند).
 * `source.value` متنِ ذخیره‌شده‌ی منبع است؛ برای دسته ممکن است با text فرق کند، چون
 * واحدهای تکراریِ متنِ دسته از text حذف می‌شوند.
 *
 * قاعده‌ی گروه وقتی اعمال می‌شود که دسته عضوِ گروه باشد و (قاعده هیچ دسته‌ای نداشته باشد یا
 * این دسته در دسته‌های قاعده باشد). قاعده‌ای که همه‌ی دسته‌هایش حذف شده‌اند خودبه‌خود به هیچ
 * دسته‌ای نمی‌خورد — هرگز به «همه» گسترش نمی‌یابد.
 *
 * @param {object} p
 * @param {string[]} p.baseRules     قواعدِ پایه‌ی این فیلد
 * @param {string} p.categoryText    متنِ آزادِ خودِ دسته برای این فیلد
 * @param {object} [p.categorySource] منبعِ آن متن (پیش‌فرض: پرامپتِ فیلدِ دسته)
 */
export function resolveFieldRules({ baseRules = [], groups = [], categoryId, field, categoryText = "", categorySource = null }) {
  const id = String(categoryId);
  const seen = new Set();
  const take = (text) => {
    const units = splitRuleUnits(text).map(normalizeRule);
    const fresh = !seen.has(normalizeRule(text)) && units.some((u) => !seen.has(u));
    seen.add(normalizeRule(text));
    units.forEach((u) => seen.add(u));
    return fresh;
  };

  const base = baseRules
    .map((text, index) => ({ text, source: { kind: "baseField", field, index, value: text } }))
    .filter((r) => take(r.text));
  const groupRules = [];
  for (const group of groups) {
    if (!(group.categories || []).map(String).includes(id)) continue;
    (group.rules || []).forEach((rule, index) => {
      if (rule.field !== field) return;
      const targets = (rule.categories || []).map(String);
      if (targets.length && !targets.includes(id)) return;
      if (!take(rule.text)) return;
      groupRules.push({
        text: rule.text,
        source: {
          kind: "group",
          groupId: group._id == null ? null : String(group._id),
          groupTitle: group.title || "",
          field,
          index,
          targets,
          value: rule.text,
        },
      });
    });
  }

  const stored = String(categoryText ?? "").trim();
  let text = stored || null;
  if (text) {
    const units = splitRuleUnits(text);
    const kept = units.filter((u) => !seen.has(normalizeRule(u)));
    if (kept.length !== units.length) text = kept.length ? kept.join("\n") : null;
  }
  const category = text
    ? { text, source: { ...(categorySource || { kind: "categoryField", field }), value: categorySource?.value ?? String(categoryText ?? "") } }
    : null;
  return { base, groups: groupRules, category };
}

/**
 * جابه‌جاییِ یک قاعده در میانِ زیرمجموعه‌ای از قواعدِ یک آرایه (قواعدِ یک فیلد در گروه،
 * که قواعدِ همه‌ی فیلدها را در یک آرایه نگه می‌دارد). فقط خانه‌های `slots` جابه‌جا
 * می‌شوند؛ قواعدِ فیلدهای دیگر سرِ جای خودشان می‌مانند. from/to اندیسِ درونِ slots‌اند.
 * @param {Array} list  آرایه‌ی کامل
 * @param {number[]} slots  اندیس‌های صعودیِ قواعدِ آن فیلد در list
 */
export function moveWithinSlots(list, slots, from, to) {
  const picked = slots.map((i) => list[i]);
  const [moved] = picked.splice(from, 1);
  picked.splice(to, 0, moved);
  const next = [...list];
  slots.forEach((slot, k) => { next[slot] = picked[k]; });
  return next;
}
