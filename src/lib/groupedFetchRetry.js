/**
 * src/lib/groupedFetchRetry.js
 *
 * سیاستِ مشترکِ «تلاشِ مجددِ خودکار» برای واکشیِ بخش‌بندی‌شده‌ی برند و سری.
 * توابعِ خالص و بدونِ وابستگی به React — هر دو نما (BrandGroupedView و
 * SerieGroupedView) دقیقاً همین سیاست را به‌کار می‌برند تا از واگرا شدنِ دو
 * نسخه‌ی موازی جلوگیری شود.
 */

// مهلتِ هر تلاش. شواهدِ اندازه‌گیری‌شده: ~۷.۴ ثانیه p95 در پروداکشن و ~۱۲.۸ ثانیه
// در اجرای سردِ محلی — هر دو «پیش از» پروجکشن و batch شدنِ قیمت‌گذاری. با سبک‌شدنِ
// پاسخ انتظار می‌رود بسیار کمتر شود؛ ۲۵ ثانیه با فاصله‌ی امن بالای بدترین مشاهده
// است: سوکتِ معلق را می‌بندد ولی درخواستِ کُندِ موفق را به خطا بدل نمی‌کند.
export const REQUEST_DEADLINE_MS = 25000;
export const RETRY_BASE_MS = 1000;
export const RETRY_MAX_MS = 30000;
// سقفِ احترام به Retry-After — سرور می‌تواند عددِ خیلی بزرگ بدهد؛ بی‌نهایت صبر
// نمی‌کنیم، ولی هرگز زودتر از خواسته‌ی سرور هم تلاش نمی‌کنیم مگر از این سقف بگذرد.
export const RETRY_AFTER_CAP_MS = 60000;

// ۴۰۸ Request Timeout · ۴۲۵ Too Early · ۴۲۹ Too Many Requests
const RETRYABLE_STATUS = new Set([408, 425, 429]);

// ۱s → ۲s → ۴s → ۸s → ۱۶s → سقفِ ۳۰s، با ±۲۵٪ jitter تا چند کلاینت هم‌زمان
// دوباره با هم به سرور نزنند.
export const backoffDelay = (attempt, retryAfterMs) => {
  // Retry-After صریحِ سرور بر backoffِ محلی مقدم است و پایین‌تر کشیده نمی‌شود
  if (retryAfterMs > 0) return Math.min(RETRY_AFTER_CAP_MS, retryAfterMs);
  const exp = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
  return Math.min(RETRY_MAX_MS, exp * (0.75 + Math.random() * 0.5));
};

const parseRetryAfter = (res) => {
  const raw = res.headers?.get?.("Retry-After");
  if (!raw) return 0;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(raw);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : 0;
};

// آفلاین یا تبِ پنهان → تلاش نکن (جلوگیری از طوفانِ درخواستِ بی‌فایده)
const canAttemptNow = () =>
  (typeof navigator === "undefined" || navigator.onLine !== false) &&
  (typeof document === "undefined" || document.visibilityState !== "hidden");

/**
 * تأخیرِ backoff. اگر در پایانِ تأخیر آفلاین یا پنهان باشیم، منتظر می‌ماند و با
 * رویدادِ online / visibilitychange ادامه می‌دهد.
 * @returns {Promise<boolean>} true یعنی حالا تلاش کن، false یعنی لغو شد.
 */
export const waitBeforeRetry = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    let timer = null;
    let elapsed = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
    function onAbort() {
      cleanup();
      resolve(false);
    }
    function check() {
      if (signal.aborted) return onAbort();
      if (elapsed && canAttemptNow()) {
        cleanup();
        resolve(true);
      }
    }

    signal.addEventListener("abort", onAbort);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    timer = setTimeout(() => {
      elapsed = true;
      check();
    }, ms);
  });

/**
 * یک تلاشِ واحد. مهلتِ درخواست با AbortControllerِ داخلی اعمال می‌شود تا
 * «تایم‌اوت» از «کنار گذاشته‌شدن» (signalِ بیرونی) قابلِ تفکیک بماند.
 * @returns {Promise<{kind:"success"|"recoverable"|"terminal"|"aborted", ...}>}
 */
export const attemptFetch = async (url, outerSignal) => {
  // اگر پیش از شروع لغو شده‌ایم، اصلاً درخواستی نفرست
  if (outerSignal.aborted) return { kind: "aborted" };

  const ac = new AbortController();
  const relay = () => ac.abort();
  outerSignal.addEventListener("abort", relay);
  let timer = null;
  let timedOut = false;

  try {
    timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, REQUEST_DEADLINE_MS);

    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) {
      if (RETRYABLE_STATUS.has(res.status) || res.status >= 500) {
        return {
          kind: "recoverable",
          retryAfterMs: parseRetryAfter(res),
          reason: `HTTP ${res.status}`,
        };
      }
      // ۴xxِ دیگر: خطای درخواست است، نه اختلالِ گذرا → بی‌نهایت تکرار نشود
      return { kind: "terminal", reason: `HTTP ${res.status}` };
    }
    return { kind: "success", data: await res.json() };
  } catch (e) {
    if (outerSignal.aborted) return { kind: "aborted" };
    if (timedOut) return { kind: "recoverable", reason: "request deadline" };
    // خطای شبکه یا پاسخِ غیرِ JSON (مثلاً صفحه‌ی خطای پراکسی) — گذرا فرض می‌شود
    return { kind: "recoverable", reason: e?.message || "network error" };
  } finally {
    if (timer) clearTimeout(timer);
    outerSignal.removeEventListener("abort", relay);
  }
};
