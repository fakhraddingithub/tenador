/**
 * buildProductTemplate.js
 *
 * Generates a structured AI prompt for extracting product data from raw content.
 * Returns a prompt string that instructs the AI to output valid, consistent JSON.
 */

// مسیرِ نسبی (نه اسمِ مستعارِ base/) عمدی است: tests/aiProductDraft.test.mjs این
// فایل را به‌صورتِ ایمپورتِ ایستا و *پیش از* register کردنِ hookِ اسم‌های مستعار
// می‌خواند، پس یک ایمپورتِ base/ اینجا آن تست را در resolve می‌شکند.
import {
  TARGET_AUDIENCE_VALUES,
  attributeAppliesToAudience,
} from "../../utils/targetAudience.js";
import {
  FIELD_PRECEDENCE_NOTE,
  PRODUCT_PROMPT_FIELDS,
  bulletRule,
  numberedRule,
  renderFieldRules,
  resolveBasePrompt,
  resolveFieldRules,
} from "./productPromptConfig.js";

/** The category's own free-text prompt for a field ("" when it has none). */
function categoryPromptText(prompts, field) {
  if (!Array.isArray(prompts)) return "";
  const match = prompts.find((p) => p?.field === field);
  return match?.context?.toString().trim() || "";
}

const BANNER = "=================================================================";

/** A banner-headed section of the prompt, omitted entirely when it has no rules. */
const ruleSection = (title, lines) =>
  lines.length ? `${BANNER}\n${title}\n${BANNER}\n${lines.join("\n")}\n\n` : "";

/**
 * Builds the full AI prompt for product data extraction.
 *
 * @param {Object} params
 * @param {Object}   params.category        - Category with populated sport (_id, name, title)
 * @param {Array}    params.brands           - Populated brand documents (with .series)
 * @param {Array}    params.athletes         - Athlete documents
 * @param {Array}   [params.limitedEditions] - Limited edition documents (optional)
 * @param {string}   params.rawContent       - Raw text to extract product data from
 * @param {Object}  [params.promptConfig]    - Stored ProductPromptConfig ({ base, groups });
 *                                             absent → the default base prompt and no groups
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
  if (!category.sport?._id || !category.sport.name?.trim()) {
    throw new Error("category.sport must be populated with _id and name");
  }
  const sportId = category.sport._id.toString();
  if (!Array.isArray(athletes)) throw new Error("athletes must be an array");
  if (typeof rawContent !== "string" || rawContent.trim().length < 50) {
    throw new Error("rawContent is too short (minimum 50 characters)");
  }

  // ─── Category Global Attributes ───────────────────────────────────────────
  // These produce single-value fields in "attributes" object.
  // The KEY the AI must use is attr.name (English). The label (Persian) is shown for context only.
  //
  // An attribute may be restricted to some target audiences (e.g. balance only
  // makes sense on an adult racket). The model picks targetAudience itself, so
  // the restriction has to travel with the attribute as a conditional rule. The
  // list below is the EXPANDED set of product targetAudience values that keep
  // the attribute applicable — computed with the same helper the rest of the
  // system uses, so the model never has to infer the "یونی سکس = adults" rule.
  const attributeAudienceScope = (attr) => {
    const allowed = (TARGET_AUDIENCE_VALUES || []).filter((audience) =>
      attributeAppliesToAudience(attr?.targetAudiences, audience),
    );
    return allowed.length === TARGET_AUDIENCE_VALUES.length ? null : allowed;
  };

  const restrictedAttributes = (category.attributes || [])
    .map((attr) => ({ attr, scope: attributeAudienceScope(attr) }))
    .filter(({ scope }) => scope !== null);

  const globalAttributeInstructions = (category.attributes || [])
    .map((attr) => {
      const rule = attr.prompt ? ` | Extraction Rule: ${attr.prompt}` : "";
      const scope = attributeAudienceScope(attr);
      const audience = scope
        ? ` | Applies ONLY when targetAudience is one of: ${JSON.stringify(scope)} — otherwise OMIT this key entirely`
        : "";
      return `  - KEY: "${attr.name}" | Persian Label (context only): ${attr.label} | Type: single string or number${rule}${audience}`;
    })
    .join("\n");

  const audienceScopedAttributeRule = restrictedAttributes.length
    ? `- Some attributes below only apply to certain target audiences. AFTER you decide "targetAudience",
  drop every attribute whose "Applies ONLY when targetAudience is one of" list does not contain the value
  you chose — omit the key entirely, do NOT output null, "" or a guessed value. Audience-scoped attributes
  in this category:
${restrictedAttributes
  .map(({ attr, scope }) => `  - "${attr.name}" (${attr.label}) → ${JSON.stringify(scope)}`)
  .join("\n")}`
    : "";

  // ─── Variant Attributes ───────────────────────────────────────────────────
  // These produce array-value fields in "variantOptions" object.
  // All values mentioned in the raw content must be collected.
  const variantAttributeInstructions = (category.variantAttributes || [])
    .map((attr) => {
      const rule = attr.prompt ? ` | Guide: ${attr.prompt}` : "";
      const units = Array.isArray(attr.units) ? attr.units.filter(Boolean) : [];
      if (attr.multiUnit && units.length > 0) {
        return `  - KEY: "${attr.name}" | Persian Label (context only): ${attr.label} | Type: multi-unit variant | variantOptions must contain ONLY primary "${units[0]}" values as strings | Units in order: ${JSON.stringify(units)}${rule}`;
      }
      return `  - KEY: "${attr.name}" | Persian Label (context only): ${attr.label} | Type: array of strings${rule}`;
    })
    .join("\n");

  const multiUnitVariantAttributes = (category.variantAttributes || []).filter((attr) => {
    const units = Array.isArray(attr.units) ? attr.units.filter(Boolean) : [];
    return attr.multiUnit && units.length > 0;
  });

  const multiUnitVariantInstructions = multiUnitVariantAttributes
    .map((attr) => {
      const units = attr.units.filter(Boolean);
      const placeholderUnits = Object.fromEntries(
        units.map((unit) => [unit, `<real ${unit} value for this size, as a string>`])
      );
      return `  - KEY: "${attr.name}"
    Persian Label: ${attr.label}
    Units: ${JSON.stringify(units)}
    Primary unit: "${units[0]}"
    JSON shape (structure only — the placeholders below are NOT real values, do not copy them literally):
      "variantOptions": { "${attr.name}": ["<primary value 1>", "<primary value 2>", "..."] }
      "variantMeta": {
        "${attr.name}": {
          "<primary value 1>": { "units": ${JSON.stringify(placeholderUnits)}, "images": [] }
        }
      }
    Important: the object key under variantMeta.${attr.name} MUST exactly equal the matching primary value from variantOptions.${attr.name}.
    CRITICAL — completeness: if the raw content describes a size RANGE (e.g. "36 to 46", "sizes 36-46", "از 36 تا 46") rather than
    listing every value individually, you MUST enumerate every single value in that range in variantOptions.${attr.name} — one
    entry per available size — using the increment implied by the raw content (e.g. whole sizes, or half sizes if the text
    mentions half sizes such as "36.5"). Do NOT collapse a range into just two or three sample values.
    CRITICAL — real conversions only: every value inside a "units" object represents the exact SAME physical size expressed in
    different measurement systems. These values must be accurate, mutually-consistent, real-world unit conversions for this
    product type (use standard, well-known conversion tables for the domain, e.g. real EU↔CM↔US shoe-size charts, real
    grip/handle size charts, etc.). NEVER invent a conversion by arithmetic pattern (e.g. never do "primary × 2" or similar
    guesses) and never reuse the same conversion offset across unrelated products or unrelated attributes.`;
    })
    .join("\n\n");

  // ─── Technical Stats ──────────────────────────────────────────────────────
  const technicalStatsInstructions = (category.technicalStats || [])
    .map((stat) => `  - KEY: "${stat.name}" | Label: ${stat.label}`)
    .join("\n");

  const globalTechnicalPrompt = (category.technicalStatsPrompt || "").trim();
  const customTabItemTitles =
    category.customTab?.enabled && Array.isArray(category.customTab?.items)
      ? category.customTab.items.map((item) => item.title).filter(Boolean)
      : [];
  const customTabInstructions = customTabItemTitles.length
    ? customTabItemTitles.map((title) => `  - "${title}"`).join("\n")
    : "";

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

  // ─── Rules: base prompt → category prompt groups → the category's own ─────
  // The static text lives in productPromptConfig.js (editable per rule in the
  // admin panel). Lines that carry injected data stay here and are locked:
  // they are passed as `before`/`after` so no edit can break an ID lock.
  const base = resolveBasePrompt(promptConfig?.base);
  const groups = Array.isArray(promptConfig?.groups) ? promptConfig.groups : [];

  const lockedLines = {
    sport: { before: [`- MUST be exactly: "${sportId}"`] },
    category: { before: [`- MUST be exactly: "${category._id}"`] },
    attributes: {
      after: [audienceScopedAttributeRule || "- Every attribute in this category applies to every target audience."],
    },
    variantMeta: {
      after: [
        multiUnitVariantInstructions
          ? `\nMulti-unit variant attributes for this category:\n${multiUnitVariantInstructions}`
          : "- No multi-unit variant attributes are defined for this category.",
      ],
    },
  };

  const fieldBlocks = PRODUCT_PROMPT_FIELDS
    // the custom tab field exists only for a category whose tab has items
    .filter(({ key }) => key !== "customTabItems" || customTabItemTitles.length)
    .map(({ key }) =>
      renderFieldRules(key, {
        ...lockedLines[key],
        rules: resolveFieldRules({
          base,
          groups,
          categoryId: category._id,
          field: key,
          categoryText:
            key === "technicalStats" ? globalTechnicalPrompt : categoryPromptText(category.prompts, key),
        }),
      }),
    )
    .join("\n\n");

  const intro = [
    base.role.length ? `${base.role.join("\n")}\n\n` : "",
    base.task.length ? `Your task:\n${base.task.map(bulletRule).join("\n")}\n\n` : "",
  ].join("");

  // ─── Build Prompt ─────────────────────────────────────────────────────────
  return `
${intro}${ruleSection("CRITICAL OUTPUT FORMAT RULES — NEVER VIOLATE THESE", base.output.map(numberedRule))}${ruleSection("LANGUAGE RULE", base.language.map(bulletRule))}${BANNER}
FIELD RULES
${BANNER}
${FIELD_PRECEDENCE_NOTE}

${fieldBlocks}

=================================================================
CATEGORY DEFINITION
=================================================================
Category Name : ${category.title}
Category ID   : ${category._id}
Category Sport Name : ${category.sport.name}
Category Sport Title: ${category.sport.title || category.sport.name}
Category Sport ID   : ${sportId}
This category belongs to the sport above. Categories with the same name in other sports are different categories.

Category Attributes (single-value fields → output in "attributes"):
${globalAttributeInstructions || "  (none defined)"}

Variant Attributes (array-value fields → output in "variantOptions"):
${variantAttributeInstructions || "  (none defined)"}

Variant Metadata (value-level metadata → output in "variantMeta"):
${multiUnitVariantInstructions || "  No multi-unit metadata is required. Return {} unless raw content explicitly provides value-level images."}

Category Technical Stats (integer 0–100 → output in "technicalStats"):
${technicalStatsInstructions || "  (none defined)"}

${customTabItemTitles.length ? `Category custom tab items - pick ONLY the ones that genuinely apply to this specific product,
based on the raw content. Use the EXACT title strings below, verbatim (do not paraphrase,
translate, or invent new titles not in this list). If none apply, output an empty array.
Available titles for "${category.customTab.name}":
${customTabInstructions}
` : ""}

=================================================================
AVAILABLE BRANDS
=================================================================
${JSON.stringify(brandList, null, 2)}

=================================================================
AVAILABLE ATHLETES
=================================================================
${JSON.stringify(athleteList, null, 2)}

=================================================================
AVAILABLE SERIES
=================================================================
${JSON.stringify(serieList, null, 2)}

=================================================================
AVAILABLE LIMITED EDITIONS
=================================================================
${JSON.stringify(limitedEditionList, null, 2)}

=================================================================
RAW PRODUCT CONTENT
=================================================================
${rawContent.trim()}

=================================================================
REQUIRED JSON OUTPUT STRUCTURE
=================================================================
Output exactly this structure with no extra fields:

{
  "name": "Persian product name",
  "shortDescription": "Persian HTML short description",
  "longDescription": "Persian HTML long description",
  "color": "#hexcode",
  "basePrice": 0,
  "label": "",
  "targetAudience": "مردانه | زنانه | بچگانه | یونی سکس",
  "brand": "ID_FROM_BRANDS_LIST",
  "serie": "ID_FROM_SERIES_LIST_OR_EMPTY_STRING",
  "limitedEdition": "ID_FROM_LIMITED_EDITIONS_LIST_OR_EMPTY_STRING",
  "sport": "${sportId}",
  "athlete": [],
  "category": "${category._id}",
  "attributes": {
    "English_key": "single value"
  },
  "variantOptions": {
    "English_key": ["value1", "value2"]
  },
  "variantMeta": {},
  "technicalStats": {
    "stat_name": 85
  }${customTabItemTitles.length ? `,
  "customTabItems": ["<exact title from the list above>", "..."]` : ""},
  "tag": [],
  "mainImage": "",
  "gallery": []
}
`;
}
