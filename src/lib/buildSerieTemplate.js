export function buildSerieTemplate({
  brand,
  rawContent,
  existingSeries,
}) {
  if (!rawContent || rawContent.trim().length < 20) {
    throw new Error(
      "محتوای خام برای پردازش کافی نیست."
    );
  }

  const seriesContext = existingSeries.length > 0 
    ? existingSeries.map(s => `- ID: "${s._id}", Name: "${s.name}"`).join('\n')
    : "No existing series found (This will be the first one).";

  /*
   |--------------------------------------------------------------------------
   | Prompt Helpers
   |--------------------------------------------------------------------------
   */

  const getPrompt = (field) => {
    return (
      brand.prompts?.find(
        (prompt) => prompt.field === field
      )?.context || ""
    );
  };

  return `
You are an elite E-commerce Catalog Architect specializing in sports equipment taxonomy and product collection hierarchy.

Your task is to transform raw unstructured text into a clean structured JSON object for a product Serie belonging to the brand "${brand.name}".

==================================================
CRITICAL RULES (ABSOLUTELY MANDATORY)
==================================================

1. RETURN JSON ONLY
- No markdown
- No explanations
- No comments
- No intro or outro
- Output must be a valid parsable JSON object

2. NAME FIELD RULE
"name" MUST:
- be fully English
- use only:
  - letters
  - numbers
  - spaces
  - hyphens
  - underscores

Example:
"Blade V9"
"Pure-Aero-98"

3. LANGUAGE RULE
- title → Persian
- shortDescription → Persian
- description → Persian
- name → English

4. BRAND INTEGRITY
You MUST use this exact brand id:
"${brand._id}"

5. LIMITED EDITION DETECTION
If the raw content strongly suggests:
- limited edition
- special edition
- anniversary edition
- collector edition
- rare release

Then:
"isLimitedEdition": true

Otherwise:
"isLimitedEdition": false

6. PARENT SERIE RULE
==================================================
    EXISTING SERIES CONTEXT (FOR HIERARCHY)
    ==================================================
    Below is a list of existing series for the brand ${brand.name}. 
    If the product in the raw content is a sub-collection or a version of one of these, 
    use the corresponding ID as "parentSerie".
    If it's a new standalone/root series, use null.

    List:
    ${seriesContext}

    ==================================================
    PARENT SERIE RULE
    - If it belongs to one of the series above, return the ID string.
    - Otherwise, return null.
    "parentSerie": "ID_HERE" or null

==================================================
DATA EXTRACTION SPECIFICATIONS
==================================================

name:
${getPrompt("name")}

title:
${getPrompt("title")}

shortDescription:
- Write one concise Persian sentence for storefront section headings.
- Keep it shorter than description.

description:
${getPrompt("description")}

colors:
- Extract dominant colors from the text
- Convert colors to HEX format
- Use accurate modern color interpretation
- If no color exists:
  - primary: "#000000"
  - secondary: "#FFFFFF"

==================================================
CONTEXT
==================================================

Brand Name:
${brand.name}

Brand ID:
${brand._id}

Raw Content:
"""
${rawContent}
"""

==================================================
EXPECTED JSON FORMAT
==================================================

{
  "name": "Blade V9",
  
  "title": "بلید ورژن ۹",

  "shortDescription": "خلاصه‌ای کوتاه درباره ویژگی اصلی این سری...",

  "description": "توضیح کامل فارسی درباره سری محصولات...",

  "brand": "${brand._id}",

 "parentSerie": null,

  "isLimitedEdition": false,

  "colors": {
    "primary": "#000000",
    "secondary": "#FFFFFF"
  },

  "logo": "",

  "icon": "",

  "image": ""
}
`;
}
