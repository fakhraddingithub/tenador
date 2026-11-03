/**
 * src/lib/productPromptConfig.js
 *
 * ساختارِ «تنظیماتِ پرامپتِ تولیدِ محصول» — بدونِ هیچ متنِ پرامپت. همه‌ی متن‌ها (سربرگ‌ها، قواعد و
 * قالبِ سطرهای داده) مالِ ادمین‌اند و در دیتابیس می‌مانند؛ نقطه‌ی شروع در productPromptSeed.json
 * است (productPromptResolve.js). خودِ داده‌ها (برندها، متن خام، ویژگی‌ها…) مالِ برنامه‌اند.
 *
 * خالص و بدونِ وابستگیِ سرور: buildProductTemplate (سرور)، روتِ API و صفحه‌های پنل همگی
 * از همین فایل می‌خوانند، پس «آنچه پنل قبول می‌کند» و «آنچه در پرامپت می‌رود» یکی است.
 *
 * شکلِ تنظیمات:
 *   document   : بخش‌های پرامپت به ترتیب: { key, kind, name, heading, rules }.
 *                kind: text (قواعد) | fields (جای قواعدِ فیلدها) | data (داده را برنامه درج می‌کند)
 *   fieldRules : هر فیلدِ ثابتِ محصول: { field, heading, rules }
 *   templates  : قالبِ متن‌هایی که برنامه از داده می‌سازد (TEMPLATE_DEFS)
 *   groups     : گروه‌ها — rules (قواعدِ فیلدها) و sections (قواعدِ عمومیِ خودِ گروه)
 *
 * هر متن همان‌طور که ادمین نوشته در پرامپت می‌آید؛ کد نه شماره می‌زند نه پیشوند و جز شکستِ خطِ
 * لازم بین قطعه‌ها چیزی اضافه نمی‌کند. تنها جایگزینی، placeholderهای نام و شناسه است (PROMPT_TOKENS).
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

/** فیلدهای ثابتی که گروه‌ها برایشان قاعده‌ی تازه نمی‌پذیرند؛ بقیه‌ی فیلدها در صفحه‌ی گروه تب دارند. */
const GROUP_EXCLUDED_FIELDS = new Set(["attributes", "variantOptions", "technicalStats", "customTabItems"]);
export const GROUP_PROMPT_FIELDS = PRODUCT_PROMPT_FIELDS.filter((f) => !GROUP_EXCLUDED_FIELDS.has(f.key));

/**
 * کلیدِ قاعده‌ی گروه: یک فیلدِ ثابت، یا
 *   section:<key>   قاعده‌ی گروه روی یکی از بخش‌های قواعدِ پرامپت پایه؛ بعد از قواعدِ پایه‌ی همان بخش چاپ می‌شود
 *   attribute:<name> · variant:<name> · stat:<name> · tabItem:<title>
 *                   قاعده‌ی ذخیره‌شده روی فیلدهای پویای دسته. قاعده‌ی تازه برایشان ساخته نمی‌شود، ولی
 *                   ذخیره‌شده‌ها معتبرند و اعمال می‌شوند؛ صفحه‌ی گروه آن‌ها را در تبِ جدا نشان می‌دهد.
 */
const KEYED_FIELD = /^(section|attribute|variant|stat|tabItem):([\s\S]+)$/;

export const dynamicFieldKey = (kind, name) => `${kind}:${name}`;
export const sectionFieldKey = (sectionKey) => `section:${sectionKey}`;

/** @returns {{kind: string, name: string}|null} kind = "fixed"، "section" یا نوعِ فیلدِ پویا */
export function parseFieldKey(key) {
  if (FIXED_FIELD_KEYS.has(key)) return { kind: "fixed", name: key };
  const match = KEYED_FIELD.exec(String(key ?? ""));
  return match ? { kind: match[1], name: match[2] } : null;
}

/** نامِ نمایشیِ کلیدِ یک قاعده. `document` نامِ بخش‌های پرامپت پایه را می‌دهد. */
export const fieldTitle = (key, document = []) => {
  const parsed = parseFieldKey(key);
  if (parsed?.kind === "fixed") return PRODUCT_PROMPT_FIELDS.find((f) => f.key === key).title;
  if (parsed?.kind === "section") return document.find((s) => s.key === parsed.name)?.name || parsed.name;
  return parsed?.name || key;
};

/* ─── بخش‌های داده‌ای، placeholderها و قالب‌ها ──────────────────────────── */

/**
 * بخش‌هایی که داده‌شان را برنامه درج می‌کند. ادمین فقط سربرگشان را می‌نویسد و جایشان را عوض
 * می‌کند: نه حذف می‌شوند و نه placeholderی برای داده‌شان وجود دارد. کلید همان منبعِ داده است.
 */
export const DATA_SECTION_KEYS = [
  "category_info", "attributes", "variant_attributes", "variant_metadata", "technical_stats", "custom_tab",
  "brands", "athletes", "series", "limited_editions", "source_text", "output_structure",
];
const DATA_SECTIONS = new Set(DATA_SECTION_KEYS);

/** تنها placeholderهای متن‌های ادمین: نام و شناسه، نه فهرست‌های داده. */
export const PROMPT_TOKENS = [
  { key: "category_title", label: "نام دسته" },
  { key: "category_id", label: "شناسه‌ی دسته" },
  { key: "sport_name", label: "نام انگلیسی ورزش" },
  { key: "sport_title", label: "نام فارسی ورزش" },
  { key: "sport_id", label: "شناسه‌ی ورزش" },
  { key: "custom_tab_name", label: "نام تب سفارشی" },
];
const PROMPT_TOKEN_KEYS = new Set(PROMPT_TOKENS.map((t) => t.key));

/**
 * قالبِ متن‌هایی که برنامه از داده می‌سازد. متنشان در دیتابیس است. `tokens` آن چیزی است که
 * قالب می‌پذیرد و `required` آنچه نباید حذف شود: بدونِ آن، داده یا قیدِ مربوطه از پرامپت می‌افتاد.
 */
export const TEMPLATE_DEFS = [
  { key: "field_empty", group: "قواعد فیلدها", label: "فیلدی که هیچ قاعده‌ای ندارد", tokens: [] },
  { key: "group_heading", group: "قواعد فیلدها", label: "عنوان بالای قواعد گروه در هر فیلد", tokens: [] },
  { key: "category_heading", group: "قواعد فیلدها", label: "عنوان بالای قاعده‌ی دسته در هر فیلد", tokens: [] },
  { key: "sport_lock", group: "قواعد فیلدها", label: "قیدِ شناسه‌ی ورزش (پیش از قواعد فیلد sport)", tokens: ["sport_id"], required: ["sport_id"] },
  { key: "category_lock", group: "قواعد فیلدها", label: "قیدِ شناسه‌ی دسته (پیش از قواعد فیلد category)", tokens: ["category_id"], required: ["category_id"] },

  { key: "category_info", group: "اطلاعات دسته", label: "متن بخش اطلاعات دسته", tokens: ["category_title", "category_id", "sport_name", "sport_title", "sport_id"] },

  { key: "attribute_line", group: "ویژگی‌های ثابت", label: "سطر هر ویژگی", tokens: ["name", "label", "rules", "scope"], required: ["name", "rules", "scope"] },
  { key: "attribute_rule", group: "ویژگی‌های ثابت", label: "هر قاعده‌ی ویژگی (در {{rules}})", tokens: ["text"], required: ["text"] },
  { key: "attribute_scope", group: "ویژگی‌های ثابت", label: "محدودیت مخاطب ویژگی (در {{scope}})", tokens: ["audiences"], required: ["audiences"] },
  { key: "attributes_empty", group: "ویژگی‌های ثابت", label: "دسته‌ی بدون ویژگی", tokens: [] },
  { key: "audience_rule", group: "ویژگی‌های ثابت", label: "قاعده‌ی ویژگی‌های محدود به مخاطب (پس از قواعد فیلد attributes)", tokens: ["items"], required: ["items"] },
  { key: "audience_rule_item", group: "ویژگی‌های ثابت", label: "هر ویژگیِ محدود (در {{items}})", tokens: ["name", "label", "audiences"], required: ["name", "audiences"] },
  { key: "audience_rule_empty", group: "ویژگی‌های ثابت", label: "وقتی هیچ ویژگی‌ای محدود نیست", tokens: [] },

  { key: "variant_line", group: "ویژگی‌های متغیر", label: "سطر هر ویژگی متغیر", tokens: ["name", "label", "rules"], required: ["name", "rules"] },
  { key: "variant_multi_unit_line", group: "ویژگی‌های متغیر", label: "سطر ویژگی متغیر چندواحدی", tokens: ["name", "label", "primary_unit", "units", "rules"], required: ["name", "rules"] },
  { key: "variant_rule", group: "ویژگی‌های متغیر", label: "هر قاعده‌ی ویژگی متغیر (در {{rules}})", tokens: ["text"], required: ["text"] },
  { key: "variants_empty", group: "ویژگی‌های متغیر", label: "دسته‌ی بدون ویژگی متغیر", tokens: [] },
  { key: "multi_unit_item", group: "ویژگی‌های متغیر", label: "توضیح هر ویژگی چندواحدی", tokens: ["name", "label", "primary_unit", "units", "placeholder_units"], required: ["name"] },
  { key: "multi_unit_placeholder", group: "ویژگی‌های متغیر", label: "نمونه‌ی مقدار هر واحد (در {{placeholder_units}})", tokens: ["unit"] },
  { key: "multi_unit_rule", group: "ویژگی‌های متغیر", label: "دستور چندواحدی (پس از قواعد فیلد variantMeta)", tokens: ["items"], required: ["items"] },
  { key: "multi_unit_rule_empty", group: "ویژگی‌های متغیر", label: "دستور چندواحدی وقتی چنین ویژگی‌ای نیست", tokens: [] },
  { key: "multi_unit_definition_empty", group: "ویژگی‌های متغیر", label: "متن بخش متادیتا وقتی چنین ویژگی‌ای نیست", tokens: [] },

  { key: "technical_stat_line", group: "شاخص‌های فنی", label: "سطر هر شاخص", tokens: ["name", "label", "rules"], required: ["name", "rules"] },
  { key: "technical_stat_rule", group: "شاخص‌های فنی", label: "هر قاعده‌ی شاخص (در {{rules}})", tokens: ["text"], required: ["text"] },
  { key: "technical_stats_empty", group: "شاخص‌های فنی", label: "دسته‌ی بدون شاخص", tokens: [] },

  { key: "custom_tab_item", group: "تب سفارشی", label: "سطر هر آیتم", tokens: ["title", "rules"], required: ["title", "rules"] },
  { key: "custom_tab_item_rule", group: "تب سفارشی", label: "هر قاعده‌ی آیتم (در {{rules}})", tokens: ["text"], required: ["text"] },

  { key: "output_structure", group: "ساختار خروجی", label: "ساختار JSON خروجی", tokens: ["sport_id", "category_id", "custom_tab_output"], required: ["sport_id", "category_id", "custom_tab_output"] },
  { key: "custom_tab_output", group: "ساختار خروجی", label: "سطر customTabItems (فقط برای دسته‌ای که تب سفارشی دارد)", tokens: [] },
];
const TEMPLATE_BY_KEY = new Map(TEMPLATE_DEFS.map((t) => [t.key, t]));

const TOKEN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * placeholderها را در یک گذر جایگزین می‌کند. مقدارِ جایگذاری‌شده دوباره بررسی نمی‌شود، پس
 * «{{sport_id}}» داخلِ نام یک ویژگی متن می‌ماند. placeholderِ ناشناخته دست‌نخورده می‌ماند.
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

/** کلیدِ فیلد باید به‌صورتِ کلمه‌ی کامل در سربرگش باشد؛ «rename» جای «name» را نمی‌گیرد. */
export const headingHasFieldKey = (heading, field) => {
  let at = String(heading ?? "").indexOf(field);
  const text = String(heading ?? "");
  const wordChar = /[A-Za-z0-9_]/;
  while (at >= 0) {
    const before = at > 0 && wordChar.test(text[at - 1]);
    const after = at + field.length < text.length && wordChar.test(text[at + field.length]);
    if (!before && !after) return true;
    at = text.indexOf(field, at + 1);
  }
  return false;
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
};
const OBJECT_ID = /^[a-f\d]{24}$/i;
const SECTION_KEY = /^[\w-]{1,60}$/;
const idList = (value) => (Array.isArray(value) ? value.map((id) => String(id?._id ?? id)) : null);

/**
 * تنظیمات را اعتبارسنجی و پاک‌سازی می‌کند — همان تابع در سرور و پنل. هر بخش اختیاری است
 * (undefined ≠ [])؛ بخشِ نفرستاده در خروجی هم undefined می‌ماند تا روت آن را دست نزند.
 * متن‌ها دقیقاً همان‌طور که نوشته شده‌اند نگه داشته می‌شوند (بدونِ trim).
 *
 * @param {object} input { document?, fieldRules?: [{field, heading, rules}], templates?: {key: text}, groups? }
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
    return text;
  };

  const checkHeading = (value, path) => {
    if (typeof value !== "string") { fail(path, "متن سربرگ نامعتبر است"); return ""; }
    if (value.length > PROMPT_LIMITS.textLength) fail(path, "متن سربرگ خیلی بلند است");
    return value;
  };

  /** نام و سربرگِ یک بخش (پایه یا گروه). نام فقط برچسبِ پنل است و چاپ نمی‌شود. */
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

    return { key, name, heading: checkHeading(section?.heading ?? "", `${path}.heading`) };
  };

  // ── بخش‌های پرامپت پایه
  const document = input?.document === undefined ? undefined : [];
  if (document) {
    if (!Array.isArray(input.document)) fail("document", "بخش‌های پرامپت باید آرایه باشند");
    const raw = Array.isArray(input.document) ? input.document : [];
    if (raw.length > PROMPT_LIMITS.sections) fail("document", `حداکثر ${PROMPT_LIMITS.sections} بخش`);
    const seenKeys = new Set();
    const seenNames = new Set();
    let fieldSections = 0;
    for (const [i, section] of raw.entries()) {
      const path = `document.${section?.key ?? i}`;
      const kind = section?.kind;
      if (!["text", "fields", "data"].includes(kind)) { fail(path, "نوع بخش نامعتبر است"); continue; }
      if (kind === "fields") fieldSections += 1;
      // کلیدِ بخش داده‌ای همان منبعِ داده است؛ بخشِ معمولی نمی‌تواند جایش را بگیرد
      if (kind === "data" && !DATA_SECTIONS.has(section.key)) { fail(path, "بخش داده‌ای ناشناخته"); continue; }
      if (kind !== "data" && DATA_SECTIONS.has(section?.key)) { fail(path, "این شناسه مخصوص بخش داده‌ای است"); continue; }
      const clean = { ...cleanSectionHead(section, path, seenKeys, seenNames), kind, rules: [] };
      if (kind === "text") {
        const rules = Array.isArray(section.rules) ? section.rules : [];
        if (rules.length > PROMPT_LIMITS.rulesPerSection) fail(path, `حداکثر ${PROMPT_LIMITS.rulesPerSection} قاعده`);
        const seen = new Set();
        rules.forEach((rawRule, r) => {
          const text = checkRuleText(rawRule, `${path}.rules.${r}`);
          if (text === null) return;
          if (seen.has(normalizeRule(text))) return fail(`${path}.rules.${r}`, "این قاعده در همین بخش تکراری است");
          seen.add(normalizeRule(text));
          clean.rules.push(text);
        });
      }
      document.push(clean);
    }
    if (Array.isArray(input.document)) {
      if (fieldSections !== 1) fail("document", "بخش «قواعد فیلدها» باید دقیقاً یک بار وجود داشته باشد");
      const missing = DATA_SECTION_KEYS.filter((key) => !raw.some((s) => s?.kind === "data" && s.key === key));
      if (missing.length) fail("document", `بخش‌های داده‌ای قابل حذف نیستند: ${missing.join("، ")}`);
    }
  }

  // ── فیلدها: سربرگ و قواعدِ پایه
  const fieldRules = input?.fieldRules === undefined ? undefined : [];
  if (fieldRules) {
    if (!Array.isArray(input.fieldRules)) fail("fieldRules", "قواعد فیلدها باید آرایه باشند");
    const seenFields = new Set();
    for (const [i, entry] of (Array.isArray(input.fieldRules) ? input.fieldRules : []).entries()) {
      const field = entry?.field;
      if (!FIXED_FIELD_KEYS.has(field)) { fail(`fieldRules.${i}`, "فیلد ناشناخته"); continue; }
      if (seenFields.has(field)) { fail(`fieldRules.${field}`, "فیلد تکراری"); continue; }
      seenFields.add(field);
      const heading = checkHeading(entry.heading, `fieldRules.${field}.heading`);
      // شناسه‌ی فیلد همان نامش در مدلِ محصول است و مدل با همین نام خروجی می‌دهد
      if (!headingHasFieldKey(heading, field)) fail(`fieldRules.${field}.heading`, `شناسه‌ی «${field}» باید در سربرگ بماند`);
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
      fieldRules.push({ field, heading, rules });
    }
  }

  // ── قالب‌ها: متنِ خالی مجاز است (یعنی آن قطعه چیزی چاپ نکند) مگر چیزی الزامی داشته باشد
  let templates;
  if (input?.templates !== undefined) {
    templates = {};
    if (!input.templates || typeof input.templates !== "object" || Array.isArray(input.templates)) {
      fail("templates", "قالب‌ها نامعتبرند");
    } else {
      for (const [key, value] of Object.entries(input.templates)) {
        const def = TEMPLATE_BY_KEY.get(key);
        if (!def) { fail(`templates.${key}`, "قالب ناشناخته"); continue; }
        if (typeof value !== "string") { fail(`templates.${key}`, "متن نامعتبر است"); continue; }
        if (value.length > PROMPT_LIMITS.textLength) fail(`templates.${key}`, "متن خیلی بلند است");
        const present = tokensIn(value);
        const missing = (def.required || []).filter((token) => !present.includes(token));
        if (missing.length) fail(`templates.${key}`, `این قالب باید ${missing.map((t) => `{{${t}}}`).join(" و ")} را داشته باشد`);
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
