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
 */

const OVERLAY_HTML = `
<style>
#__tnd-initial-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;width:100%;min-height:100vh;background:rgba(248,250,252,0.48);backdrop-filter:blur(24px) saturate(70%);-webkit-backdrop-filter:blur(24px) saturate(70%);opacity:1;transition:opacity .3s ease}
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
  var overlay = document.getElementById("__tnd-initial-loader");
  if (!overlay) return;
  var hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    // دو فریم صبر می‌کنیم تا اولین رندرِ استایل‌خورده زیر اورلی نقاشی شود، بعد محو
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = "0";
        overlay.style.pointerEvents = "none";
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
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
    <div
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: OVERLAY_HTML }}
    />
  );
}
