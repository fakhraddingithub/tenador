import { parseIranDateTimeLocal } from "./iranDateTime.js";

// Omitted PATCH fields retain their stored values; explicit blanks clear them.
export function validateDiscountDates(body, current = {}) {
  const dates = {};
  for (const field of ["startAt", "endAt"]) {
    if (body[field] === undefined) {
      dates[field] = current[field] ?? null;
      continue;
    }
    const value = body[field];
    if (value === null || (typeof value === "string" && !value.trim())) {
      dates[field] = null;
      continue;
    }
    dates[field] = typeof value === "string" ? parseIranDateTimeLocal(value) : null;
    if (!dates[field]) {
      return { error: field === "startAt" ? "تاریخ شروع نامعتبر است" : "تاریخ پایان نامعتبر است" };
    }
  }
  if (dates.startAt && dates.endAt && dates.startAt >= dates.endAt) {
    return { error: "تاریخ شروع باید قبل از تاریخ پایان باشد" };
  }
  return dates;
}
