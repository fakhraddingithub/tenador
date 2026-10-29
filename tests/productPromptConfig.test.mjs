import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProductTemplate, composeProductPrompt } from "../src/lib/buildProductTemplate.js";
import {
  BASE_PROMPT_SECTIONS,
  DEFAULT_BASE_PROMPT,
  CATEGORY_PROMPT_FIELDS,
  GROUP_PROMPT_FIELDS,
  isDefaultSection,
  isLegacyGroupField,
  LEGACY_CATEGORY_PROMPT_DEFAULTS,
  normalizeRule,
  resolveBasePrompt,
  resolveFieldRules,
  splitRuleUnits,
  storableBase,
  validatePromptConfig,
} from "../src/lib/productPromptConfig.js";

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

test("defaults: every section has a default and the defaults are valid", () => {
  for (const { key } of BASE_PROMPT_SECTIONS) assert.ok(Array.isArray(DEFAULT_BASE_PROMPT[key]), key);
  const base = BASE_PROMPT_SECTIONS.map(({ key }) => ({ section: key, rules: DEFAULT_BASE_PROMPT[key] }));
  assert.deepEqual(validatePromptConfig({ base, groups: [] }).errors, []);
});

test("defaults: every unit of the old seeded category prompts is a base rule unit (so copies dedupe)", () => {
  for (const [field, text] of Object.entries(LEGACY_CATEGORY_PROMPT_DEFAULTS)) {
    const baseUnits = new Set(DEFAULT_BASE_PROMPT[`field:${field}`].flatMap(splitRuleUnits).map(normalizeRule));
    for (const unit of splitRuleUnits(text)) assert.ok(baseUnits.has(normalizeRule(unit)), `${field}: ${unit}`);
  }
});

test("label default matches the Product enum, the old best_seller line is gone", () => {
  const prompt = draft(category(A));
  assert.ok(!prompt.includes("best_seller"));
  assert.ok(fieldBlock(prompt, "label").includes('["none", "new", "hot", "discount", "limited"]'));
});

test("a category still holding the old seeded copies gets each rule exactly once", () => {
  const prompts = Object.entries(LEGACY_CATEGORY_PROMPT_DEFAULTS).map(([field, context]) => ({ field, context }));
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

test("order: base → groups (in group order) → category, with the precedence note; output is deterministic", () => {
  const config = {
    base: [{ section: "field:name", rules: ["BASE RULE"] }],
    groups: [
      { categories: [A], rules: [{ field: "name", text: "FIRST GROUP", categories: [] }] },
      { categories: [A, B], rules: [{ field: "name", text: "SECOND GROUP", categories: [] }] },
    ],
  };
  const cat = category(A, { prompts: [{ field: "name", context: "CATEGORY RULE" }] });
  const block = fieldBlock(draft(cat, config), "name");
  assert.equal(block, [
    "name:", "- BASE RULE",
    "Category-group rules (more specific — override the rules above on conflict):",
    "- FIRST GROUP", "- SECOND GROUP",
    "Category-specific rules (most specific — override every rule above on conflict):",
    "CATEGORY RULE",
  ].join("\n"));
  assert.ok(draft(cat, config).includes("When two rules conflict, follow the more specific one."));
  assert.equal(draft(cat, config), draft(cat, config));
});

test("duplicates across sources are dropped, first occurrence wins", () => {
  const config = {
    base: [{ section: "field:tag", rules: ["Persian keywords only"] }],
    groups: [
      { categories: [A], rules: [{ field: "tag", text: "-   Persian   keywords only", categories: [] }, { field: "tag", text: "SHARED", categories: [] }] },
      { categories: [A], rules: [{ field: "tag", text: "SHARED", categories: [] }] },
    ],
  };
  const block = fieldBlock(draft(category(A, { prompts: [{ field: "tag", context: "- SHARED" }] }), config), "tag");
  assert.equal(count(block, "Persian keywords only"), 1);
  assert.equal(count(block, "SHARED"), 1);
  assert.ok(!block.includes("Category-specific rules"));
});

test("emptied sections: intro and banners disappear, an empty field says so", () => {
  const prompt = draft(category(A), {
    base: [
      { section: "role", rules: [] }, { section: "task", rules: [] },
      { section: "output", rules: [] }, { section: "field:gallery", rules: [] },
    ],
  });
  assert.ok(!prompt.includes("Your task:"));
  assert.ok(!prompt.includes("senior Persian e-commerce"));
  assert.ok(!prompt.includes("CRITICAL OUTPUT FORMAT RULES"));
  assert.ok(prompt.includes("LANGUAGE RULE"));
  assert.equal(fieldBlock(prompt, "gallery"), "gallery:\nNo specific rule defined.");
});

test("locked data lines survive any base edit", () => {
  const prompt = draft(category(A), { base: [{ section: "field:sport", rules: [] }, { section: "field:category", rules: [] }] });
  assert.equal(fieldBlock(prompt, "sport"), `sport:\n- MUST be exactly: "${sport._id}"`);
  assert.equal(fieldBlock(prompt, "category"), `category:\n- MUST be exactly: "${A}"`);
});

test("customTabItems rules appear only for a category whose custom tab has items", () => {
  const groups = [{ categories: [A, B], rules: [{ field: "customTabItems", text: "TAB RULE", categories: [] }] }];
  assert.ok(!draft(category(A), { groups }).includes("TAB RULE"));
  const withTab = category(B, { customTab: { enabled: true, name: "x", items: [{ title: "t" }] } });
  assert.ok(fieldBlock(draft(withTab, { groups }), "customTabItems").includes("TAB RULE"));
});

test("technicalStatsPrompt is the category-specific source for technicalStats", () => {
  const block = fieldBlock(draft(category(A, { technicalStatsPrompt: "Power from weight" })), "technicalStats");
  assert.match(block, /return \{\}\.\nCategory-specific rules[^\n]*\nPower from weight$/);
});

test("resolveBasePrompt: absent section = default, [] = deliberately empty, unknown sections ignored", () => {
  const base = resolveBasePrompt([{ section: "task", rules: [] }, { section: "nope", rules: ["x"] }]);
  assert.deepEqual(base.task, []);
  assert.deepEqual(base.output, DEFAULT_BASE_PROMPT.output);
  assert.ok(!("nope" in base));
});

test("validation rejects every malformed or wrongly scoped input", () => {
  const known = new Set([A, B, C]);
  const errorsOf = (input) => validatePromptConfig(input, { knownCategoryIds: known }).errors.map((e) => e.path);
  const group = (rules, categories = [A, B]) => ({ groups: [{ categories, rules }] });

  assert.deepEqual(errorsOf({ base: [{ section: "bogus", rules: [] }] }), ["base.0"]);
  assert.deepEqual(errorsOf({ base: [{ section: "task", rules: ["x", "  "] }] }), ["base.task.1"]);
  assert.deepEqual(errorsOf({ base: [{ section: "task", rules: ["Same  rule", "- Same rule"] }] }), ["base.task.1"]);
  assert.deepEqual(errorsOf({ base: [{ section: "task", rules: [] }, { section: "task", rules: [] }] }), ["base.task"]);
  assert.deepEqual(errorsOf(group([], [])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([], [A, D])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([], [A, A])), ["groups.0.categories"]);
  assert.deepEqual(errorsOf(group([{ field: "sport", text: "x" }])), ["groups.0.rules.0"]);
  assert.deepEqual(errorsOf(group([{ field: "name", text: "" }])), ["groups.0.rules.0"]);
  // دسته‌ای که از گروه برداشته شده: رد می‌شود، نه خالی‌شدنِ بی‌صدا به «همه»
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x", categories: [C] }])), ["groups.0.rules.0"]);
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x", categories: [A] }, { field: "name", text: "x ", categories: [B] }])), ["groups.0.rules.1"]);
  // همان متن برای دو فیلدِ مختلف تکرار نیست
  assert.deepEqual(errorsOf(group([{ field: "name", text: "x" }, { field: "tag", text: "x" }])), []);
  assert.deepEqual(errorsOf({ base: [{ section: "task", rules: ["x".repeat(4001)] }] }), ["base.task.0"]);
});

test("validation output is clean: trimmed text, string ids, unknown keys dropped", () => {
  const { value } = validatePromptConfig({
    base: [{ section: "task", rules: ["  hello  "], extra: 1 }],
    groups: [{ title: "  rackets ", uid: "x", categories: [A], rules: [{ uid: "y", field: "name", text: " t ", categories: [] }] }],
  });
  assert.deepEqual(value, {
    base: [{ section: "task", rules: ["hello"] }],
    groups: [{ title: "rackets", categories: [A], rules: [{ field: "name", text: "t", categories: [] }] }],
  });
});

test("groups offer exactly the fields of the category editor's AI settings, and both category forms read that list", () => {
  assert.deepEqual(CATEGORY_PROMPT_FIELDS, ["name", "label", "shortDescription", "longDescription", "color", "basePrice", "targetAudience", "tag"]);
  assert.deepEqual(GROUP_PROMPT_FIELDS.map((f) => f.key), CATEGORY_PROMPT_FIELDS);
  for (const page of ["add/page.jsx", "edit/[categoryId]/page.jsx"]) {
    const src = readFileSync(new URL(`../src/app/(Admin-Panel)/p-admin/admin-categories/${page}`, import.meta.url), "utf8");
    assert.match(src, /const productFields = CATEGORY_PROMPT_FIELDS/, page);
  }
  const prompt = draft(category(A));
  for (const key of CATEGORY_PROMPT_FIELDS) fieldBlock(prompt, key);
});

test("a group rule saved earlier for a field outside that list stays valid and keeps being applied", () => {
  assert.ok(isLegacyGroupField("brand") && !isLegacyGroupField("name") && !isLegacyGroupField("sport"));
  const groups = [{ categories: [A], rules: [{ field: "brand", text: "LEGACY BRAND RULE", categories: [] }] }];
  assert.deepEqual(validatePromptConfig({ groups }).errors, []);
  assert.ok(fieldBlock(draft(category(A), { groups }), "brand").includes("LEGACY BRAND RULE"));
  // ورزش/دسته/امتیاز هرگز قاعده‌ی گروه نمی‌پذیرند
  assert.equal(validatePromptConfig({ groups: [{ categories: [A], rules: [{ field: "sport", text: "x" }] }] }).errors.length, 1);
});

test("partial saves: an absent part stays undefined, a malformed one is rejected", () => {
  assert.equal(validatePromptConfig({ base: [] }).value.groups, undefined);
  assert.equal(validatePromptConfig({ groups: [] }).value.base, undefined);
  assert.deepEqual(validatePromptConfig({}).value, { base: undefined, groups: undefined });
  assert.deepEqual(validatePromptConfig({ base: "x" }).errors.map((e) => e.path), ["base"]);
  assert.deepEqual(validatePromptConfig({ groups: {} }).errors.map((e) => e.path), ["groups"]);
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
    base: resolveBasePrompt(), categoryId: D, field: "name",
    groups: [{ categories: [A], rules: [{ field: "name", text: "x", categories: [] }] }],
  });
  assert.deepEqual(rules.groups, []);
});

// ── composeProductPrompt: منبعِ هر قاعده، و یکی بودنِ پیش‌نمایش با پرامپت ─────────

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
const richConfig = {
  base: [{ section: "task", rules: ["TASK ONE", "TASK TWO"] }],
  groups: [{ _id: B, title: "Rackets", categories: [A], rules: [
    { field: "brand", text: "OTHER FIELD", categories: [] },
    { field: "name", text: "GROUP NAME RULE", categories: [A] },
  ] }],
};
const flatten = (m) => [
  ...Object.values(m.general).flat(),
  ...m.fields.flatMap((f) => [...f.before, ...f.rules.base, ...f.after, ...f.rules.groups, ...(f.rules.category ? [f.rules.category] : [])]),
  ...m.attributes.flatMap((a) => (a.rule ? [a.rule] : [])),
  ...m.variants.flatMap((v) => (v.rule ? [v.rule] : [])),
  ...(m.customTab.instruction ? [m.customTab.instruction] : []),
  ...m.customTab.items.flatMap((i) => (i.rule ? [i.rule] : [])),
];

test("compose: every rule carries its exact source and the stored value an edit must match", () => {
  const m = composeProductPrompt({ category: richCategory(), promptConfig: richConfig });
  const field = (key) => m.fields.find((f) => f.key === key);

  assert.deepEqual(m.general.task.map((r) => r.source), [
    { kind: "base", section: "task", index: 0, value: "TASK ONE" },
    { kind: "base", section: "task", index: 1, value: "TASK TWO" },
  ]);
  // اندیسِ قاعده در خودِ گروه (نه در فیلد) — همان چیزی که ویرایش با آن قاعده را پیدا می‌کند
  assert.deepEqual(field("name").rules.groups[0].source, {
    kind: "group", groupId: B, groupTitle: "Rackets", field: "name", index: 1, targets: [A], value: "GROUP NAME RULE",
  });
  assert.deepEqual(field("name").rules.category, {
    text: "CATEGORY NAME RULE", source: { kind: "categoryField", field: "name", value: "  CATEGORY NAME RULE  " },
  });
  assert.deepEqual(field("technicalStats").rules.category.source, { kind: "technicalStats", value: "TECH RULE" });
  assert.deepEqual(field("customTabItems").rules.category.source, { kind: "customTab", tabName: "تکنولوژی‌ها", value: "TAB RULE" });
  assert.deepEqual(m.attributes[0].rule.source, { kind: "attribute", name: "Head Size", label: "اندازه سر", value: "HEAD SIZE RULE" });
  assert.equal(m.attributes[1].rule, null);
  assert.deepEqual(m.variants[0].rule.source, { kind: "variantAttribute", name: "Grip", label: "گریپ", value: "GRIP GUIDE" });
  assert.deepEqual(m.customTab.items.map((i) => i.rule?.source ?? null), [
    { kind: "customTabItem", itemId: C, title: "FORTYFIVE", value: "PICK FORTYFIVE WHEN NAMED" }, null,
  ]);
  assert.deepEqual(field("sport").before.map((r) => r.source), [{ kind: "system", what: "sportLock" }]);
  assert.deepEqual(field("attributes").after.map((r) => r.source.what), ["audienceScope"]);
});

test("compose: the preview model and the prompt are the same rules — every model rule is in the prompt, in its place", () => {
  const cat = richCategory();
  const m = composeProductPrompt({ category: cat, promptConfig: richConfig });
  const prompt = draft(cat, richConfig);
  for (const rule of flatten(m)) {
    assert.ok(prompt.includes(rule.line ?? rule.text), `${rule.source.kind}: ${rule.text.slice(0, 60)}`);
  }
  for (const f of m.fields) {
    const block = fieldBlock(prompt, f.key);
    for (const r of [...f.rules.base, ...f.rules.groups]) assert.ok(block.includes(`- ${r.text}`), `${f.key}: ${r.text}`);
    if (f.rules.category) assert.ok(block.includes(f.rules.category.text), f.key);
  }
  // و برعکس: قاعده‌ی گروهِ فیلدِ دیگر یا دسته‌ی دیگر در هیچ‌کدام نیست
  const other = composeProductPrompt({ category: category(D), promptConfig: richConfig });
  assert.ok(!flatten(other).some((r) => r.source.kind === "group"));
  assert.ok(!draft(category(D), richConfig).includes("GROUP NAME RULE"));
  // دادهٔ تزریقی (فهرست‌ها، متنِ خام) جزوِ مدل نیست
  assert.ok(!JSON.stringify(m).includes(rawContent));
});

test("custom tab: the tab rule is the category rule of customTabItems, item hints sit next to their titles", () => {
  const prompt = draft(richCategory(), richConfig);
  const block = fieldBlock(prompt, "customTabItems");
  assert.ok(block.includes("Category-specific rules"));
  assert.ok(block.endsWith("TAB RULE"));
  assert.ok(prompt.includes('  - "FORTYFIVE" | Selection Rule: PICK FORTYFIVE WHEN NAMED\n  - "Spin Effect"\n'));
  assert.ok(prompt.includes('"customTabItems": ["<exact title from the list above>", "..."]'));
});

test("custom tab: without a prompt the output is unchanged; a disabled tab contributes nothing; a legacy prompts entry still applies", () => {
  const plainTab = { enabled: true, name: "T", items: [{ _id: C, title: "ONE" }] };
  const plain = draft(category(A, { customTab: plainTab }));
  assert.ok(plain.includes('Available titles for "T":\n  - "ONE"\n'));
  assert.ok(!plain.includes("| Selection Rule:"));
  assert.ok(!fieldBlock(plain, "customTabItems").includes("Category-specific rules"));

  const off = draft(category(A, { customTab: { ...plainTab, enabled: false, prompt: "TAB RULE", items: [{ title: "ONE", prompt: "HINT" }] } }));
  assert.ok(!off.includes("customTabItems") && !off.includes("TAB RULE") && !off.includes("HINT"));

  const legacy = composeProductPrompt({ category: category(A, { customTab: plainTab, prompts: [{ field: "customTabItems", context: "LEGACY" }] }) });
  assert.deepEqual(legacy.fields.find((f) => f.key === "customTabItems").rules.category.source, { kind: "categoryField", field: "customTabItems", value: "LEGACY" });
});

test("storableBase: editing one rule stores only that section; restoring the default stores nothing", () => {
  const sections = resolveBasePrompt();
  assert.deepEqual(storableBase(sections), []);
  assert.ok(BASE_PROMPT_SECTIONS.every(({ key }) => isDefaultSection(key, sections[key])));
  sections["field:name"][0] = "EDITED";
  const stored = storableBase(sections);
  assert.deepEqual(stored.map((s) => s.section), ["field:name"]);
  assert.equal(stored[0].rules[0], "EDITED");
  assert.equal(stored[0].rules.length, DEFAULT_BASE_PROMPT["field:name"].length);
  assert.deepEqual(validatePromptConfig({ base: stored }).errors, []);
});
