/**
 * src/lib/racketMatch/stepNavScroll.js
 *
 * منطقِ خالصِ نوارِ گام‌های پرسشنامه: تشخیصِ درگ از کلیک، ریاضیِ اسکرولِ کشیدنی
 * (سازگار با RTL) و بردنِ گامِ فعال به وسطِ دید.
 *
 * جدا از کامپوننت است تا بشود بدون DOM تستش کرد — همان قراردادی که بقیهٔ
 * منطق‌های این ابزار دارند.
 */

/**
 * آستانهٔ جابه‌جایی برای اینکه یک تعامل «درگ» حساب شود.
 * همان عددِ useDragClickGuard است تا رفتار اسلایدرهای سایت یکدست بماند.
 */
export const DRAG_THRESHOLD_PX = 6;

/** گزینه‌های scrollIntoView برای گامِ فعال — وسطِ نوار، بدون پرشِ عمودیِ صفحه */
export const STEP_SCROLL_OPTIONS = Object.freeze({
  behavior: "smooth",
  block: "nearest",
  inline: "center",
});

/**
 * آیا این حرکت «درگ» است یا هنوز «کلیک»؟
 * فاصلهٔ اقلیدسی حساب می‌شود تا کشیدنِ کمی مورب هم درگ به حساب بیاید.
 */
export function isDragGesture(dx, dy, threshold = DRAG_THRESHOLD_PX) {
  return Math.hypot(dx || 0, dy || 0) >= threshold;
}

/**
 * مقدارِ تازهٔ scrollLeft هنگام کشیدن — ردیابیِ یک‌به‌یکِ اشاره‌گر.
 *
 * قرارداد: محتوا دقیقاً هم‌جهت با انگشت/ماوس حرکت می‌کند. کشیدن به راست یعنی
 * نوار هم به راست می‌رود، و برعکس. انگار خودِ نوار را گرفته‌اید و می‌کشید.
 *
 * چرا بدونِ شرطِ RTL؟ در مرورگرهای امروزی scrollLeft در هر دو جهت یک معنا دارد:
 * هرچه بزرگ‌تر شود، پنجرهٔ دید به سمتِ راستِ محتوا می‌رود. تنها تفاوتِ RTL مبدأ
 * است (در RTL از صفر شروع می‌شود و منفی می‌شود، در LTR از صفر شروع می‌شود و مثبت)
 * نه جهتِ محور. پس برای اینکه محتوا `delta` پیکسل به راست برود، پنجرهٔ دید باید
 * همان‌قدر به چپ برود، یعنی scrollLeft کم شود — در هر دو جهت.
 *
 * پیش از این این‌جا برای RTL علامت برعکس می‌شد (بازمانده‌ی مدلِ قدیمیِ
 * «scrollLeft معکوس» که کروم تا نسخهٔ ۸۵ و IE داشتند و دیگر منسوخ است). نتیجه‌اش
 * این بود که در چیدمانِ راست‌به‌چپِ همین صفحه، کشیدن به چپ نوار را به راست می‌برد.
 *
 * @param {Object} input
 * @param {number} input.startScrollLeft مقدار scrollLeft در لحظهٔ شروع درگ
 * @param {number} input.startX مختصات افقیِ شروع
 * @param {number} input.currentX مختصات افقیِ فعلی
 */
export function dragScrollLeft({ startScrollLeft = 0, startX = 0, currentX = 0 }) {
  const delta = currentX - startX;
  return startScrollLeft - delta;
}

/** شناسهٔ گام‌ها اسلاگ‌اند؛ هر چیز دیگری وارد سلکتور نمی‌شود */
const SAFE_STEP_ID = /^[A-Za-z0-9_-]+$/;

/** سلکتورِ چیپِ یک گام درون نوار */
export function stepChipSelector(stepId) {
  if (!stepId || !SAFE_STEP_ID.test(stepId)) return null;
  return `[data-step-id="${stepId}"]`;
}

/**
 * بردنِ چیپِ گامِ فعال به وسطِ نوار. برای هر دو جهت (جلو رفتن با پاسخ‌دادن و
 * برگشتن با کلیک روی گامِ قبلی) یکسان کار می‌کند، چون فقط به گامِ فعالِ فعلی
 * نگاه می‌کند نه به مسیرِ رسیدن به آن.
 *
 * @returns {boolean} آیا چیزی پیدا و اسکرول شد
 */
export function scrollStepIntoView(container, stepId) {
  const selector = stepChipSelector(stepId);
  if (!container || !selector) return false;

  const chip = container.querySelector?.(selector);
  if (!chip?.scrollIntoView) return false;

  chip.scrollIntoView(STEP_SCROLL_OPTIONS);
  return true;
}
