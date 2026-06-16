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
      return `  - KEY: "${attr.name}" | Persian Label (context only): ${attr.label} | Type: array of strings${rule}`;
    })
    .join("\n");

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
  "technicalStats": {
    "stat_name": 85
  },
  "tag": [],
  "mainImage": "",
  "gallery": []
}
`;
}