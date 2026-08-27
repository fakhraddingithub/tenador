/**
 * src/lib/racketMatch/quizNavigation.js
 *
 * منطقِ خالصِ حرکت بین گام‌های پرسشنامه — جدا از UI تا بتوان تستش کرد.
 *
 * نکتهٔ اصلی: گامِ فعال با **شناسه** نگه داشته می‌شود، نه با شماره. فهرستِ
 * گام‌ها پویاست (گامِ «قد» فقط برای جونیور می‌آید، گامِ «ایرادِ راکت فعلی» فقط
 * وقتی راکتی انتخاب شده باشد)؛ اگر شماره را نگه می‌داشتیم، با ظاهر/ناپدیدشدنِ
 * یک گام، کاربر بی‌صدا روی گامِ دیگری می‌پرید — همان «حالتِ کهنه» که نباید
 * پس از جابه‌جاییِ غیرخطی پیش بیاید.
 */

/**
 * خلاصهٔ پاسخِ یک گام برای نمایش در نوارِ گام‌ها. اگر بی‌پاسخ باشد null.
 * @returns {string|null}
 */
export function stepSummary(step, answers = {}) {
  if (!step) return null;

  if (step.type === "product-search") {
    return answers.currentRacket?.name || null;
  }

  if (step.type === "price-range") {
    const { min, max } = answers.priceRange || {};
    if (!min && !max) return null;
    const fmt = (value) => Number(value).toLocaleString("fa-IR");
    if (min && max) return `${fmt(min)} تا ${fmt(max)}`;
    return min ? `از ${fmt(min)}` : `تا ${fmt(max)}`;
  }

  const value = answers[step.id];

  if (step.multi) {
    if (!value?.length) return null;
    return value
      .map((key) => step.options?.find((option) => option.value === key)?.label || key)
      .join("، ");
  }

  if (!value) return null;
  return step.options?.find((option) => option.value === value)?.label || value;
}

/** آیا این گام پاسخ گرفته است؟ */
export function isAnswered(step, answers = {}) {
  return stepSummary(step, answers) !== null;
}

/** شمارهٔ گامِ فعال در فهرستِ فعلی؛ ‎-1 یعنی دیگر وجود ندارد */
export function activeStepIndex(steps = [], activeId) {
  return steps.findIndex((step) => step.id === activeId);
}

/**
 * گامِ فعالِ معتبر. اگر گامِ فعال از فهرست حذف شده باشد، به نزدیک‌ترین گامِ
 * موجود (بر اساس شمارهٔ قبلی) برمی‌گردیم تا کاربر بیرون از پرسشنامه نیفتد.
 *
 * @returns {{id: string|null, index: number}}
 */
export function resolveActive(steps = [], activeId, previousIndex = 0) {
  if (!steps.length) return { id: null, index: -1 };

  const index = activeStepIndex(steps, activeId);
  if (index !== -1) return { id: activeId, index };

  const clamped = Math.min(Math.max(previousIndex, 0), steps.length - 1);
  return { id: steps[clamped].id, index: clamped };
}

/**
 * شناسهٔ اولین گامِ بی‌پاسخ بعد از گامِ داده‌شده. اگر همه پاسخ گرفته‌اند، گامِ
 * بعدی (هرچه باشد) و در انتهای فهرست، null.
 */
export function nextUnansweredId(steps = [], answers = {}, fromId = null) {
  const from = activeStepIndex(steps, fromId);
  const rest = steps.slice(from + 1);
  const unanswered = rest.find((step) => !isAnswered(step, answers));
  if (unanswered) return unanswered.id;
  return rest[0]?.id ?? null;
}

/** شناسهٔ گامِ بعدی/قبلی در فهرست؛ null یعنی لبهٔ فهرست */
export function siblingId(steps = [], activeId, offset) {
  const index = activeStepIndex(steps, activeId);
  if (index === -1) return null;
  const target = index + offset;
  if (target < 0 || target >= steps.length) return null;
  return steps[target].id;
}

/**
 * جهتِ انیمیشن: ۱ رو به جلو، ‎-1 رو به عقب.
 * برای پرشِ غیرخطی هم درست کار می‌کند چون فقط اختلافِ شماره‌ها را می‌بیند.
 */
export function slideDirection(fromIndex, toIndex) {
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return 1;
  return toIndex > fromIndex ? 1 : -1;
}

/** درصدِ پیشرفت بر اساس گام‌های پاسخ‌داده‌شده */
export function progressPercent(steps = [], answers = {}) {
  if (!steps.length) return 0;
  const done = steps.filter((step) => isAnswered(step, answers)).length;
  return Math.round((done / steps.length) * 100);
}
