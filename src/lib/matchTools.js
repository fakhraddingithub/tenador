/**
 * src/lib/matchTools.js
 *
 * منطقِ خالصِ مسیرهای ابزار «مچ». چون اسلاگِ دسته فقط درونِ یک ورزش یکتاست
 * («racket» هم در تنیس هست هم در پدل)، آدرسِ صفحه باید ورزش را هم داشته باشد:
 *
 *     /match/<sportSlug>/<categorySlug>
 *
 * پیش از این آدرس تک‌بخشیِ /match/racket بود و هر دو دسته را به یک صفحه می‌برد.
 */

/** حداقل تعداد شاخصِ فنی برای اینکه یک دسته ابزارِ مچ داشته باشد */
export const MIN_TECHNICAL_STATS = 2;

/**
 * دسته‌هایی که «پرسشنامهٔ راکتِ ایده‌آل» برایشان فعال است.
 * کلید: `<sportSlug>/<categorySlug>`.
 *
 * هر کلید باید در MATCH_QUIZZES در quizRegistry.js هم تعریفی داشته باشد؛
 * تستِ matchRouting.test.mjs همین هم‌خوانی را نگه می‌دارد. این فایل عمداً
 * هیچ چیزی import نمی‌کند تا صفحهٔ سرور با خواندنش تعریفِ همهٔ پرسشنامه‌ها را
 * به باندل نکشد.
 */
export const GUIDED_QUIZ_TOOLS = new Set(["tennis/racket", "padel/racket"]);

/** کلیدِ یکتای یک دسته در ابزارِ مچ */
export function matchToolKey(sportSlug, categorySlug) {
  return `${sportSlug || ""}/${categorySlug || ""}`;
}

/** آیا این دسته پرسشنامهٔ گام‌به‌گام دارد؟ */
export function hasGuidedQuiz(category) {
  return GUIDED_QUIZ_TOOLS.has(matchToolKey(category?.sportSlug, category?.slug));
}

/** مسیرِ صفحهٔ مچِ یک دسته */
export function matchCategoryPath(category) {
  return `/match/${category?.sportSlug}/${category?.slug}`;
}

/** دسته‌هایی که شاخصِ فنیِ کافی برای ابزارِ مچ دارند */
export function matchableCategories(categories = []) {
  return categories.filter(
    (category) =>
      (category?.technicalStats?.length || 0) >= MIN_TECHNICAL_STATS && category?.sportSlug,
  );
}

/**
 * پیدا کردنِ دسته از روی ورزش + اسلاگِ دسته. برخلافِ نسخهٔ قبلی هیچ «حدسِ
 * ورزش» یا ترتیبِ دلبخواهی در کار نیست — ورزش صریح از آدرس می‌آید.
 */
export function findMatchCategory(categories, sportSlug, categorySlug) {
  return matchableCategories(categories).find(
    (category) => category.sportSlug === sportSlug && category.slug === categorySlug,
  );
}

/**
 * آدرس‌های تک‌بخشیِ قدیمی که واقعاً منتشر شده و ایندکس شده‌اند.
 * هر سه به ورزشِ تنیس تعلق داشتند (تنها دستهٔ راکتی که در آدرسِ قدیمی رندر
 * می‌شد، راکتِ تنیس بود). برای آدرس‌هایی که هرگز زنده نبوده‌اند ریدایرکتِ
 * حدسی اضافه نمی‌کنیم.
 */
export const LEGACY_MATCH_REDIRECTS = [
  { from: "/match/racket", to: "/match/tennis/racket" },
  { from: "/match/string", to: "/match/tennis/string" },
  { from: "/match/shoes", to: "/match/tennis/shoes" },
];
