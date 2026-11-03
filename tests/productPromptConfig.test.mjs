import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProductTemplate, composeProductPrompt, renderProductPrompt } from "../src/lib/buildProductTemplate.js";
import {
  CATEGORY_PROMPT_FIELDS,
  DATA_SECTION_KEYS,
  GROUP_PROMPT_FIELDS,
  PRODUCT_PROMPT_FIELDS,
  PROMPT_TOKENS,
  TEMPLATE_DEFS,
  dynamicFieldKey,
  expandTokens,
  fieldTitle,
  headingHasFieldKey,
  moveWithinSlots,
  normalizeRule,
  parseFieldKey,
  resolveFieldRules,
  sectionFieldKey,
  splitRuleUnits,
  unknownTokens,
  validatePromptConfig,
} from "../src/lib/productPromptConfig.js";
import { PROMPT_SEED, resolvePromptConfig } from "../src/lib/productPromptResolve.js";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), D = "d".repeat(24), GONE = "e".repeat(24);
const sport = { _id: "f".repeat(24), name: "Tennis", title: "تنیس" };
const rawContent = "A professional racket with a comfortable grip and excellent control for adult players.";
const category = (_id, extra = {}) => ({ _id, title: "راکت", sport, ...extra });
const draft = (cat, promptConfig) => buildProductTemplate({ category: cat, brands: [], athletes: [], rawContent, promptConfig });
const count = (haystack, needle) => haystack.split(needle).length - 1;
/** متنِ یک فیلد در FIELD RULES (تا فیلدِ بعدی). */
const fieldBlock = (prompt, field) => {
  const body = prompt.split("=\nFIELD RULES\n")[1].split("=\nCATEGORY DEFINITION\n")[0];
  const start = body.indexOf(`\n${field}:\n`);
  assert.ok(start >= 0, `field ${field} missing`);
  return body.slice(start + 1).split(/\n\n(?=[A-Za-z]+:\n)/)[0].replace(/\n+=+$/, "");
};
/** تنظیماتِ کاملِ ذخیره‌شده: seed + تغییرات. */
const stored = (mutate = () => {}) => {
  const config = structuredClone({ document: PROMPT_SEED.document, fieldRules: PROMPT_SEED.fieldRules, templates: PROMPT_SEED.templates, groups: [] });
  mutate(config);
  return config;
};
const sectionOf = (config, key) => config.document.find((s) => s.key === key);
const fieldOf = (config, field) => config.fieldRules.find((f) => f.field === field);

/* ─── متنِ شروع داده است، نه کد ─────────────────────────────────────────── */

test("the seed is a valid configuration covering every field and template", () => {
  const { document, fieldRules, templates } = PROMPT_SEED;
  assert.deepEqual(validatePromptConfig({ document, fieldRules, templates }).errors, []);
  assert.deepEqual(fieldRules.map((f) => f.field).sort(), PRODUCT_PROMPT_FIELDS.map((f) => f.key).sort());
  assert.deepEqual(Object.keys(templates).sort(), TEMPLATE_DEFS.map((t) => t.key).sort());
  assert.deepEqual(document.filter((s) => s.kind === "data").map((s) => s.key).sort(), [...DATA_SECTION_KEYS].sort());
  // هیچ بخشی برای قواعدِ گروه‌ها در پرامپت پایه نیست
  assert.deepEqual([...new Set(document.map((s) => s.kind))].sort(), ["data", "fields", "text"]);
});

test("the admin's texts have no placeholders for data collections", () => {
  const keys = PROMPT_TOKENS.map((t) => t.key);
  for (const data of ["brands", "athletes", "series", "limited_editions", "source_text", "attributes", "variant_attributes", "technical_stats", "custom_tab", "audience_rule", "multi_unit_rule"]) {
    assert.ok(!keys.includes(data), data);
    assert.ok(unknownTokens(`{{${data}}}`).includes(data), data);
  }
  const seedTexts = JSON.stringify([PROMPT_SEED.document, PROMPT_SEED.fieldRules]);
  for (const data of ["brands", "athletes", "series", "limited_editions", "source_text", "audience_rule", "multi_unit_rule", "custom_tab_output"]) {
    assert.ok(!seedTexts.includes(`{{${data}}}`), data);
  }
});

test("no prompt wording lives in the application code", () => {
  const sources = ["buildProductTemplate.js", "productPromptConfig.js", "productPromptResolve.js", "productDraftPrompt.js"]
    .map((file) => readFileSync(new URL(`../src/lib/${file}`, import.meta.url), "utf8"));
  // نمونه‌هایی از هر نوعِ متن: جداکننده، عنوان، قاعده، توضیح، قالبِ سطر، ساختارِ خروجی
  for (const text of [
    "=====", "FIELD RULES", "CRITICAL OUTPUT", "LANGUAGE RULE", "CATEGORY DEFINITION", "AVAILABLE BRANDS", "RAW PRODUCT CONTENT",
    "Your task", "senior Persian", "MUST be exactly", "No specific rule defined", "Category-group rules", "Category-specific rules",
    "Extraction Rule", "Selection Rule", "Applies ONLY", "Persian Label", "KEY:", "Output exactly", "When two rules conflict", "(none defined)",
  ]) {
    for (const source of sources) assert.ok(!source.includes(text), `«${text}» is hardcoded`);
  }
});

test("every unit of the old seeded category prompts is a base rule unit (so copies dedupe)", () => {
  for (const [field, text] of Object.entries(PROMPT_SEED.legacyCategoryDefaults)) {
    const baseUnits = new Set(PROMPT_SEED.fieldRules.find((f) => f.field === field).rules.flatMap(splitRuleUnits).map(normalizeRule));
    for (const unit of splitRuleUnits(text)) assert.ok(baseUnits.has(normalizeRule(unit)), `${field}: ${unit}`);
  }
});

test("label default matches the Product enum", () => {
  const prompt = draft(category(A));
  assert.ok(!prompt.includes("best_seller"));
  assert.ok(fieldBlock(prompt, "label").includes('["none", "new", "hot", "discount", "limited"]'));
});

/* ─── ادمین همه‌چیز را کنترل می‌کند ─────────────────────────────────────── */

test("a section heading is printed exactly as written, and the code adds no line of its own", () => {
  const config = stored((c) => {
    sectionOf(c, "output").heading = "\n\n~~~ top ~~~\nقالب خروجی:\n\nتوضیح   بخش  ";
    sectionOf(c, "language").heading = "NO BLANK LINE ABOVE";
    sectionOf(c, "fields").heading = "\n### Fields";
  });
  const prompt = draft(category(A), config);
  // هر خطِ خالی را ادمین نوشته: بینِ قطعه‌ها فقط همان یک شکستِ خط است
  assert.ok(prompt.includes("OUTPUT only the JSON — nothing else.\n\n\n~~~ top ~~~\nقالب خروجی:\n\nتوضیح   بخش  \nOutput ONLY raw JSON."));
  assert.ok(prompt.includes("Treat this output as production data — not a draft.\nNO BLANK LINE ABOVE\nAll human-readable"));
  assert.ok(prompt.includes("\n### Fields\nname:\n"));
  assert.ok(!prompt.includes("CRITICAL OUTPUT FORMAT RULES"));
  assert.ok(!prompt.includes("\nFIELD RULES\n"));

  // کوچک‌ترین پرامپت: فقط آنچه نوشته شده
  const minimal = stored((c) => {
    c.document = c.document.map((s) => ({ ...s, heading: "", rules: [] }));
    sectionOf(c, "role").heading = "H";
    sectionOf(c, "role").rules = ["R1", "R2"];
    c.fieldRules = [{ field: "name", heading: "name", rules: ["N"] }];
    Object.assign(c.templates, { field_empty: "", category_info: "", attributes_empty: "", variants_empty: "", multi_unit_definition_empty: "", technical_stats_empty: "", audience_rule_empty: "", multi_unit_rule_empty: "" });
  });
  const lines = draft(category(A), minimal).split("\n");
  assert.deepEqual(lines.slice(0, 4), ["H", "R1", "R2", "name"]);
  assert.equal(lines[4], "N");
});

test("every heading stays out of the data: emptying one prints the data alone", () => {
  const config = stored((c) => { sectionOf(c, "brands").heading = ""; sectionOf(c, "source_text").heading = "SOURCE:"; });
  const prompt = buildProductTemplate({ category: category(A), brands: [{ _id: B, name: "Wilson" }], athletes: [], rawContent, promptConfig: config });
  // (قاعده‌ی فیلدِ brand عبارتِ AVAILABLE BRANDS را دارد؛ اینجا سربرگش مدِ نظر است)
  assert.ok(!prompt.includes("\nAVAILABLE BRANDS\n"));
  assert.ok(prompt.includes('"name": "Wilson"'));
  assert.ok(prompt.includes(`SOURCE:\n${rawContent}`));
});

test("a product field's heading is the admin's text, and its identifier cannot be removed", () => {
  const config = stored((c) => { fieldOf(c, "name").heading = "### The field name — write it carefully:"; });
  const prompt = draft(category(A), config);
  assert.ok(prompt.includes("### The field name — write it carefully:\nMUST strictly follow"));
  assert.ok(!prompt.includes("\nname:\n"));

  const paths = (field, heading) => validatePromptConfig({ fieldRules: [{ field, heading, rules: [] }] }).errors.map((e) => e.path);
  assert.deepEqual(paths("name", "before name after"), []);
  assert.deepEqual(paths("name", "name"), []);
  assert.deepEqual(paths("name", "\n\nname:"), []);
  assert.deepEqual(paths("name", "نام (name): این فیلد"), []);
  for (const bad of ["", "   ", "نام محصول:", "Name:", "rename:", "name_x", "xname"]) assert.deepEqual(paths("name", bad), ["fieldRules.name.heading"], bad);
  assert.deepEqual(paths("customTabItems", "customTabItems -"), []);
  assert.ok(headingHasFieldKey("a name b name", "name") && headingHasFieldKey("renamed name", "name") && !headingHasFieldKey("renamed", "name"));
});

test("rules go into the prompt exactly as written: no numbers, no bullets, nothing added", () => {
  const prompt = draft(category(A));
  assert.ok(prompt.includes("\nOutput ONLY raw JSON. Start with { and end with }.\nNO markdown code fences"));
  assert.ok(!/^\s*\d+\. Output ONLY/m.test(prompt));
  assert.ok(prompt.includes("\nREAD the raw product content provided below.\n"));
  assert.ok(!prompt.includes("- READ the raw"));

  const config = stored((c) => { sectionOf(c, "task").rules = ["1) my own   number", "  - my own bullet  "]; });
  assert.ok(draft(category(A), config).includes("Your task:\n1) my own   number\n  - my own bullet  \n"));
});

test("sections can be added, removed and reordered; the prompt follows", () => {
  const config = stored((c) => {
    c.document = c.document.filter((s) => s.key !== "language");
    const output = c.document.findIndex((s) => s.key === "output");
    c.document.splice(output, 0, { key: "exceptions", kind: "text", name: "Exception Rules", heading: "\n---\nEXCEPTION RULES\n---", rules: ["When in doubt, ask nothing."] });
  });
  assert.deepEqual(validatePromptConfig({ document: config.document }).errors, []);
  const prompt = draft(category(A), config);
  assert.ok(!prompt.includes("LANGUAGE RULE"));
  assert.ok(prompt.includes("---\nEXCEPTION RULES\n---\nWhen in doubt, ask nothing.\n"));
  assert.ok(prompt.indexOf("EXCEPTION RULES") < prompt.indexOf("CRITICAL OUTPUT FORMAT RULES"));

  const moved = stored((c) => { c.document.reverse(); });
  const reversed = draft(category(A), moved);
  assert.ok(reversed.indexOf("REQUIRED JSON OUTPUT STRUCTURE") < reversed.indexOf("You are a senior"));
});

test("data-line formats come from the templates", () => {
  const cat = category(A, {
    attributes: [{ name: "Head", label: "سر", prompt: "HEAD RULE", targetAudiences: ["یونی سکس"] }],
    variantAttributes: [{ name: "Grip", label: "گریپ" }, { name: "Size", label: "سایز", multiUnit: true, units: ["EU", "CM"] }],
    technicalStats: [{ name: "power", label: "قدرت" }],
    customTab: { enabled: true, name: "Tech", items: [{ _id: C, title: "ONE" }] },
  });
  const config = stored((c) => {
    Object.assign(c.templates, {
      attribute_line: "ATTR {{name}}={{label}}{{rules}}{{scope}}",
      attribute_rule: " rule<{{text}}>",
      attribute_scope: " only<{{audiences}}>",
      variant_line: "VAR {{name}}{{rules}}",
      variant_multi_unit_line: "MULTI {{name}} {{primary_unit}} {{units}}{{rules}}",
      multi_unit_item: "ITEM {{name}} {{placeholder_units}}",
      multi_unit_placeholder: "<{{unit}}>",
      technical_stat_line: "STAT {{name}}{{rules}}",
      custom_tab_item: "- {{title}}{{rules}}",
      custom_tab_output: ', "tab": 1',
    });
    sectionOf(c, "custom_tab").heading = "TAB {{custom_tab_name}}:";
  });
  const prompt = draft(cat, config);
  assert.ok(prompt.includes('ATTR Head=سر rule<HEAD RULE> only<["مردانه","زنانه","یونی سکس"]>'));
  assert.ok(prompt.includes("VAR Grip\nMULTI Size EU [\"EU\",\"CM\"]"));
  assert.ok(prompt.includes('ITEM Size {"EU":"<EU>","CM":"<CM>"}'));
  assert.ok(prompt.includes("STAT power"));
  assert.ok(prompt.includes("TAB Tech:\n- ONE"));
  assert.ok(prompt.includes('"stat_name": 85\n  }, "tab": 1,'));
});

test("an emptied template prints nothing; a template cannot lose what it must carry", () => {
  const config = stored((c) => {
    fieldOf(c, "gallery").rules = [];
    fieldOf(c, "mainImage").rules = [];
    c.templates.field_empty = "";
  });
  const prompt = draft(category(A), config);
  assert.ok(prompt.includes("\nmainImage:\n\ngallery:"));
  assert.ok(!prompt.includes("No specific rule defined."));

  const paths = (templates) => validatePromptConfig({ templates }).errors.map((e) => e.path);
  assert.deepEqual(paths({ field_empty: "" }), []);
  assert.deepEqual(paths({ attribute_line: "no data" }), ["templates.attribute_line"]);
  assert.deepEqual(paths({ sport_lock: "" }), ["templates.sport_lock"]);
  assert.deepEqual(paths({ category_lock: "fixed" }), ["templates.category_lock"]);
  assert.deepEqual(paths({ audience_rule: "no list" }), ["templates.audience_rule"]);
  assert.deepEqual(paths({ multi_unit_rule: "" }), ["templates.multi_unit_rule"]);
  assert.deepEqual(paths({ output_structure: '{"sport": "{{sport_id}}", "category": "{{category_id}}"}' }), ["templates.output_structure"]);
  assert.deepEqual(paths({ custom_tab_item: "{{title}}" }), ["templates.custom_tab_item"]);
  assert.deepEqual(paths({ field_heading: "x" }), ["templates.field_heading"]);
});

test("the app inserts the locked lines itself, and no base edit can remove them", () => {
  const scoped = category(A, {
    attributes: [{ name: "Balance", label: "بالانس", targetAudiences: ["یونی سکس"] }],
    variantAttributes: [{ name: "Size", label: "سایز", multiUnit: true, units: ["EU", "CM"] }],
  });
  const config = stored((c) => {
    for (const field of ["sport", "category", "attributes", "variantMeta"]) fieldOf(c, field).rules = [];
  });
  const prompt = draft(scoped, config);
  assert.equal(fieldBlock(prompt, "sport"), `sport:\nMUST be exactly: "${sport._id}"`);
  assert.equal(fieldBlock(prompt, "category"), `category:\nMUST be exactly: "${A}"`);
  assert.ok(fieldBlock(prompt, "attributes").includes('"Balance" (بالانس) → ["مردانه","زنانه","یونی سکس"]'));
  assert.ok(fieldBlock(prompt, "variantMeta").includes('Multi-unit variant attributes for this category:\n  - KEY: "Size"'));
  assert.equal(fieldBlock(draft(category(A), config), "attributes"), "attributes:\nEvery attribute in this category applies to every target audience.");
  // قبل و بعد از قواعدِ ادمین، با متنی که در قالب نوشته شده
  const worded = stored((c) => {
    fieldOf(c, "sport").rules = ["ADMIN SPORT RULE"];
    fieldOf(c, "attributes").rules = ["ADMIN ATTR RULE"];
    c.templates.sport_lock = "LOCK {{sport_id}}";
  });
  assert.equal(fieldBlock(draft(category(A), worded), "sport"), `sport:\nLOCK ${sport._id}\nADMIN SPORT RULE`);
  assert.ok(fieldBlock(draft(category(A), worded), "attributes").startsWith("attributes:\nADMIN ATTR RULE\nEvery attribute"));
});

test("data lists come from the app: a placeholder for one prints as plain text and adds no data", () => {
  const brands = [{ _id: B, name: "Wilson" }];
  const config = stored((c) => { sectionOf(c, "task").rules = ["LIST: {{brands}}", "SPORT: {{sport_id}}"]; });
  const prompt = buildProductTemplate({ category: category(A), brands, athletes: [], rawContent, promptConfig: config });
  assert.ok(prompt.includes("LIST: {{brands}}\n"));
  assert.ok(prompt.includes(`SPORT: ${sport._id}`));
  assert.equal(count(prompt, '"name": "Wilson"'), 1);
});

test("the source text sits in its own section and is never expanded", () => {
  const text = "Source mentions {{sport_id}} and {{category_title}} literally, and is long enough to validate.";
  const prompt = buildProductTemplate({ category: category(A), brands: [], athletes: [], rawContent: text, promptConfig: null });
  assert.equal(count(prompt, text), 1);
  assert.match(prompt, /RAW PRODUCT CONTENT\n=+\nSource mentions/);
  assert.equal(expandTokens("{{a}} {{b}} {{ a }}", { a: "{{b}}", b: "x" }), "{{b}} x {{b}}");
  assert.deepEqual(unknownTokens("{{sport_id}} {{nope}} {nope}"), ["nope"]);
});

test("data sections cannot be removed or changed into something else; only their heading and place are the admin's", () => {
  const paths = (mutate) => validatePromptConfig({ document: stored(mutate).document }).errors.map((e) => e.path);
  assert.deepEqual(paths(() => {}), []);
  for (const key of DATA_SECTION_KEYS) assert.deepEqual(paths((c) => { c.document = c.document.filter((s) => s.key !== key); }), ["document"], key);
  assert.deepEqual(paths((c) => { sectionOf(c, "brands").kind = "text"; }), ["document.brands", "document"]);
  assert.deepEqual(paths((c) => { c.document.push({ key: "extra", kind: "data", name: "x", heading: "", rules: [] }); }), ["document.extra"]);
  // قاعده‌ی فرستاده‌شده برای بخشِ داده‌ای نگه داشته نمی‌شود و چاپ نمی‌شود
  const { value } = validatePromptConfig({ document: stored((c) => { sectionOf(c, "brands").rules = ["SNEAKY"]; }).document });
  assert.deepEqual(value.document.find((s) => s.key === "brands").rules, []);
  // جابه‌جایی
  const moved = stored((c) => {
    const i = c.document.findIndex((s) => s.key === "source_text");
    c.document.unshift(...c.document.splice(i, 1));
  });
  assert.deepEqual(validatePromptConfig({ document: moved.document }).errors, []);
  assert.ok(draft(category(A), moved).indexOf(rawContent) < draft(category(A), moved).indexOf("You are a senior"));
});

test("the fields section must exist once, section names may not repeat, group rules are no base section", () => {
  const paths = (mutate) => validatePromptConfig({ document: stored(mutate).document }).errors.map((e) => e.path);
  assert.deepEqual(paths((c) => { c.document = c.document.filter((s) => s.kind !== "fields"); }), ["document"]);
  assert.deepEqual(paths((c) => { sectionOf(c, "task").name = sectionOf(c, "role").name; }), ["document.task.name"]);
  assert.deepEqual(paths((c) => { sectionOf(c, "task").name = " "; }), ["document.task.name"]);
  assert.deepEqual(paths((c) => { sectionOf(c, "task").key = "role"; }), ["document.role"]);
  assert.deepEqual(paths((c) => { sectionOf(c, "task").heading = 1; }), ["document.task.heading"]);
  assert.deepEqual(paths((c) => { c.document.push({ key: "groups", kind: "groups", name: "g", heading: "", rules: [] }); }), ["document.groups"]);
});

/* ─── سندِ قدیمی بدونِ مهاجرت کار می‌کند ────────────────────────────────── */

test("a config saved in the oldest shape keeps its rules: absent section = seed, [] = section gone", () => {
  const legacy = {
    base: [
      { section: "task", rules: ["MY TASK RULE"] },
      { section: "language", rules: [] },
      { section: "field:name", rules: ["MY NAME RULE"] },
      { section: "field:sport", rules: [] },
      { section: "field:attributes", rules: ["MY ATTR RULE"] },
      { section: "bogus", rules: ["x"] },
    ],
    groups: [{ _id: B, title: "G", categories: [A], rules: [{ field: "brand", text: "OLD GROUP RULE", categories: [] }] }],
  };
  const resolved = resolvePromptConfig(legacy);
  assert.deepEqual(sectionOf(resolved, "task").rules, ["MY TASK RULE"]);
  assert.equal(sectionOf(resolved, "language"), undefined);
  assert.deepEqual(resolved.groups[0].sections, []);
  assert.deepEqual(validatePromptConfig({ document: resolved.document, fieldRules: resolved.fieldRules }).errors, []);

  const prompt = draft(category(A), legacy);
  assert.ok(prompt.includes("Your task:\nMY TASK RULE\n"));
  assert.ok(!prompt.includes("LANGUAGE RULE"));
  assert.ok(prompt.includes("CRITICAL OUTPUT FORMAT RULES"));
  assert.equal(fieldBlock(prompt, "name"), "name:\nMY NAME RULE");
  // خطوطِ قفل با سندِ قدیمی هم می‌مانند
  assert.equal(fieldBlock(prompt, "sport"), `sport:\nMUST be exactly: "${sport._id}"`);
  assert.equal(fieldBlock(prompt, "attributes"), "attributes:\nMY ATTR RULE\nEvery attribute in this category applies to every target audience.");
  assert.ok(fieldBlock(prompt, "brand").includes("OLD GROUP RULE"));
});

test("a config saved with separate header fields becomes one heading, with nothing lost or doubled", () => {
  const banner = "=====";
  const old = {
    document: [
      { key: "role", kind: "text", name: "نقش", top: "", title: "", bottom: "", description: "", blankLines: 2, rules: ["ROLE RULE"] },
      { key: "exceptions", kind: "text", name: "Exception Rules", top: banner, title: "EXCEPTIONS", bottom: banner, description: "desc line", blankLines: 1, rules: ["EXC RULE"] },
      { key: "groups", kind: "groups", name: "گروه‌ها", top: "", title: "", bottom: "", description: "", blankLines: 0, rules: [] },
      { key: "fields", kind: "fields", name: "فیلدها", top: banner, title: "MY FIELDS", bottom: banner, description: "note\n", blankLines: 1, fieldBlankLines: 1, rules: [] },
      { key: "brands", kind: "text", name: "برندها", top: "", title: "MY BRANDS", bottom: "", description: "{{brands}}", blankLines: 1, rules: [] },
      { key: "definition", kind: "text", name: "تعریف", top: banner, title: "MY DEFINITION", bottom: banner, description: "{{attributes}}", blankLines: 1, rules: [] },
      { key: "source", kind: "text", name: "متن", top: "", title: "MY SOURCE", bottom: "", description: "{{source_text}}", blankLines: 1, rules: [] },
    ],
    fieldRules: [
      { field: "name", rules: ["MY NAME RULE"] },
      { field: "sport", rules: ['MUST be exactly: "{{sport_id}}"', "MY SPORT RULE"] },
      { field: "attributes", rules: ["MY ATTR RULE", "{{audience_rule}}"] },
    ],
    templates: [{ key: "field_heading", text: "## {{field}}" }, { key: "field_empty", text: "EMPTY" }, { key: "multi_unit_definition", text: "{{items}}" }],
    groups: [{ _id: B, title: "G", categories: [A], rules: [], sections: [{ key: "gs", name: "gs", top: "", title: "GROUP TITLE", bottom: "", description: "", blankLines: 1, rules: [{ text: "GROUP GENERAL", categories: [] }] }] }],
  };
  const resolved = resolvePromptConfig(old);
  assert.deepEqual(validatePromptConfig({
    document: resolved.document, fieldRules: resolved.fieldRules, templates: resolved.templates, groups: resolved.groups,
  }).errors, []);
  assert.equal(sectionOf(resolved, "exceptions").heading, "\n\n=====\nEXCEPTIONS\n=====\ndesc line");
  assert.equal(sectionOf(resolved, "groups"), undefined);
  assert.equal(sectionOf(resolved, "source"), undefined);
  assert.equal(sectionOf(resolved, "source_text").kind, "data");
  assert.equal(sectionOf(resolved, "brands").kind, "data");
  assert.ok(sectionOf(resolved, "brands").heading.endsWith("MY BRANDS"));
  assert.ok(sectionOf(resolved, "category_info").heading.endsWith("=====\nMY DEFINITION\n====="));
  for (const key of DATA_SECTION_KEYS) assert.equal(sectionOf(resolved, key)?.kind, "data", key);

  const prompt = buildProductTemplate({ category: category(A), brands: [{ _id: C, name: "Wilson" }], athletes: [], rawContent, promptConfig: old });
  assert.ok(prompt.includes("ROLE RULE\n\n\n=====\nEXCEPTIONS\n=====\ndesc line\nEXC RULE"));
  assert.ok(prompt.includes("GROUP TITLE\nGROUP GENERAL"));
  assert.ok(prompt.indexOf("GROUP GENERAL") < prompt.indexOf("MY FIELDS"));
  assert.ok(prompt.includes("## name\nMY NAME RULE"));
  // قفل‌هایی که آن زمان قاعده بودند دو بار نمی‌آیند
  assert.equal(count(prompt, `MUST be exactly: "${sport._id}"`), 1);
  assert.equal(count(prompt, "Every attribute in this category applies"), 1);
  assert.ok(!prompt.includes("{{"));
  assert.ok(prompt.includes(`MY SOURCE\n${rawContent}`));
  assert.ok(prompt.includes('MY BRANDS\n[\n  {'));
});

test("once a document is stored the seed is never read for it", () => {
  const config = stored((c) => { fieldOf(c, "name").rules = []; c.fieldRules = c.fieldRules.filter((f) => f.field !== "tag"); });
  const resolved = resolvePromptConfig(config);
  assert.deepEqual(fieldOf(resolved, "name").rules, []);
  assert.equal(fieldOf(resolved, "tag"), undefined);
  // فیلدی که در سند نیست با همان شناسه‌اش می‌آید، نه با متنِ seed
  assert.ok(draft(category(A), config).includes("\ntag\nNo specific rule defined."));
  // قالبِ عمداً خالی خالی می‌ماند؛ فقط قالبی که اصلاً ذخیره نشده از seed می‌آید
  const templates = resolvePromptConfig({ document: config.document, templates: [{ key: "field_empty", text: "" }] }).templates;
  assert.equal(templates.field_empty, "");
  assert.equal(templates.group_heading, PROMPT_SEED.templates.group_heading);
});

/* ─── قواعدِ دسته و گروه ─────────────────────────────────────────────────── */

test("a category still holding the old seeded copies gets each rule exactly once", () => {
  const prompts = Object.entries(PROMPT_SEED.legacyCategoryDefaults).map(([field, context]) => ({ field, context }));
  const prompt = draft(category(A, { prompts }));
  assert.ok(!prompt.includes("Category-specific rules"));
  assert.equal(count(prompt, "Model name MUST be copied EXACTLY"), 1);
  assert.equal(count(prompt, "Array of short strings"), 1);
  assert.equal(count(prompt, "Read the provided product content carefully."), 1);
});

test("a customized category prompt keeps its own text and only drops duplicated units", () => {
  const prompt = draft(category(A, { prompts: [{ field: "name", context: "- Model name MUST be copied EXACTLY from raw content in English\n- Use the 2025 model year" }] }));
  const block = fieldBlock(prompt, "name");
  assert.equal(count(block, "Model name MUST be copied EXACTLY"), 1);
  assert.match(block, /Category-specific rules[^\n]*\n- Use the 2025 model year$/);

  const untouched = "  - keep   this\n  exact formatting";
  assert.ok(draft(category(A, { prompts: [{ field: "color", context: untouched }] })).includes(untouched.trim()));
});

test("group targeting: no categories = whole group, chosen categories = only those, outsiders get nothing", () => {
  const groups = [{ categories: [A, B, C], rules: [
    { field: "name", text: "ALL-GROUP RULE", categories: [] },
    { field: "name", text: "ONLY-A RULE", categories: [A] },
    { field: "name", text: "A-AND-C RULE", categories: [A, C] },
  ] }];
  const name = (id) => fieldBlock(draft(category(id), { groups }), "name");
  assert.match(name(A), /ALL-GROUP RULE[\s\S]*ONLY-A RULE[\s\S]*A-AND-C RULE/);
  assert.ok(name(B).includes("ALL-GROUP RULE") && !name(B).includes("ONLY-A") && !name(B).includes("A-AND-C"));
  assert.ok(name(C).includes("A-AND-C RULE") && !name(C).includes("ONLY-A"));
  assert.ok(!name(D).includes("RULE"));
  assert.ok(!name(D).includes("Category-group rules"));
});

test("a rule whose only target was deleted applies to nobody — it never widens to the whole group", () => {
  const groups = [{ categories: [A, GONE], rules: [{ field: "tag", text: "ORPHAN", categories: [GONE] }] }];
  assert.ok(!draft(category(A), { groups }).includes("ORPHAN"));
});

test("rules land only in their own field", () => {
  const groups = [{ categories: [A], rules: [{ field: "brand", text: "BRAND-ONLY RULE", categories: [] }] }];
  const prompt = draft(category(A), { groups });
  assert.equal(count(prompt, "BRAND-ONLY RULE"), 1);
  assert.ok(fieldBlock(prompt, "brand").includes("BRAND-ONLY RULE"));
});

test("order: base → groups (in group order) → category; output is deterministic", () => {
  const config = stored((c) => {
    fieldOf(c, "name").rules = ["BASE RULE"];
    c.groups = [
      { categories: [A], rules: [{ field: "name", text: "FIRST GROUP", categories: [] }] },
      { categories: [A, B], rules: [{ field: "name", text: "SECOND GROUP", categories: [] }] },
    ];
  });
  const cat = category(A, { prompts: [{ field: "name", context: "CATEGORY RULE" }] });
  const block = fieldBlock(draft(cat, config), "name");
  assert.equal(block, [
    "name:", "BASE RULE",
    "Category-group rules (more specific — override the rules above on conflict):",
    "FIRST GROUP", "SECOND GROUP",
    "Category-specific rules (most specific — override every rule above on conflict):",
    "CATEGORY RULE",
  ].join("\n"));
  assert.equal(draft(cat, config), draft(cat, config));
});

test("duplicates across sources are dropped, first occurrence wins", () => {
  const config = stored((c) => {
    fieldOf(c, "tag").rules = ["Persian keywords only"];
    c.groups = [
      { categories: [A], rules: [{ field: "tag", text: "-   Persian   keywords only", categories: [] }, { field: "tag", text: "SHARED", categories: [] }] },
      { categories: [A], rules: [{ field: "tag", text: "SHARED", categories: [] }] },
    ];
  });
  const block = fieldBlock(draft(category(A, { prompts: [{ field: "tag", context: "- SHARED" }] }), config), "tag");
  assert.equal(count(block, "Persian keywords only"), 1);
  assert.equal(count(block, "SHARED"), 1);
  assert.ok(!block.includes("Category-specific rules"));
});

test("customTabItems rules appear only for a category whose custom tab has items", () => {
  const groups = [{ categories: [A, B], rules: [{ field: "customTabItems", text: "TAB RULE", categories: [] }] }];
  assert.deepEqual(validatePromptConfig({ groups }).errors, []);
  assert.ok(!draft(category(A), { groups }).includes("TAB RULE"));
  const withTab = category(B, { customTab: { enabled: true, name: "x", items: [{ title: "t" }] } });
  assert.ok(fieldBlock(draft(withTab, { groups }), "customTabItems").includes("TAB RULE"));
});

test("technicalStatsPrompt is the category-specific source for technicalStats", () => {
  const block = fieldBlock(draft(category(A, { technicalStatsPrompt: "Power from weight" })), "technicalStats");
  assert.match(block, /return \{\}\.\nCategory-specific rules[^\n]*\nPower from weight$/);
});

/* ─── قواعدِ عمومیِ گروه ─────────────────────────────────────────────────── */

const groupSection = (key, rules, heading = "") => ({ key, name: key, heading, rules });

test("a group's general rules reach only its categories, directly above the field rules, each group independent", () => {
  const groups = [
    { _id: B, title: "G1", categories: [A, B], rules: [], sections: [groupSection("exceptions", [{ text: "G1 ALL", categories: [] }, { text: "G1 ONLY B", categories: [B] }], "EXCEPTION RULES")] },
    { _id: C, title: "G2", categories: [A], rules: [], sections: [groupSection("exceptions", [{ text: "G2 RULE", categories: [] }], "G2 RULES")] },
  ];
  assert.deepEqual(validatePromptConfig({ groups }).errors, []);
  const forA = draft(category(A), { groups });
  assert.ok(forA.includes("EXCEPTION RULES\nG1 ALL\n"));
  assert.ok(!forA.includes("G1 ONLY B"));
  assert.ok(forA.includes("G2 RULES\nG2 RULE\n"));
  assert.ok(forA.indexOf("LANGUAGE RULE") < forA.indexOf("EXCEPTION RULES"));
  assert.ok(forA.indexOf("EXCEPTION RULES") < forA.indexOf("G2 RULES"));
  assert.ok(forA.indexOf("G2 RULES") < forA.indexOf("FIELD RULES"));

  const forB = draft(category(B), { groups });
  assert.ok(forB.includes("G1 ONLY B") && !forB.includes("G2 RULE"));
  assert.ok(!draft(category(D), { groups }).includes("EXCEPTION RULES"));

  // جایشان همراهِ بخشِ فیلدها جابه‌جا می‌شود
  const moved = stored((c) => {
    c.groups = groups;
    const slot = c.document.findIndex((s) => s.kind === "fields");
    c.document.push(...c.document.splice(slot, 1));
  });
  const last = draft(category(A), moved);
  assert.ok(last.indexOf("REQUIRED JSON OUTPUT STRUCTURE") < last.indexOf("EXCEPTION RULES"));
  assert.ok(last.indexOf("EXCEPTION RULES") < last.indexOf("FIELD RULES"));
});

test("a group section with nothing for this category disappears; repeats of general rules are dropped", () => {
  const groups = [{ categories: [A, B], rules: [], sections: [
    groupSection("targeted", [{ text: "ONLY B", categories: [B] }], "TARGETED TITLE"),
    groupSection("dup", [{ text: "- READ the raw product content provided below.", categories: [] }, { text: "FRESH", categories: [] }], "DUP TITLE"),
    groupSection("empty", [], "EMPTY TITLE"),
  ] }];
  const prompt = draft(category(A), { groups });
  assert.ok(!prompt.includes("TARGETED TITLE") && !prompt.includes("EMPTY TITLE"));
  assert.equal(count(prompt, "READ the raw product content provided below."), 1);
  assert.ok(prompt.includes("DUP TITLE\nFRESH\n"));
});

test("group sections validate like base sections, and their rules cannot target outside the group", () => {
  const paths = (sections) => validatePromptConfig({ groups: [{ categories: [A], rules: [], sections }] }).errors.map((e) => e.path);
  assert.deepEqual(paths([groupSection("a", [])]), []);
  assert.deepEqual(paths([groupSection("a", []), groupSection("a", [])]), ["groups.0.sections.1", "groups.0.sections.1.name"]);
  assert.deepEqual(paths([{ ...groupSection("a", []), name: "" }]), ["groups.0.sections.0.name"]);
  assert.deepEqual(paths([groupSection("a", [{ text: "x", categories: [B] }])]), ["groups.0.sections.0.rules.0"]);
  assert.deepEqual(paths([groupSection("a", [{ text: "", categories: [] }])]), ["groups.0.sections.0.rules.0"]);
  assert.deepEqual(paths([groupSection("a", [{ text: "x", categories: [] }, { text: " x", categories: [] }])]), ["groups.0.sections.0.rules.1"]);
});

/* ─── همه‌ی فیلدها، از جمله فیلدهای پویا ─────────────────────────────────── */

test("groups accept every product field, fixed or dynamic; unknown fields are refused", () => {
  const paths = (field) => validatePromptConfig({ groups: [{ categories: [A], rules: [{ field, text: "x" }] }] }).errors.map((e) => e.path);
  for (const { key } of PRODUCT_PROMPT_FIELDS) assert.deepEqual(paths(key), [], key);
  for (const kind of ["attribute", "variant", "stat", "tabItem"]) assert.deepEqual(paths(dynamicFieldKey(kind, "Head Size")), [], kind);
  for (const bad of ["bogus", "attribute:", "other:x", "", null]) assert.deepEqual(paths(bad), ["groups.0.rules.0"], String(bad));
  assert.deepEqual(parseFieldKey("attribute:Head Size"), { kind: "attribute", name: "Head Size" });
  assert.equal(fieldTitle("attribute:Head Size"), "Head Size");
  assert.equal(fieldTitle("name"), "نام محصول");
});

test("dynamic field rules reach only the categories that have that field, group first then the category's own", () => {
  const groups = [{ _id: B, title: "G", categories: [A, B], rules: [
    { field: "attribute:Head", text: "GROUP HEAD", categories: [] },
    { field: "attribute:Head", text: "ONLY-B HEAD", categories: [B] },
    { field: "variant:Grip", text: "GROUP GRIP", categories: [] },
    { field: "stat:power", text: "GROUP POWER", categories: [] },
    { field: "tabItem:ONE", text: "GROUP ONE", categories: [] },
    { field: "attribute:Gone", text: "ORPHAN RULE", categories: [] },
  ] }];
  const full = category(A, {
    attributes: [{ name: "Head", label: "سر", prompt: "OWN HEAD" }, { name: "Weight", label: "وزن" }],
    variantAttributes: [{ name: "Grip", label: "گریپ" }],
    technicalStats: [{ name: "power", label: "قدرت" }],
    customTab: { enabled: true, name: "T", items: [{ _id: C, title: "ONE" }, { _id: D, title: "TWO" }] },
  });
  const prompt = draft(full, { groups });
  assert.ok(prompt.includes('KEY: "Head" | Persian Label (context only): سر | Type: single string or number | Extraction Rule: GROUP HEAD | Extraction Rule: OWN HEAD\n'));
  assert.ok(prompt.includes('KEY: "Weight" | Persian Label (context only): وزن | Type: single string or number\n'));
  assert.ok(prompt.includes('Type: array of strings | Guide: GROUP GRIP'));
  assert.ok(prompt.includes('KEY: "power" | Label: قدرت | Rule: GROUP POWER'));
  assert.ok(prompt.includes('- "ONE" | Selection Rule: GROUP ONE\n  - "TWO"'));
  assert.ok(!prompt.includes("ONLY-B HEAD") && !prompt.includes("ORPHAN RULE"));

  // دسته‌ی عضوِ گروه که این فیلدها را ندارد
  const bare = draft(category(B), { groups });
  for (const text of ["GROUP HEAD", "GROUP GRIP", "GROUP POWER", "GROUP ONE"]) assert.ok(!bare.includes(text), text);
});

test("category forms keep reading the shared field list", () => {
  for (const page of ["add/page.jsx", "edit/[categoryId]/page.jsx"]) {
    const src = readFileSync(new URL(`../src/app/(Admin-Panel)/p-admin/admin-categories/${page}`, import.meta.url), "utf8");
    assert.match(src, /const productFields = CATEGORY_PROMPT_FIELDS/, page);
  }
  const prompt = draft(category(A));
  for (const key of CATEGORY_PROMPT_FIELDS) fieldBlock(prompt, key);
});

/* ─── اعتبارسنجی ─────────────────────────────────────────────────────────── */

test("validation rejects every malformed or wrongly scoped input", () => {
  const known = new Set([A, B, C]);
  const errorsOf = (input) => validatePromptConfig(input, { knownCategoryIds: known }).errors.map((e) => e.path);
  const group = (rules, categories = [A, B]) => ({ groups: [{ categories, rules }] });
  const taskRules = (rules) => ({ document: stored((c) => { sectionOf(c, "task").rules = rules; }).document });

  const nameRules = (rules) => ({ field: "name", heading: "name:", rules });
  assert.deepEqual(errorsOf({ fieldRules: [{ field: "bogus", heading: "bogus", rules: [] }] }), ["fieldRules.0"]);
  assert.deepEqual(errorsOf({ fieldRules: [nameRules([]), nameRules([])] }), ["fieldRules.name"]);
  assert.deepEqual(errorsOf({ fieldRules: [nameRules(["x", "  "])] }), ["fieldRules.name.1"]);
  assert.deepEqual(errorsOf({ fieldRules: [nameRules(["Same  rule", "- Same rule"])] }), ["fieldRules.name.1"]);
  assert.deepEqual(errorsOf(taskRules(["x", ""])), ["document.task.rules.1"]);
  assert.deepEqual(errorsOf(taskRules(["x".repeat(4001)])), ["document.task.rules.0"]);
  assert.deepEqual(errorsOf({ templates: { bogus: "x" } }), ["templates.bogus"]);
  assert.deepEqual(errorsOf({ templates: { field_empty: 1 } }), ["templates.field_empty"]);
  assert.deepEqual(errorsOf(group([], [])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([], [A, D])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([], [A, A])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([{ field: "name", text: "" }])), ["groups.0.rules.0"]);
  // دسته‌ای که از گروه برداشته شده: رد می‌شود، نه خالی‌شدنِ بی‌صدا به «همه»
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x", categories: [C] }])), ["groups.0.rules.0"]);
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x", categories: [A] }, { field: "name", text: "x ", categories: [B] }])), ["groups.0.rules.1"]);
  // همان متن برای دو فیلدِ مختلف تکرار نیست
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x" }, { field: "tag", text: "x" }])), []);
});

test("validation output keeps text exactly as written, with string ids and unknown keys dropped", () => {
  const { value } = validatePromptConfig({
    fieldRules: [{ field: "name", heading: "\n name : ", rules: ["  hello  "], extra: 1 }],
    templates: { attribute_rule: "  {{text}}  ", field_empty: "" },
    groups: [{ title: "  rackets ", uid: "x", categories: [A], rules: [{ uid: "y", field: "name", text: " t ", categories: [] }] }],
  });
  assert.deepEqual(value, {
    document: undefined,
    fieldRules: [{ field: "name", heading: "\n name : ", rules: ["  hello  "] }],
    templates: { attribute_rule: "  {{text}}  ", field_empty: "" },
    groups: [{ title: "rackets", categories: [A], rules: [{ field: "name", text: " t ", categories: [] }], sections: [] }],
  });
});

test("partial saves: an absent part stays undefined, a malformed one is rejected", () => {
  assert.equal(validatePromptConfig({ fieldRules: [] }).value.groups, undefined);
  assert.equal(validatePromptConfig({ groups: [] }).value.document, undefined);
  assert.deepEqual(validatePromptConfig({}).value, { document: undefined, fieldRules: undefined, templates: undefined, groups: undefined });
  assert.deepEqual(validatePromptConfig({ fieldRules: "x" }).errors.map((e) => e.path), ["fieldRules"]);
  assert.deepEqual(validatePromptConfig({ templates: [] }).errors.map((e) => e.path), ["templates"]);
  assert.deepEqual(validatePromptConfig({ groups: {} }).errors.map((e) => e.path), ["groups"]);
  assert.ok(validatePromptConfig({ document: "x" }).errors.some((e) => e.path === "document"));
});

test("group ids: a valid id is kept, an invalid one dropped, a duplicate rejected", () => {
  const g = (_id) => ({ _id, categories: [A], rules: [] });
  const { value } = validatePromptConfig({ groups: [g(B), g("not-an-id")] });
  assert.equal(value.groups[0]._id, B);
  assert.ok(!("_id" in value.groups[1]));
  assert.deepEqual(validatePromptConfig({ groups: [g(B), g(B)] }).errors.map((e) => e.path), ["groups.1"]);
});

test("resolveFieldRules ignores groups that do not contain the category", () => {
  const rules = resolveFieldRules({
    baseRules: ["b"], categoryId: D, field: "name",
    groups: [{ categories: [A], rules: [{ field: "name", text: "x", categories: [] }] }],
  });
  assert.deepEqual(rules.groups, []);
  assert.deepEqual(rules.base.map((r) => r.source), [{ kind: "baseField", field: "name", index: 0, value: "b" }]);
});

/* ─── composeProductPrompt: منبعِ هر قاعده، و یکی بودنِ پیش‌نمایش با پرامپت ───── */

const richCategory = () => category(A, {
  prompts: [{ field: "name", context: "  CATEGORY NAME RULE  " }],
  attributes: [
    { name: "Head Size", label: "اندازه سر", prompt: "HEAD SIZE RULE" },
    { name: "Balance", label: "بالانس", targetAudiences: ["یونی سکس"] },
  ],
  variantAttributes: [{ name: "Grip", label: "گریپ", prompt: "GRIP GUIDE" }],
  technicalStats: [{ name: "power", label: "قدرت" }],
  technicalStatsPrompt: "TECH RULE",
  customTab: {
    enabled: true, name: "تکنولوژی‌ها", prompt: "TAB RULE",
    items: [{ _id: C, title: "FORTYFIVE", prompt: "PICK FORTYFIVE WHEN NAMED" }, { _id: D, title: "Spin Effect" }],
  },
});
const richConfig = () => stored((c) => {
  sectionOf(c, "task").rules = ["TASK ONE", "TASK TWO"];
  c.groups = [{
    _id: B, title: "Rackets", categories: [A],
    rules: [{ field: "brand", text: "OTHER FIELD", categories: [] }, { field: "name", text: "GROUP NAME RULE", categories: [A] }, { field: "stat:power", text: "GROUP STAT", categories: [] }],
    sections: [groupSection("extra", [{ text: "GROUP GENERAL", categories: [A] }], "EXTRA")],
  }];
});
const flatten = (m) => [
  ...m.sections.flatMap((s) => (s.kind === "text" ? s.rules : [])),
  ...m.fields.flatMap((f) => [...f.before, ...f.rules.base, ...f.after, ...f.rules.groups, ...(f.rules.category ? [f.rules.category] : [])]),
  ...[...m.attributes, ...m.variants, ...m.technicalStats, ...m.customTab.items].flatMap((entry) => entry.rules),
];

test("compose: every rule carries its exact source and the stored value an edit must match", () => {
  const m = composeProductPrompt({ category: richCategory(), promptConfig: richConfig() });
  const field = (key) => m.fields.find((f) => f.key === key);
  const section = (key) => m.sections.find((s) => s.key === key);

  assert.deepEqual(section("task").rules.map((r) => r.source), [
    { kind: "section", sectionKey: "task", sectionName: "قواعد کلی", index: 0, value: "TASK ONE" },
    { kind: "section", sectionKey: "task", sectionName: "قواعد کلی", index: 1, value: "TASK TWO" },
  ]);
  assert.deepEqual(section("extra").rules[0].source, {
    kind: "groupSection", groupId: B, groupTitle: "Rackets", sectionKey: "extra", sectionName: "extra", index: 0, targets: [A], value: "GROUP GENERAL",
  });
  // اندیسِ قاعده در خودِ گروه (نه در فیلد) — همان چیزی که ویرایش با آن قاعده را پیدا می‌کند
  assert.deepEqual(field("name").rules.groups[0].source, {
    kind: "group", groupId: B, groupTitle: "Rackets", field: "name", index: 1, targets: [A], value: "GROUP NAME RULE",
  });
  assert.equal(field("name").rules.base[0].source.kind, "baseField");
  assert.deepEqual(field("name").rules.category.source, { kind: "categoryField", field: "name", value: "  CATEGORY NAME RULE  " });
  assert.equal(field("name").rules.category.text, "CATEGORY NAME RULE");
  assert.deepEqual(field("technicalStats").rules.category.source, { kind: "technicalStats", value: "TECH RULE" });
  assert.deepEqual(field("customTabItems").rules.category.source, { kind: "customTab", tabName: "تکنولوژی‌ها", value: "TAB RULE" });
  assert.deepEqual(m.attributes[0].rules[0].source, { kind: "attribute", name: "Head Size", label: "اندازه سر", value: "HEAD SIZE RULE" });
  assert.deepEqual(m.attributes[1].rules, []);
  assert.deepEqual(m.variants[0].rules[0].source, { kind: "variantAttribute", name: "Grip", label: "گریپ", value: "GRIP GUIDE" });
  assert.equal(m.technicalStats[0].rules[0].source.field, "stat:power");
  assert.deepEqual(m.customTab.items.map((i) => i.rules[0]?.source ?? null), [
    { kind: "customTabItem", itemId: C, title: "FORTYFIVE", value: "PICK FORTYFIVE WHEN NAMED" }, null,
  ]);
});

test("compose: locked lines are marked as such; a rule's display expands its placeholders, its stored text keeps them", () => {
  const config = stored((c) => { sectionOf(c, "task").rules = ["id is {{sport_id}}"]; });
  const m = composeProductPrompt({ category: richCategory(), promptConfig: config });
  const rule = m.sections.find((s) => s.key === "task").rules[0];
  assert.equal(rule.text, "id is {{sport_id}}");
  assert.equal(rule.display, `id is ${sport._id}`);
  assert.equal(rule.source.value, rule.text);
  const lock = m.fields.find((f) => f.key === "sport").before[0];
  assert.deepEqual(lock.source, { kind: "system", what: "sportLock" });
  assert.equal(lock.display, `MUST be exactly: "${sport._id}"`);
  assert.deepEqual(m.fields.find((f) => f.key === "attributes").after.map((r) => r.source.what), ["audienceScope"]);
  assert.deepEqual(m.fields.find((f) => f.key === "variantMeta").after.map((r) => r.source.what), ["multiUnit"]);
  assert.equal(m.fields.find((f) => f.key === "name").heading, "name:");
});

test("the preview model and the prompt are the same rules — every model rule is in the prompt, in its place", () => {
  const cat = richCategory();
  const config = richConfig();
  const m = composeProductPrompt({ category: cat, promptConfig: config });
  const prompt = draft(cat, config);
  for (const rule of flatten(m)) assert.ok(prompt.includes(rule.display), `${rule.source.kind}: ${rule.display.slice(0, 60)}`);
  for (const f of m.fields) {
    const block = fieldBlock(prompt, f.key);
    for (const r of [...f.rules.base, ...f.rules.groups]) assert.ok(block.includes(r.display), `${f.key}: ${r.display.slice(0, 60)}`);
    if (f.rules.category) assert.ok(block.includes(f.rules.category.display), f.key);
  }
  // و برعکس: قاعده‌ی گروهِ دسته‌ی دیگر در هیچ‌کدام نیست
  const other = composeProductPrompt({ category: category(D), promptConfig: config });
  assert.ok(!flatten(other).some((r) => r.source.kind.startsWith("group")));
  assert.ok(!draft(category(D), config).includes("GROUP NAME RULE"));
  // متنِ خام جزوِ مدل نیست؛ بدونِ آن، بخشش فقط سربرگ دارد
  assert.ok(!JSON.stringify(m).includes(rawContent));
  assert.ok(!renderProductPrompt(m).includes(rawContent));
  assert.ok(renderProductPrompt(m).includes("RAW PRODUCT CONTENT"));
});

test("custom tab: the tab rule is the category rule of customTabItems, item hints sit next to their titles", () => {
  const prompt = draft(richCategory(), richConfig());
  const block = fieldBlock(prompt, "customTabItems");
  assert.ok(block.includes("Category-specific rules"));
  assert.ok(block.endsWith("TAB RULE"));
  assert.ok(prompt.includes('  - "FORTYFIVE" | Selection Rule: PICK FORTYFIVE WHEN NAMED\n  - "Spin Effect"\n'));
  assert.ok(prompt.includes('"customTabItems": ["<exact title from the list above>", "..."]'));
});

test("custom tab: without a prompt nothing is added; a disabled tab contributes nothing; a legacy prompts entry still applies", () => {
  const plainTab = { enabled: true, name: "T", items: [{ _id: C, title: "ONE" }] };
  const plain = draft(category(A, { customTab: plainTab }));
  assert.ok(plain.includes('Available titles for "T":\n  - "ONE"'));
  assert.ok(!plain.includes("| Selection Rule:"));
  assert.ok(!fieldBlock(plain, "customTabItems").includes("Category-specific rules"));

  const off = draft(category(A, { customTab: { ...plainTab, enabled: false, prompt: "TAB RULE", items: [{ title: "ONE", prompt: "HINT" }] } }));
  assert.ok(!off.includes("customTabItems") && !off.includes("TAB RULE") && !off.includes("HINT"));
  assert.ok(!off.includes("Available titles"));

  const legacy = composeProductPrompt({ category: category(A, { customTab: plainTab, prompts: [{ field: "customTabItems", context: "LEGACY" }] }) });
  assert.deepEqual(legacy.fields.find((f) => f.key === "customTabItems").rules.category.source, { kind: "categoryField", field: "customTabItems", value: "LEGACY" });
});

test("moveWithinSlots: reordering one field's group rules moves only those, and the prompt follows the new order", () => {
  const rules = [
    { field: "name", text: "N1", categories: [] },
    { field: "tag", text: "T1", categories: [] },
    { field: "name", text: "N2", categories: [] },
    { field: "name", text: "N3", categories: [] },
    { field: "tag", text: "T2", categories: [] },
  ];
  const slots = rules.flatMap((r, i) => (r.field === "name" ? [i] : []));
  const moved = moveWithinSlots(rules, slots, 2, 0); // N3 to the top of «name»
  assert.deepEqual(moved.map((r) => r.text), ["N3", "T1", "N1", "N2", "T2"]);
  assert.deepEqual(rules.map((r) => r.text), ["N1", "T1", "N2", "N3", "T2"], "input untouched");
  assert.deepEqual(moveWithinSlots(rules, slots, 1, 1), rules);

  const config = { groups: [{ categories: [A], rules: moved }] };
  assert.deepEqual(validatePromptConfig(config).errors, []);
  const block = fieldBlock(draft(category(A), config), "name");
  assert.ok(block.indexOf("N3") < block.indexOf("N1") && block.indexOf("N1") < block.indexOf("N2"));
  assert.ok(fieldBlock(draft(category(A), config), "tag").includes("T1\nT2"));
});

/* ─── قواعدِ گروه روی بخش‌های پرامپت پایه ──────────────────────────────── */

const onSection = (key, text, categories = []) => ({ field: sectionFieldKey(key), text, categories });

test("a group rule on a Base section prints right after that section's base rules, only for that group's categories", () => {
  const groups = [
    { _id: B, title: "G1", categories: [A, B], rules: [onSection("task", "G1 TASK"), onSection("task", "G1 ONLY B", [B]), onSection("output", "G1 OUTPUT")] },
    { _id: C, title: "G2", categories: [A], rules: [onSection("task", "G2 TASK")] },
  ];
  assert.deepEqual(validatePromptConfig({ groups }).errors, []);
  const forA = draft(category(A), { groups });
  assert.ok(forA.includes("OUTPUT only the JSON — nothing else.\nG1 TASK\nG2 TASK\n"));
  assert.ok(!forA.includes("G1 ONLY B"));
  assert.ok(forA.includes("Treat this output as production data — not a draft.\nG1 OUTPUT\n"));

  const forB = draft(category(B), { groups });
  assert.ok(forB.includes("nothing else.\nG1 TASK\nG1 ONLY B\n"));
  assert.ok(!forB.includes("G2 TASK"));

  const outsider = draft(category(D), { groups });
  for (const text of ["G1 TASK", "G2 TASK", "G1 OUTPUT"]) assert.ok(!outsider.includes(text), text);
  // پرامپت پایه و گروه‌های دیگر دست نمی‌خورند
  assert.equal(outsider, draft(category(D)));
});

test("sections the admin adds to the Base Prompt are available to groups; a removed one's rules go quiet", () => {
  const withSection = (c) => {
    c.document.splice(1, 0, { key: "exceptions", kind: "text", name: "Exception Rules", heading: "EXCEPTION RULES", rules: ["BASE EXCEPTION"] });
  };
  const group = { _id: B, categories: [A], rules: [onSection("exceptions", "GROUP EXCEPTION")] };
  const config = stored((c) => { withSection(c); c.groups = [group]; });
  assert.ok(draft(category(A), config).includes("EXCEPTION RULES\nBASE EXCEPTION\nGROUP EXCEPTION\n"));

  const removed = stored((c) => { c.groups = [group]; });
  assert.deepEqual(validatePromptConfig({ groups: [group] }).errors, []);
  assert.ok(!draft(category(A), removed).includes("GROUP EXCEPTION"));
});

test("group rules on a section follow the admin's reorder, and repeats of a base rule are dropped", () => {
  const rules = [onSection("task", "S1"), { field: "name", text: "N1", categories: [] }, onSection("task", "S2")];
  const slots = rules.flatMap((r, i) => (r.field === "section:task" ? [i] : []));
  const moved = moveWithinSlots(rules, slots, 1, 0);
  assert.ok(draft(category(A), { groups: [{ categories: [A], rules: moved }] }).includes("nothing else.\nS2\nS1\n"));

  const dup = draft(category(A), { groups: [{ categories: [A], rules: [onSection("task", "- READ the raw product content provided below."), onSection("task", "FRESH")] }] });
  assert.equal(count(dup, "READ the raw product content provided below."), 1);
  assert.ok(dup.includes("nothing else.\nFRESH\n"));
});

test("group rules on a section are traced to their group, and the preview matches the prompt", () => {
  const config = stored((c) => { c.groups = [{ _id: B, title: "G", categories: [A], rules: [{ field: "name", text: "X", categories: [] }, onSection("task", "GROUP TASK", [A])] }]; });
  const m = composeProductPrompt({ category: category(A), promptConfig: config });
  const task = m.sections.find((s) => s.key === "task");
  assert.deepEqual(task.rules.at(-1).source, {
    kind: "group", groupId: B, groupTitle: "G", field: "section:task", index: 1, targets: [A], value: "GROUP TASK",
  });
  assert.equal(task.rules[0].source.kind, "section");
  const prompt = draft(category(A), config);
  for (const rule of task.rules) assert.ok(prompt.includes(rule.display), rule.display);
  assert.equal(fieldTitle("section:task", config.document), "قواعد کلی");
  assert.equal(fieldTitle("section:gone", config.document), "gone");
});

test("groups offer only the fixed fields you asked for; saved rules on excluded fields keep applying", () => {
  const offered = GROUP_PROMPT_FIELDS.map((f) => f.key);
  for (const excluded of ["attributes", "variantOptions", "technicalStats", "customTabItems"]) assert.ok(!offered.includes(excluded), excluded);
  for (const kept of ["name", "brand", "sport", "category", "score", "variantMeta", "tag", "gallery"]) assert.ok(offered.includes(kept), kept);

  const cat = category(A, {
    attributes: [{ name: "Head", label: "سر" }],
    customTab: { enabled: true, name: "T", items: [{ _id: C, title: "ONE" }] },
  });
  const groups = [{ categories: [A], rules: [
    { field: "attributes", text: "SAVED ATTRIBUTES RULE", categories: [] },
    { field: "customTabItems", text: "SAVED TAB RULE", categories: [] },
    { field: "attribute:Head", text: "SAVED HEAD RULE", categories: [] },
  ] }];
  assert.deepEqual(validatePromptConfig({ groups }).errors, []);
  const prompt = draft(cat, { groups });
  assert.ok(fieldBlock(prompt, "attributes").includes("SAVED ATTRIBUTES RULE"));
  assert.ok(fieldBlock(prompt, "customTabItems").includes("SAVED TAB RULE"));
  assert.ok(prompt.includes("| Extraction Rule: SAVED HEAD RULE"));
});

test("group text has no placeholders: it prints exactly as written, while Base and category text still expand", () => {
  const config = stored((c) => {
    sectionOf(c, "task").rules = ["BASE {{sport_id}}"];
    c.groups = [{
      _id: B, categories: [A],
      rules: [onSection("task", "GROUP {{sport_id}}"), { field: "name", text: "FIELD {{category_id}}", categories: [] }],
      sections: [groupSection("own", [{ text: "OWN {{sport_id}}", categories: [] }], "OWN HEAD {{sport_id}}")],
    }];
  });
  const prompt = draft(category(A, { prompts: [{ field: "color", context: "CATEGORY {{sport_id}}" }] }), config);
  assert.ok(prompt.includes(`BASE ${sport._id}\nGROUP {{sport_id}}\n`));
  assert.ok(prompt.includes("FIELD {{category_id}}"));
  assert.ok(prompt.includes("OWN HEAD {{sport_id}}\nOWN {{sport_id}}"));
  assert.ok(prompt.includes(`CATEGORY ${sport._id}`));

  const m = composeProductPrompt({ category: category(A), promptConfig: config });
  assert.equal(m.sections.find((s) => s.key === "task").rules.at(-1).display, "GROUP {{sport_id}}");
});

test("the group page offers no placeholders and no per-attribute fields", () => {
  const src = readFileSync(new URL("../src/app/(Admin-Panel)/p-admin/admin-sports/prompt-settings/groups/[groupId]/page.jsx", import.meta.url), "utf8");
  for (const removed of ["TokenHelp", "UnknownTokensNote", "unknownTokens", "DYNAMIC_FIELD_KINDS", "dynamicFieldKey"]) assert.ok(!src.includes(removed), removed);
  assert.ok(src.includes("GROUP_PROMPT_FIELDS"));
});
