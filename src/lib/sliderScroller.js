/**
 * مکانیکِ مشترکِ اسلایدرهایی که روی یک *ظرفِ اسکرولِ بومی* کار می‌کنند
 * (بلوکِ ادغام‌شده و اسلایدرِ تصویر). عملیاتِ DOM، بدونِ React.
 *
 * چرا اینجاست و در هر کامپوننت تکرار نشده: سه چیز در آن‌ها به‌سادگی از هم دور
 * می‌افتد — جهتِ راست‌به‌چپ، خاموش‌کردنِ snap حینِ حرکت، و مدت/منحنیِ حرکت که
 * باید با اسلایدرهای صفحه‌ی اصلی یکی بماند.
 */
import { HOME_SLIDER_SPEED, homeSliderEase } from "@/lib/homeSlider";

/** ۰ تا max در LTR، ۰ تا ‎-max در RTL. `forward` علامتِ «اسلاید بعدی» است. */
export function scrollerBounds(scroller) {
  const max = scroller.scrollWidth - scroller.clientWidth;
  const forward = getComputedStyle(scroller).direction === "rtl" ? -1 : 1;
  return forward < 0 ? { max, forward, lo: -max, hi: 0 } : { max, forward, lo: 0, hi: max };
}

/** عرضِ یک «اسلاید»: خانه‌ی اول به‌اضافه‌ی فاصله‌ی ستونیِ ردیف. */
export function slideDelta(scroller) {
  const row = [...scroller.children].find((child) => child.clientWidth > 0);
  const cell = row?.firstElementChild;
  const gap = parseFloat(getComputedStyle(row || scroller).columnGap) || 0;
  return (cell?.getBoundingClientRect().width || scroller.clientWidth * 0.8) + gap;
}

/**
 * حرکتِ نرم تا `target`، با همان سرعت و منحنیِ اسلایدرهای صفحه‌ی اصلی.
 *
 * چرا با rAF و نه behavior:"smooth": مدتِ smooth را مرورگر تعیین می‌کند و
 * «همان سرعت» آن‌طور به‌دست نمی‌آید. `frame` یک ref است تا حرکتِ قبلی لغو شود —
 * همین است که کلیکِ پیاپی روی فلش‌ها حالتِ اسلایدر را خراب نمی‌کند.
 *
 * snap در طولِ حرکت خاموش است: با scroll-snap: mandatory هر نوشتنِ scrollLeft
 * بی‌درنگ به نزدیک‌ترین نقطه می‌پرد.
 */
export function animateScroll(scroller, target, frame) {
  cancelAnimationFrame(frame.current);
  const from = scroller.scrollLeft;
  const delta = target - from;
  if (!delta) return;
  const started = performance.now();
  // خاموش‌کردن با removeProperty برگردانده می‌شود، نه با بازگرداندنِ مقدارِ
  // ذخیره‌شده: دو حرکتِ هم‌پوشان (کلیکِ پیاپی، یا کلیک وسطِ حرکتِ خودکار)
  // وگرنه «none» را ذخیره می‌کردند و snap برای همیشه خاموش می‌ماند.
  scroller.style.scrollSnapType = "none";
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / HOME_SLIDER_SPEED);
    scroller.scrollLeft = from + delta * homeSliderEase(progress);
    if (progress < 1) frame.current = requestAnimationFrame(tick);
    else scroller.style.removeProperty("scroll-snap-type");
  };
  frame.current = requestAnimationFrame(tick);
}

/**
 * یک خانه جلو (`1`) یا عقب (`-1`)، یا برگشت به ابتدا (`0` — همان کاری که
 * Swiper در انتهای اسلایدر می‌کند). `loop` یعنی از انتها به ابتدا برگردد.
 */
export function stepScroller(scroller, direction, frame, { loop = false } = {}) {
  if (!scroller) return;
  if (!direction) return animateScroll(scroller, 0, frame);
  const { forward, lo, hi, max } = scrollerBounds(scroller);
  const at = Math.abs(scroller.scrollLeft);
  if (loop && direction > 0 && at >= max - EDGE) return animateScroll(scroller, 0, frame);
  if (loop && direction < 0 && at <= EDGE) return animateScroll(scroller, forward * max, frame);
  const next = scroller.scrollLeft + forward * direction * slideDelta(scroller);
  return animateScroll(scroller, Math.min(hi, Math.max(lo, next)), frame);
}

/** رواداریِ لبه بر حسبِ پیکسل — اسکرولِ کسری هرگز دقیقاً روی ۰ یا max نمی‌نشیند. */
export const EDGE = 2;

/** وضعیتِ لبه‌ها برای فعال/غیرفعال‌کردنِ دکمه‌ها. */
export function scrollerEdges(scroller) {
  const max = scroller.scrollWidth - scroller.clientWidth;
  const at = Math.abs(scroller.scrollLeft);
  return { scrolls: max > EDGE, atStart: at <= EDGE, atEnd: at >= max - EDGE };
}
