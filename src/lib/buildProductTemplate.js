/**
 * buildProductTemplate.js
 *
 * Generates a structured AI prompt for extracting product data from raw content.
 * Returns a prompt string that instructs the AI to output valid, consistent JSON.
 */

/**
 * Extracts the context string for a given field from category.prompts array.
 * Safely handles null/undefined and returns a clean string.
 *
 * @param {Array}  prompts  - category.prompts array
 * @param {string} field    - field name to look up
 * @returns {string}
 */
function getPromptContext(prompts, field) {
  if (!Array.isArray(prompts)) return "No specific rule defined.";
  const match = prompts.find((p) => p?.field === field);
  return match?.context?.toString().trim() || "No specific rule defined.";
}

/**
 * Builds the full AI prompt for product data extraction.
 *
 * @param {Object} params
 * @param {Object}   params.category        - Populated category document
 * @param {Array}    params.brands           - Populated brand documents (with .series)
 * @param {Array}    params.sports           - Sport documents
 * @param {Array}    params.athletes         - Athlete documents
 * @param {Array}   [params.limitedEditions] - Limited edition documents (optional)
 * @param {string}   params.rawContent       - Raw text to extract product data from
 * @returns {string} - The complete prompt string
 */
export function buildProductTemplate({
  category,
  brands,
  sports,
  athletes,
  limitedEditions = [],
  rawContent,
}) {
  // ─── Input Validation ─────────────────────────────────────────────────────
  if (!category) throw new Error("category is required");
  if (!category._id) throw new Error("category._id is required");
  if (!Array.isArray(brands)) throw new Error("brands must be an array");
  if (!Array.isArray(sports)) throw new Error("sports must be an array");
  if (!Array.isArray(athletes)) throw new Error("athletes must be an array");
  if (typeof rawContent !== "string" || rawContent.trim().length < 50) {
    throw new Error("rawContent is too short (minimum 50 characters)");
  }

  // ─── Category Global Attributes ───────────────────────────────────────────
  // These produce single-value fields in "attributes" object.
  // The KEY the AI must use is attr.name (English). The label (Persian) is shown for context only.
  const globalAttributeInstructions = (category.attributes || [])
    .map((attr) => {
      const rule = attr.prompt ? ` | Extraction Rule: ${attr.prompt}` : "";
      return `  - KEY: "${attr.name}" | Persian Label (context only): ${attr.label} | Type: single string or number${rule}`;
    })
    .join("\n");

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

  // ─── Reference Lists ──────────────────────────────────────────────────────
  const brandList = brands.map((b) => ({
    id: b._id.toString(),
    name: b.name,
  }));

  const sportList = sports.map((s) => ({
    id: s._id.toString(),
    name: s.name,
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

  // Limited editions belong to a specific brand (e.g. Roland Garros).
  const limitedEditionList = limitedEditions.map((c) => ({
    id: c._id.toString(),
    name: c.name || c.title,
  }));

  // ─── Per-field Prompt Contexts ────────────────────────────────────────────
  const fieldRules = {
    name: getPromptContext(category.prompts, "name"),
    shortDescription: getPromptContext(category.prompts, "shortDescription"),
    longDescription: getPromptContext(category.prompts, "longDescription"),
    color: getPromptContext(category.prompts, "color"),
    basePrice: getPromptContext(category.prompts, "basePrice"),
    label: getPromptContext(category.prompts, "label"),
    tag: getPromptContext(category.prompts, "tag"),
  };

  // ─── Build Prompt ─────────────────────────────────────────────────────────
  return `
You are a senior Persian e-commerce product manager AI.

Your task:
- READ the raw product content provided below.
- EXTRACT and GENERATE a complete product JSON object.
- OUTPUT only the JSON — nothing else.

=================================================================
CRITICAL OUTPUT FORMAT RULES — NEVER VIOLATE THESE
=================================================================
1. Output ONLY raw JSON. Start with { and end with }.
2. NO markdown code fences (no \`\`\`json, no \`\`\`).
3. NO explanations, comments, or text before or after the JSON.
4. NO trailing commas anywhere.
5. ALL string values must be wrapped in balanced double quotes.
6. Validate JSON structure mentally before responding.
7. If you detect any syntax error in your output, fix it before responding.
8. Treat this output as production data — not a draft.

=================================================================
LANGUAGE RULE
=================================================================
- All human-readable content (name, descriptions, tag, etc.) → PERSIAN (fa-IR)
- JSON keys → Exactly as specified in the rules below (English)
- Attribute keys → MUST be the English KEY shown in "Category Attributes" section
  DO NOT use Persian labels as keys — they are provided for context only.

=================================================================
FIELD RULES
=================================================================

name:
${fieldRules.name}

shortDescription:
${fieldRules.shortDescription}

longDescription:
${fieldRules.longDescription}

color:
${fieldRules.color}

basePrice:
${fieldRules.basePrice}

label:
${fieldRules.label}
- Allowed values: "new" | "discount" | "best_seller" | "" (empty string if none)

score:
- DO NOT include this field at all.

brand:
- Choose exactly ONE id from AVAILABLE BRANDS.
- Match by semantic meaning. Do NOT guess.

serie:
- Choose exactly ONE id from AVAILABLE SERIES — OR an empty string "" if none matches.
- CRITICAL: The chosen serie's "parentBrandId" MUST match your selected brand's id.
- If a series is mentioned in the text but belongs to a different brand, ignore it and return "".
- A product can only have a serie from its own brand.

limitedEdition:
- Limited editions are brand-specific special releases (e.g. Roland Garros).
- Choose exactly ONE id from AVAILABLE LIMITED EDITIONS — OR an empty string "" if none applies.
- Only pick a limited edition if the raw content clearly and explicitly mentions it.
- A product can have BOTH a serie and a limited edition at the same time.

sport:
- Choose exactly ONE id from AVAILABLE SPORTS based on actual product usage.

athlete:
- Pick ALL relevant athlete ids from AVAILABLE ATHLETES as a JSON array.
- If none mentioned → return [].

category:
- MUST be exactly: "${category._id}"
- Do NOT change this value.

attributes:
- This is a flat JSON object of single string or number values.
- Keys MUST be the exact English "KEY" field defined in "Category Attributes" below.
  ✗ Wrong: { "اندازه صفحه": "100" }
  ✓ Correct: { "Head Size": "100" }
- If a value is NOT found in raw content:
  - If the attribute is logically required → infer it from professional knowledge.
  - If it is optional → omit the key entirely.

variantOptions:
- This is a flat JSON object where each value is an ARRAY of strings.
- Keys MUST be the exact English "KEY" field defined in "Variant Attributes" below.
- Extract EVERY value mentioned in the raw content for each key.
  Example: { "Grip": ["L2", "L3", "L4"] }
- If no variant attributes are defined → return {}.
- For normal/non-unit variant attributes, keep the current behavior: array of plain strings.
- For multi-unit variant attributes:
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
    secondary unit value by an arbitrary formula or pattern — only use correct, known conversions.

variantMeta:
- This is a JSON object for value-level variant metadata.
- Always include this field. If there is no metadata → return {}.
- Shape:
  {
    "variantAttributeKey": {
      "variantOptionPrimaryValue": {
        "units": { "unitLabel": "value as string" },
        "images": []
      }
    }
  }
- For every multi-unit variant value, variantMeta is REQUIRED.
- The variantMeta key must exactly match a value from variantOptions for the same attribute.
- The units object must include every unit label defined for that attribute, including the primary unit.
- Use strings for unit values, even when they look numeric.
- If an attribute is not multi-unit, do not add units for it. You may omit it from variantMeta unless value-level images are explicitly available.
${multiUnitVariantInstructions ? `\nMulti-unit variant attributes for this category:\n${multiUnitVariantInstructions}` : "- No multi-unit variant attributes are defined for this category."}

technicalStats:
- A flat JSON object for radar chart scoring.
- Keys MUST exactly match the names in "Category Technical Stats" below.
- Values MUST be integers between 0 and 100.
- Use professional judgment when the raw content does not explicitly state a score.
${globalTechnicalPrompt ? `\nScoring Guidance:\n${globalTechnicalPrompt}` : ""}
- If no technical stats are defined for this category → return {}.

tag:
${fieldRules.tag}
- Must be a JSON array of Persian strings.
- If none → return [].

mainImage:
- A direct image URL string if available in raw content.
- If not found → return "".

gallery:
- An array of direct image URL strings.
- If none found → return [].

=================================================================
CATEGORY DEFINITION
=================================================================
Category Name : ${category.title}
Category ID   : ${category._id}

Category Attributes (single-value fields → output in "attributes"):
${globalAttributeInstructions || "  (none defined)"}

Variant Attributes (array-value fields → output in "variantOptions"):
${variantAttributeInstructions || "  (none defined)"}

Variant Metadata (value-level metadata → output in "variantMeta"):
${multiUnitVariantInstructions || "  No multi-unit metadata is required. Return {} unless raw content explicitly provides value-level images."}

Category Technical Stats (integer 0–100 → output in "technicalStats"):
${technicalStatsInstructions || "  (none defined)"}

=================================================================
AVAILABLE BRANDS
=================================================================
${JSON.stringify(brandList, null, 2)}

=================================================================
AVAILABLE SPORTS
=================================================================
${JSON.stringify(sportList, null, 2)}

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
  "brand": "ID_FROM_BRANDS_LIST",
  "serie": "ID_FROM_SERIES_LIST_OR_EMPTY_STRING",
  "limitedEdition": "ID_FROM_LIMITED_EDITIONS_LIST_OR_EMPTY_STRING",
  "sport": "ID_FROM_SPORTS_LIST",
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
  },
  "tag": [],
  "mainImage": "",
  "gallery": []
}
`;
}