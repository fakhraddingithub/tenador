/**
 * src/components/common/InitialLoadLoader.jsx
 *
 * لودرِ «لودِ اولیه‌ی سند» — فقط برای رفرش/ورود مستقیم به صفحه.
 *
 * چون فلاشِ بی‌استایل (FOUC) قبل از هیدریت‌شدنِ ری‌اکت رخ می‌دهد، این اورلی باید
 * در همان HTML اولیه‌ی سرور و بدون وابستگی به باندل CSS باشد؛ پس همه‌چیز
 * (استایل + مارک‌آپ + اسکریپت حذف) به‌صورت inline و از طریق dangerouslySetInnerHTML
 * رندر می‌شود. ری‌اکت داخلِ dangerouslySetInnerHTML را هنگام هیدریشن مقایسه
 * نمی‌کند، بنابراین مخفی‌کردنِ اورلی نیاز به تغییر درخت ری‌اکت ندارد.
 *
 * نکته‌ی مهم: ناوبری‌های کلاینتی (router.push) سند را دوباره لود نمی‌کنند، پس این
 * اورلی فقط در این حالت‌ها دیده می‌شود:
 *   ۱) رفرش/لود مستقیم صفحه
 *   ۲) هر ناوبری‌ای که به لودِ کاملِ سند منجر شود (مثل جابه‌جایی بین root layout ها)
 * لودرِ ترنزیشن‌های کلاینتی همچنان با NavigationLoader مدیریت می‌شود.
 *
 * ظاهرِ اورلی عمداً کپیِ RouteLoader است تا تجربه یکدست بماند.
 *
 * نکته‌ی حیاتی (باگِ لودرِ گیرکرده): اگر صفحه‌ای hydration mismatch داشته باشد
 * (مثل صفحه‌ی محصول با فرمتِ تاریخ/عددِ fa-IR که بین ICU سرور و مرورگر فرق دارد)،
 * ری‌اکت ۱۹ کل درخت را روی کلاینت از نو رندر می‌کند؛ در این حالت محتوای
 * dangerouslySetInnerHTML با انتساب innerHTML دوباره ساخته می‌شود که:
 *   الف) اسکریپتِ داخلش هرگز اجرا نمی‌شود، و
 *   ب) نودِ اورلیِ قبلی (که تایمرهای اسکریپتِ اولیه به آن بسته بودند) دور ریخته می‌شود.
 * برای همین hide() فقط اتریبیوت data-tnd-il-done را روی <html> می‌گذارد.
 * قانون CSS هر نسخهٔ دوباره‌ساخته‌شدهٔ اورلی را هم پنهان نگه می‌دارد؛ هیچ
 * نودِ ری‌اکت حذف نمی‌شود و بستن لودر به load، انیمیشن یا تایمر محوشدن وابسته نیست.
 */

import InitialLoadLoaderDismiss from "./InitialLoadLoaderDismiss";

const OVERLAY_HTML = `
<style>
#__tnd-initial-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;pointer-events:none;opacity:1}
html[data-tnd-il-done] #__tnd-initial-loader{display:none!important}
#__tnd-initial-loader .tnd-il-panel{display:flex;flex-direction:column;align-items:center;gap:48px;background:#fff;padding:40px 56px;border-radius:6px;border:1px solid rgba(255,255,255,.72);box-shadow:0 18px 50px rgba(15,23,42,.16)}
#__tnd-initial-loader .tnd-il-logo{width:auto;height:64px;object-fit:contain}
#__tnd-initial-loader .tnd-il-spinner{height:60px;aspect-ratio:2;border-bottom:3px solid #aa4725;position:relative;overflow:hidden}
#__tnd-initial-loader .tnd-il-spinner::before{content:"";position:absolute;inset:auto 42.5% 0;aspect-ratio:1;border-radius:50%;background:#ffbf00;animation:tnd-il-bounce .5s cubic-bezier(0,900,1,900) infinite,tnd-il-move 2s linear infinite}
@keyframes tnd-il-bounce{0%,2%{bottom:0%}98%,to{bottom:.1%}}
@keyframes tnd-il-move{0%{translate:-500%}to{translate:500%}}
@media (prefers-reduced-motion:reduce){#__tnd-initial-loader .tnd-il-spinner::before{animation:none}}
</style>
<noscript><style>#__tnd-initial-loader{display:none}</style></noscript>
<div id="__tnd-initial-loader" role="status" aria-label="در حال بارگذاری">
  <div class="tnd-il-panel">
    <img src="/logo/logo.svg" alt="تنادور" width="180" height="72" class="tnd-il-logo" />
    <span class="tnd-il-spinner" aria-hidden="true"></span>
  </div>
</div>
<script>
(function () {
  if (!document.getElementById("__tnd-initial-loader")) return;
  var hidden = false;
  var safetyTimer;
  var observer;
  var frame;
  function hide() {
    if (hidden) return;
    hidden = true;
    clearTimeout(safetyTimer);
    if (observer) observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    document.removeEventListener("load", scheduleCheck, true);
    document.removeEventListener("DOMContentLoaded", hide);
    window.removeEventListener("pageshow", hide);
    // قفل روی html می‌ماند تا بازسازی اورلی هنگام hydration آن را برنگرداند.
    document.documentElement.setAttribute("data-tnd-il-done", "");
  }
  function checkContent() {
    frame = 0;
    if (hidden) return;
    var content = document.querySelector("[data-tnd-product-content]");
    // The end marker follows the fully server-priced buy box. A streamed,
    // hidden Suspense segment must not dismiss the overlay before it is visible.
    if (!content || !content.querySelector("[data-tnd-product-ready]") ||
        !content.getClientRects().length || getComputedStyle(content).display !== "grid") return;
    var styles = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < styles.length; i++) {
      var link = styles[i];
      if (!link.disabled && (!link.media || window.matchMedia(link.media).matches) && !link.sheet) return;
    }
    hide();
  }
  function scheduleCheck() {
    if (!hidden && !frame) frame = requestAnimationFrame(checkContent);
  }
  // سقف ایمنی برای سندهای ناقص؛ حداقل زمان نمایش نیست.
  safetyTimer = setTimeout(hide, 4000);
  if (document.readyState !== "loading") {
    hide();
  } else {
    if (typeof MutationObserver !== "undefined" && window.location.pathname.startsWith("/products/") &&
        window.location.pathname.split("/").filter(Boolean).length === 2) {
      observer = new MutationObserver(scheduleCheck);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("load", scheduleCheck, true);
      scheduleCheck();
    }
    // تصاویر و منابع دیرهنگام نباید آماده‌شدن صفحه را پشت لودر نگه دارند.
    document.addEventListener("DOMContentLoaded", hide, { once: true });
    window.addEventListener("pageshow", hide, { once: true });
  }
})();
</script>
`;

export default function InitialLoadLoader() {
  return (
    <>
      <div
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: OVERLAY_HTML }}
      />
      {/* پشتیبانِ بستن از سمتِ ری‌اکت — برای صفحاتی مثل ۴۰۴ که اسکریپتِ inlineِ بالا
          روی آن‌ها اجرا نمی‌شود (بدنه فقط به‌صورتِ داده‌ی RSC می‌آید). */}
      <InitialLoadLoaderDismiss />
    </>
  );
}
