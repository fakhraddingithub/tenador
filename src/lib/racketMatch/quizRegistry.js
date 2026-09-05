/**
 * src/lib/racketMatch/quizRegistry.js
 *
 * نگاشتِ «کدام دسته، کدام پرسشنامه». تنها جایی که رابط کاربری دربارهٔ ورزش
 * چیزی می‌داند.
 *
 * چرا این‌جا و نه در matchTools.js؟ چون matchTools.js فقط رشته و مسیر است و
 * صفحهٔ سرور از آن استفاده می‌کند؛ اگر تعریفِ گام‌ها را هم به آن اضافه کنیم،
 * هر صفحهٔ /match هر دو پرسشنامه را با خودش می‌کشد. این ماژول فقط از دلِ
 * MatchToolClient (کامپوننتِ کلاینت) وارد باندل می‌شود.
 *
 * فقط تعریفِ *پرسش‌ها* این‌جاست، نه موتورِ امتیازدهی — کاتالوگ و منطقِ تطبیق
 * هرگز به کلاینت نمی‌روند.
 *
 * افزودنِ ورزشِ بعدی = یک سطر این‌جا + یک سطر در GUIDED_QUIZ_TOOLS.
 */

import { matchToolKey } from "@/lib/matchTools";
import * as tennis from "./questions.js";
import * as padel from "./padel/questions.js";

export const MATCH_QUIZZES = {
  "tennis/racket": {
    key: "tennis/racket",
    endpoint: "/api/match/racket",
    steps: tennis.STEPS,
    visibleSteps: tennis.visibleSteps,
    priorityLabels: tennis.PRIORITY_LABELS,
    hasEnoughForPreview: tennis.hasEnoughForPreview,
  },
  "padel/racket": {
    key: "padel/racket",
    endpoint: "/api/match/padel",
    steps: padel.STEPS,
    visibleSteps: padel.visibleSteps,
    priorityLabels: padel.PRIORITY_LABELS,
    hasEnoughForPreview: padel.hasEnoughForPreview,
  },
};

/** پرسشنامهٔ یک دسته؛ null یعنی این دسته پرسشنامهٔ گام‌به‌گام ندارد */
export function quizForCategory(category) {
  return MATCH_QUIZZES[matchToolKey(category?.sportSlug, category?.slug)] ?? null;
}
