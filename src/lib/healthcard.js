import HealthCard from "base/models/HealthCard";

/**
 * Validates healthScores array against the category's HealthCard template.
 * Returns null if valid, or an error string if invalid.
 */
export async function validateHealthScores(categoryId, healthScores) {
  const card = await HealthCard.findOne({ category: categoryId }).lean();

  if (!card) {
    // No template defined — skip key validation, allow empty
    if (healthScores.length > 0) {
      return "این دسته‌بندی هیچ HealthCard قالبی ندارد ولی healthScores ارسال شده";
    }
    return null;
  }

  const validKeys = new Set(card.fields.map((f) => f.key));
  const submittedKeys = healthScores.map((s) => s.key);

  // All submitted keys must exist in template
  for (const key of submittedKeys) {
    if (!validKeys.has(key)) {
      return `کلید نامعتبر در healthScores: "${key}"`;
    }
  }

  // All required template keys must be submitted
  for (const key of validKeys) {
    if (!submittedKeys.includes(key)) {
      return `کلید الزامی "${key}" در healthScores وجود ندارد`;
    }
  }

  // No duplicate keys
  if (new Set(submittedKeys).size !== submittedKeys.length) {
    return "کلیدهای تکراری در healthScores";
  }

  return null;
}

/**
 * Calculates overallScore from healthScores + customFields.
 * Ratings are scored out of 10, so the overall score is the rounded average.
 */
export function calcOverallScore(healthScores, customFields) {
  const all = [...healthScores, ...customFields];
  if (all.length === 0) return null;
  const avg = all.reduce((sum, s) => sum + s.rating, 0) / all.length;
  return Math.round(avg);
}