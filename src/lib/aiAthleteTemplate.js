export function buildAthleteAiTemplate({ sports, sponsors, rawContent }) {
  if (!rawContent || rawContent.trim().length < 30) {
    throw new Error("متن ورودی برای استخراج اطلاعات کافی نیست");
  }

  // آماده‌سازی لیست رشته‌ها برای هوش مصنوعی
  const sportList = sports.map((s) => ({
    id: s._id.toString(),
    name: s.name,
  }));

  // آماده‌سازی لیست اسپانسرهای موجود در پایگاه داده
  const sponsorList = sponsors.map((sp) => ({
    id: sp._id.toString(),
    name: sp.name,
    brand: sp.brandEn || "", // اگر نام انگلیسی هم دارید اضافه کنید تا دقت بالا برود
  }));

  return `
  You are a senior sports journalist and data analyst specializing in athlete profiles.
  Your task is to extract information from RAW CONTENT and map it to our database entities.

  ===============================
  GLOBAL RULES
  ===============================
  - Output ONLY valid JSON
  - Language: PERSIAN (fa-IR) for "title", "nationality", "bio", and "honors.title"
  - For missing fields, use null for numbers and empty string "" for strings
  - DO NOT invent data. If not mentioned, leave it empty.

  ===============================
  ENTITY MAPPING RULES (CRITICAL)
  ===============================
  1. sport: Select the most relevant ID from AVAILABLE SPORTS.
  2. sponsors: Compare brands mentioned in text with AVAILABLE SPONSORS. 
     - ONLY return the ID of the sponsor.
     - If a brand is mentioned but NOT in the list, DO NOT include it.

  ===============================
  FIELD DEFINITIONS
  ===============================
  - name: English Slug (e.g. "hadi-choopan")
  - title: Persian Full Name
  - gender: ONLY "male" or "female" (based on the context of the raw content)
  - birthDate: YYYY-MM-DD
  - height: Number (cm)
  - weight: Number (kg)
  - honors: Array of [{ "title": string, "quantity": number }]
  - bio: Professional summary (3-4 sentences)

  ===============================
  AVAILABLE SPORTS (Mapping Source)
  ===============================
  ${JSON.stringify(sportList, null, 2)}

  ===============================
  AVAILABLE SPONSORS (Mapping Source)
  ===============================
  ${JSON.stringify(sponsorList, null, 2)}

  ===============================
  RAW CONTENT
  ===============================
  ${rawContent}

  ===============================
  REQUIRED JSON FORMAT
  ===============================
  {
    "name": "",
    "title": "",
    "gender": "",
    "sport": "ID_FROM_LIST",
    "birthDate": "",
    "height": null,
    "weight": null,
    "nationality": "",
    "bio": "",
    "honors": [],
    "sponsors": ["ID_1", "ID_2"] 
  }
  `;
}