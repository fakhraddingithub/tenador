/**
 * src/components/common/InitialLoadLoader.jsx
 *
 * لودرِ «لودِ اولیه‌ی سند» — فقط برای رفرش/ورود مستقیم به صفحه.
 *
 * چون فلاشِ بی‌استایل (FOUC) قبل از هیدریت‌شدنِ ری‌اکت رخ می‌دهد، این اورلی باید
 * در همان HTML اولیه‌ی سرور و بدون وابستگی به باندل CSS باشد؛ پس همه‌چیز
 * (استایل + مارک‌آپ + اسکریپت حذف) به‌صورت inline و از طریق dangerouslySetInnerHTML
 * رندر می‌شود. ری‌اکت داخلِ dangerouslySetInnerHTML را هنگام هیدریشن مقایسه
 * نمی‌کند، بنابراین حذفِ اورلی توسط اسکریپت باعث خطای hydration نمی‌شود.
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
 * برای همین hide() نباید به نودِ گرفته‌شده در لحظه‌ی parse تکیه کند (هر بار با
 * getElementById نودِ فعلی را پیدا می‌کند) و بعد از اتمام، اتریبیوت
 * data-tnd-il-done روی <html> می‌نشیند تا قانونِ CSSِ همراهِ اورلی هر نسخه‌ی
 * دوباره‌ساخته‌شده را هم پنهان کند (خودِ <html> هیچ‌وقت توسط ری‌اکت تعویض نمی‌شود
 * و اتریبیوت‌های خارج از مدیریتش دست‌نخورده می‌مانند).
 */

import InitialLoadLoaderDismiss from "./InitialLoadLoaderDismiss";

const OVERLAY_HTML = `
<style>
#__tnd-initial-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;pointer-events:none;opacity:1;transition:opacity .3s ease}
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
  function hide() {
    if (hidden) return;
    hidden = true;
    // دو فریم صبر می‌کنیم تا اولین رندرِ استایل‌خورده زیر اورلی نقاشی شود، بعد محو.
    // نود هر بار تازه پیدا می‌شود؛ نودِ لحظه‌ی parse ممکن است با ری‌رندرِ کلاینتیِ
    // ری‌اکت (بعد از hydration mismatch) دور ریخته و جایگزین شده باشد.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var el = document.getElementById("__tnd-initial-loader");
        if (el) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        }
        setTimeout(function () {
          // قفلِ دائمی: هر نسخه‌ای از اورلی که بعداً دوباره درج شود، با قانونِ
          // html[data-tnd-il-done] در همان استایلِ inline پنهان می‌ماند
          document.documentElement.setAttribute("data-tnd-il-done", "");
          var current = document.getElementById("__tnd-initial-loader");
          if (current && current.parentNode) {
            current.parentNode.removeChild(current);
          }
        }, 350);
      });
    });
  }
  if (document.readyState === "complete") {
    hide();
  } else {
    window.addEventListener("load", hide);
  }
  // بازگشت از bfcache یا هر pageshow دیگر نباید اورلی را زنده نگه دارد
  window.addEventListener("pageshow", hide);
  // سقف ایمنی: اگر load (مثلاً به‌خاطر تصاویر سنگین) دیر شد، صفحه را گروگان نگیر
  setTimeout(hide, 4000);
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
