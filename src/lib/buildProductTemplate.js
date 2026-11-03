/**
 * buildProductTemplate.js
 *
 * The infrastructure that assembles the AI product prompt. It contains no prompt text:
 * every title, separator, description, rule and data-line format comes from the prompt
 * configuration (productPromptResolve.js). The code only orders what the admin wrote, picks
 * the rules that apply to a category and fills in {{placeholders}} with data.
 *
 * composeProductPrompt() tags every rule with its exact source. The prompt string and the
 * admin preview page render that same model, so the preview cannot drift from what the AI
 * actually receives.
 */

// مسیرِ نسبی (نه اسمِ مستعارِ base/) عمدی است: tests/aiProductDraft.test.mjs این
// فایل را به‌صورتِ ایمپورتِ ایستا و *پیش از* register کردنِ hookِ اسم‌های مستعار
// می‌خواند، پس یک ایمپورتِ base/ اینجا آن تست را در resolve می‌شکند.
import {
  TARGET_AUDIENCE_VALUES,
  attributeAppliesToAudience,
} from "../../utils/targetAudience.js";
import {
  PRODUCT_PROMPT_FIELDS,
  SOURCE_TEXT_TOKEN,
  dynamicFieldKey,
  expandTokens,
  normalizeRule,
  resolveFieldRules,
  splitRuleUnits,
} from "./productPromptConfig.js";
import { resolvePromptConfig } from "./productPromptResolve.js";

/** The category's own free-text prompt entry for a field (raw stored text, "" when none). */
function categoryPromptValue(prompts, field) {
  if (!Array.isArray(prompts)) return "";
  const match = prompts.find((p) => p?.field === field);
  return match?.context == null ? "" : match.context.toString();
}

/**
 * Every rule of the product prompt for one category, each tagged with its source:
 *
 *   { kind: "section", sectionKey, sectionName, index }   a rule of a base prompt section
 *   { kind: "baseField", field, index }                   a base rule of a product field
 *   { kind: "group", groupId, groupTitle, field, index, targets }
 *   { kind: "groupSection", groupId, groupTitle, sectionKey, sectionName, index, targets }
 *   { kind: "categoryField", field }                      category.prompts[field].context
 *   { kind: "technicalStats" }                            category.technicalStatsPrompt
 *   { kind: "attribute" | "variantAttribute", name, label }   that attribute's prompt
 *   { kind: "customTab", tabName }                        category.customTab.prompt
 *   { kind: "customTabItem", itemId, title }              category.customTab.items[].prompt
 *
 * A rule carries `text` (as stored, tokens unexpanded), `display` (tokens expanded, data
 * lists left as tokens) and `source.value`, the stored text an edit must match.
 *
 * @param {Object} params
 * @param {Object}  params.category      - Category with populated sport (_id, name, title)
 * @param {Object} [params.promptConfig] - Stored ProductPromptConfig; absent → the seed
 */
export function composeProductPrompt({ category, promptConfig = null }) {
  if (!category) throw new Error("category is required");
  if (!category._id) throw new Error("category._id is required");
  if (!category.sport?._id || !category.sport.name?.trim()) {
    throw new Error("category.sport must be populated with _id and name");
  }
  const config = resolvePromptConfig(promptConfig);
  const { groups } = config;
  const categoryId = category._id;
  const template = (key, values = {}) => expandTokens(config.templates[key] ?? "", values);

  const scalars = {
    category_title: category.title,
    category_id: String(categoryId),
    sport_name: category.sport.name,
    sport_title: category.sport.title || category.sport.name,
    sport_id: String(category.sport._id),
  };

  // ─── Rules of dynamic fields: this group rules → the category's own ───────
  const rulesFor = (key, stored, source) => {
    const value = stored == null ? "" : String(stored);
    const resolved = resolveFieldRules({ groups, categoryId, field: key, categoryText: value, categorySource: { ...source, value } });
    return [...resolved.groups, ...(resolved.category ? [resolved.category] : [])];
  };
  const ruleSuffix = (rules, key) => rules.map((r) => template(key, { text: expandTokens(r.text, scalars) })).join("");

  // ─── Category Global Attributes ───────────────────────────────────────────
  // An attribute may be restricted to some target audiences (e.g. balance only makes sense
  // on an adult racket). The model picks targetAudience itself, so the restriction has to
  // travel with the attribute. The list is the EXPANDED set of product targetAudience values
  // that keep the attribute applicable — computed with the same helper the rest of the
  // system uses, so the model never has to infer the "یونی سکس = adults" rule.
  const attributeAudienceScope = (attr) => {
    const allowed = (TARGET_AUDIENCE_VALUES || []).filter((audience) =>
      attributeAppliesToAudience(attr?.targetAudiences, audience),
    );
    return allowed.length === TARGET_AUDIENCE_VALUES.length ? null : allowed;
  };

  const attributes = (category.attributes || []).map((attr) => ({
    name: attr.name,
    label: attr.label,
    scope: attributeAudienceScope(attr),
    rules: rulesFor(dynamicFieldKey("attribute", attr.name), attr.prompt, { kind: "attribute", name: attr.name, label: attr.label }),
  }));
  const restricted = attributes.filter(({ scope }) => scope !== null);

  // ─── Variant Attributes ───────────────────────────────────────────────────
  const variants = (category.variantAttributes || []).map((attr) => {
    const units = Array.isArray(attr.units) ? attr.units.filter(Boolean) : [];
    return {
      name: attr.name,
      label: attr.label,
      units,
      multiUnit: Boolean(attr.multiUnit && units.length > 0),
      rules: rulesFor(dynamicFieldKey("variant", attr.name), attr.prompt, { kind: "variantAttribute", name: attr.name, label: attr.label }),
    };
  });
  const multiUnitItems = variants
    .filter(({ multiUnit }) => multiUnit)
    .map(({ name, label, units }) =>
      template("multi_unit_item", {
        name,
        label,
        units: JSON.stringify(units),
        primary_unit: units[0],
        placeholder_units: JSON.stringify(Object.fromEntries(units.map((unit) => [unit, template("multi_unit_placeholder", { unit })]))),
      }),
    )
    .join("\n");

  // ─── Technical Stats ──────────────────────────────────────────────────────
  const technicalStats = (category.technicalStats || []).map((stat) => ({
    name: stat.name,
    label: stat.label,
    rules: rulesFor(dynamicFieldKey("stat", stat.name), "", { kind: "stat", name: stat.name }),
  }));

  // ─── Custom Tab ───────────────────────────────────────────────────────────
  const customTab = category.customTab || {};
  const tabItems =
    customTab.enabled && Array.isArray(customTab.items)
      ? customTab.items
          .filter((item) => item?.title)
          .map((item) => ({
            title: item.title,
            rules: rulesFor(dynamicFieldKey("tabItem", item.title), item.prompt, {
              kind: "customTabItem",
              itemId: item._id == null ? null : String(item._id),
              title: item.title,
            }),
          }))
      : [];
  const tabName = customTab.name || "";
  // Before the tab had its own prompt, a `customTabItems` entry in category.prompts was the
  // field's category rule; such an entry still applies when the tab's own prompt is empty.
  const tabPrompt = String(customTab.prompt ?? "");
  const tabRuleSource = tabPrompt.trim()
    ? { kind: "customTab", tabName, value: tabPrompt }
    : { kind: "categoryField", field: "customTabItems", value: categoryPromptValue(category.prompts, "customTabItems") };

  // ─── What the {{placeholders}} expand to ──────────────────────────────────
  const values = {
    ...scalars,
    attributes: attributes.length
      ? attributes
          .map(({ name, label, scope, rules }) =>
            template("attribute_line", {
              name,
              label,
              rules: ruleSuffix(rules, "attribute_rule"),
              scope: scope ? template("attribute_scope", { audiences: JSON.stringify(scope) }) : "",
            }),
          )
          .join("\n")
      : template("attributes_empty"),
    audience_rule: restricted.length
      ? template("audience_rule", {
          items: restricted
            .map(({ name, label, scope }) => template("audience_rule_item", { name, label, audiences: JSON.stringify(scope) }))
            .join("\n"),
        })
      : template("audience_rule_empty"),
    variant_attributes: variants.length
      ? variants
          .map(({ name, label, units, multiUnit, rules }) =>
            template(multiUnit ? "variant_multi_unit_line" : "variant_line", {
              name,
              label,
              units: JSON.stringify(units),
              primary_unit: units[0] ?? "",
              rules: ruleSuffix(rules, "variant_rule"),
            }),
          )
          .join("\n")
      : template("variants_empty"),
    multi_unit_rule: multiUnitItems ? template("multi_unit_rule", { items: multiUnitItems }) : template("multi_unit_rule_empty"),
    multi_unit_definition: multiUnitItems ? template("multi_unit_definition", { items: multiUnitItems }) : template("multi_unit_definition_empty"),
    technical_stats: technicalStats.length
      ? technicalStats
          .map(({ name, label, rules }) => template("technical_stat_line", { name, label, rules: ruleSuffix(rules, "technical_stat_rule") }))
          .join("\n")
      : template("technical_stats_empty"),
    custom_tab_name: tabName,
    custom_tab: tabItems.length
      ? template("custom_tab", {
          custom_tab_name: tabName,
          items: tabItems
            .map(({ title, rules }) => template("custom_tab_item", { title, rules: ruleSuffix(rules, "custom_tab_item_rule") }))
            .join("\n"),
        })
      : "",
    custom_tab_output: tabItems.length ? template("custom_tab_output") : "",
  };

  const decorate = (rule) => ({ ...rule, display: expandTokens(rule.text, values) });
  [attributes, variants, technicalStats, tabItems].forEach((list) =>
    list.forEach((entry) => { entry.rules = entry.rules.map(decorate); }),
  );

  // ─── Product fields: base → category prompt groups → the category's own ───
  const baseRulesOf = new Map(config.fieldRules.map(({ field, rules }) => [field, rules]));
  const categoryRuleFor = (key) => {
    if (key === "technicalStats") {
      const value = category.technicalStatsPrompt == null ? "" : String(category.technicalStatsPrompt);
      return { categoryText: value.trim(), categorySource: { kind: "technicalStats", value } };
    }
    if (key === "customTabItems") return { categoryText: tabRuleSource.value.trim(), categorySource: tabRuleSource };
    const value = categoryPromptValue(category.prompts, key);
    return { categoryText: value.trim(), categorySource: { kind: "categoryField", field: key, value } };
  };
  const fields = PRODUCT_PROMPT_FIELDS
    // the custom tab field exists only for a category whose tab has items
    .filter(({ key }) => key !== "customTabItems" || tabItems.length)
    .map(({ key, title }) => {
      const rules = resolveFieldRules({ baseRules: baseRulesOf.get(key) || [], groups, categoryId, field: key, ...categoryRuleFor(key) });
      return {
        key,
        title,
        rules: {
          base: rules.base.map(decorate),
          groups: rules.groups.map(decorate),
          category: rules.category && decorate(rules.category),
        },
      };
    });

  // ─── The document, in the admin's order ───────────────────────────────────
  const id = String(categoryId);
  const head = ({ key, name, top = "", title = "", bottom = "", description = "", blankLines = 1 }) =>
    ({ key, name, top, title, bottom, description, blankLines });

  // A group's general rules that repeat a rule already in the prompt are dropped, first wins.
  const seenGeneral = new Set(
    config.document
      .filter((s) => s.kind === "text")
      .flatMap((s) => s.rules.flatMap(splitRuleUnits))
      .map(normalizeRule),
  );
  const groupSections = groups
    .filter((group) => (group.categories || []).map(String).includes(id))
    .flatMap((group) =>
      group.sections.flatMap((section) => {
        const rules = [];
        (section.rules || []).forEach((rule, index) => {
          const targets = (rule.categories || []).map(String);
          if (targets.length && !targets.includes(id)) return;
          const unit = normalizeRule(rule.text);
          if (seenGeneral.has(unit)) return;
          seenGeneral.add(unit);
          rules.push(decorate({
            text: rule.text,
            source: {
              kind: "groupSection",
              groupId: group._id == null ? null : String(group._id),
              groupTitle: group.title || "",
              sectionKey: section.key,
              sectionName: section.name,
              index,
              targets,
              value: rule.text,
            },
          }));
        });
        // a section none of whose rules apply here has nothing to say to this category
        if (!rules.length && !section.description) return [];
        return [{ ...head(section), kind: "text", owner: { groupId: group._id == null ? null : String(group._id), groupTitle: group.title || "" }, rules }];
      }),
    );

  const sections = config.document.flatMap((section) => {
    if (section.kind === "groups") return groupSections;
    if (section.kind === "fields") return [{ ...head(section), kind: "fields", fieldBlankLines: section.fieldBlankLines ?? 1 }];
    return [{
      ...head(section),
      kind: "text",
      rules: section.rules.map((text, index) =>
        decorate({ text, source: { kind: "section", sectionKey: section.key, sectionName: section.name, index, value: text } }),
      ),
    }];
  });

  return {
    sections,
    fields,
    attributes,
    variants,
    technicalStats,
    customTab: { name: tabName, items: tabItems },
    templates: {
      field_heading: config.templates.field_heading ?? "",
      field_empty: config.templates.field_empty ?? "",
      group_heading: config.templates.group_heading ?? "",
      category_heading: config.templates.category_heading ?? "",
    },
    values,
  };
}

/** Lines are joined as written; a part the admin left empty simply prints nothing. */
const joinLines = (lines) => lines.filter((line) => line !== "").join("\n");

/**
 * The prompt string from a composed model. `tokens` adds the values that are not part of the
 * model (data lists, source text). Rules and fields never expand the source text: it has
 * exactly one place, in a document section.
 */
export function renderProductPrompt(model, tokens = {}) {
  const documentTokens = { ...model.values, ...tokens };
  const ruleTokens = { ...documentTokens };
  delete ruleTokens[SOURCE_TEXT_TOKEN];
  const rule = (r) => expandTokens(r.text, ruleTokens);

  const fieldBlock = ({ key, rules }) => {
    const lines = rules.base.map(rule);
    if (rules.groups.length) lines.push(model.templates.group_heading, ...rules.groups.map(rule));
    if (rules.category) lines.push(model.templates.category_heading, rule(rules.category));
    const body = joinLines(lines) || model.templates.field_empty;
    return joinLines([expandTokens(model.templates.field_heading, { field: key }), body]);
  };

  const blocks = model.sections
    .map((section) => {
      const parts = ["top", "title", "bottom", "description"].map((part) => expandTokens(section[part], documentTokens));
      const body = section.kind === "fields"
        ? model.fields.map(fieldBlock).join("\n".repeat(1 + (section.fieldBlankLines ?? 1)))
        : joinLines((section.rules || []).map((r) => expandTokens(r.text, section.owner ? ruleTokens : documentTokens)));
      return { text: joinLines([...parts, body]), blankLines: section.blankLines ?? 1 };
    })
    .filter((block) => block.text !== "");

  return blocks
    .map((block, i) => (i < blocks.length - 1 ? block.text + "\n".repeat(1 + block.blankLines) : block.text))
    .join("");
}

/**
 * Builds the full AI prompt for product data extraction.
 *
 * @param {Object} params
 * @param {Object}   params.category        - Category with populated sport (_id, name, title)
 * @param {Array}    params.brands           - Populated brand documents (with .series)
 * @param {Array}    params.athletes         - Athlete documents
 * @param {Array}   [params.limitedEditions] - Limited edition documents (optional)
 * @param {string}   params.rawContent       - Raw text to extract product data from
 * @param {Object}  [params.promptConfig]    - Stored ProductPromptConfig; absent → the seed
 * @returns {string} - The complete prompt string
 */
export function buildProductTemplate({
  category,
  brands,
  athletes,
  limitedEditions = [],
  rawContent,
  promptConfig = null,
}) {
  // ─── Input Validation ─────────────────────────────────────────────────────
  if (!category) throw new Error("category is required");
  if (!category._id) throw new Error("category._id is required");
  if (!Array.isArray(brands)) throw new Error("brands must be an array");
  const model = composeProductPrompt({ category, promptConfig });
  if (!Array.isArray(athletes)) throw new Error("athletes must be an array");
  if (typeof rawContent !== "string" || rawContent.trim().length < 50) {
    throw new Error("rawContent is too short (minimum 50 characters)");
  }

  // ─── Reference Lists ──────────────────────────────────────────────────────
  const brandList = brands.map((b) => ({
    id: b._id.toString(),
    name: b.name,
  }));

  const athleteList = athletes.map((a) => ({
    id: a._id.toString(),
    name: a.name,
  }));

  // Series are nested inside brands — we flatten them and include parentBrandId
  // so the AI can enforce the brand↔serie relationship constraint.
  const serieList = brands.flatMap((b) =>
    (b.series || []).map((ser) => ({
      id: ser._id.toString(),
      name: ser.title || ser.name,
      parentBrandId: b._id.toString(),
      parentBrandName: b.name,
    }))
  );

  // Limited editions belong to a specific brand (e.g. Wilson's Roland Garros).
  // parentBrandId is included for the same reason series carry it: the AI must
  // be able to enforce the brand↔limitedEdition constraint the server now
  // rejects (src/lib/limitedEditionRelations.js).
  const limitedEditionList = limitedEditions.map((c) => {
    const owner = c.brand?._id ?? c.brand;
    return {
      id: c._id.toString(),
      name: c.name || c.title,
      parentBrandId: owner == null ? "" : owner.toString(),
      parentBrandName: c.brand?.name || "",
    };
  });

  return renderProductPrompt(model, {
    brands: JSON.stringify(brandList, null, 2),
    athletes: JSON.stringify(athleteList, null, 2),
    series: JSON.stringify(serieList, null, 2),
    limited_editions: JSON.stringify(limitedEditionList, null, 2),
    [SOURCE_TEXT_TOKEN]: rawContent.trim(),
  });
}
