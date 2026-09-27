/**
 * حرکتِ اسلایدرهای صفحه‌ی اصلی — یک جا.
 *
 * اسلایدرهای محصول با Swiper کار می‌کنند و بلوکِ ادغام‌شده با اسکرولِ بومی، پس
 * «همان ریتم» فقط وقتی تضمین می‌شود که عددها یکی باشند و از یک فایل بیایند.
 * مقدارها دقیقاً همان‌هایی‌اند که تا امروز روی صفحه‌ی اصلی اجرا می‌شد:
 * delay از خودِ کامپوننت‌ها، و speed/easing پیش‌فرضِ Swiper که حالا صریح نوشته
 * می‌شود (همان مقدار، پس رفتارِ صفحه‌ی اصلی عوض نمی‌شود).
 */
export const HOME_SLIDER_AUTOPLAY = { delay: 5000, disableOnInteraction: true };

/** میلی‌ثانیه — پیش‌فرضِ Swiper. */
export const HOME_SLIDER_SPEED = 300;

/** cubic-bezier(.25, .1, .25, 1) — همان `ease`، پیش‌فرضِ انتقالِ Swiper. */
export const HOME_SLIDER_EASE = [0.25, 0.1, 0.25, 1];

const axis = (u, a, b) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;

/**
 * همان منحنیِ easing، برای جایی که انتقال با CSS انجام نمی‌شود (scrollLeft را
 * نمی‌شود transition داد). x را با نصف‌کردنِ بازه حل می‌کند و y را برمی‌گرداند.
 */
export function homeSliderEase(t) {
  const [p1x, p1y, p2x, p2y] = HOME_SLIDER_EASE;
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let i = 0; i < 12; i += 1) {
    u = (lo + hi) / 2;
    if (axis(u, p1x, p2x) < t) lo = u;
    else hi = u;
  }
  return axis(u, p1y, p2y);
}
