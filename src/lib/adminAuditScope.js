/**
 * src/lib/adminAuditScope.js
 *
 * دامنه‌ی ممیزیِ یک درخواستِ ادمین.
 *
 * ── مسئله ────────────────────────────────────────────────────────────────
 * گیتِ دسترسی *قبل* از هندلر اجرا می‌شود و فقط کلیدِ دسترسی را می‌داند، پس
 * نمی‌تواند بگوید «کدام سفارش» یا «چه چیزی عوض شد». هندلرها هم ۱۲۱ فایل‌اند.
 * تنها نقطه‌ای که هم *همه‌ی* تغییرات از آن رد می‌شوند و هم مقدارِ قبل و بعد را
 * می‌بیند، خودِ Mongoose است.
 *
 * این ماژول پلِ بین آن دو است: گیت یک دامنه باز می‌کند، پلاگینِ Mongoose
 * (models/auditPlugin.js) رویدادهای واقعیِ نوشتن را داخلش می‌ریزد، و در پایانِ
 * درخواست (`after()`) یک رکوردِ دقیق ساخته می‌شود.
 *
 * ── ⚠️ چرا openAuditScope باید *پیش از اولین await* صدا زده شود ──────────
 * `enterWith` دامنه را روی «فریمِ async فعلی» می‌نشاند. اگر داخلِ یک تابعِ
 * async و *بعد* از یک await صدا زده شود، آن فریم دیگر مالِ فراخوان نیست و
 * ادامه‌ی هندلر چیزی نمی‌بیند — این رفتار روی Node 24 تجربی بررسی شد و
 * دامنه واقعاً گم می‌شد. ولی بدنه‌ی یک تابعِ async تا اولین await هنوز
 * *همان* فریمِ فراخوان است؛ پس دامنه‌ای که آنجا باز شود برای کلِ درخواست
 * دیده می‌شود. شیِ دامنه mutable است، بنابراین محتوایش (ctx و کلیدها) بعد
 * از حل‌شدنِ هویت پر می‌شود.
 *
 * `run(store, cb)` امن‌تر بود ولی امضای هر ۱۲۱ روت را عوض می‌کرد.
 *
 * ── چه چیزی ثبت نمی‌شود ─────────────────────────────────────────────────
 * تا وقتی دامنه `active` نشده، پلاگین هیچ کاری نمی‌کند. فعال‌سازی فقط پس از
 * عبورِ موفقِ گیت با یک کلیدِ *نوشتنی* انجام می‌شود. یعنی ترافیکِ عمومیِ سایت،
 * ورکرها، اسکریپت‌ها و حتی درخواست‌های ردشده‌ی ادمین نه هزینه‌ای می‌دهند و نه
 * رکوردی می‌سازند.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * ⚠️ روی globalThis، نه یک ماژول‌متغیرِ ساده.
 *
 * Next این ماژول را در بیش از یک لایه‌ی باندل قرار می‌دهد: یکی برای
 * `instrumentation` (که پلاگینِ Mongoose را می‌نشاند) و یکی برای روت‌ها. با
 * `new AsyncLocalStorage()` در سطحِ ماژول، هر لایه ذخیره‌گاهِ *خودش* را
 * می‌گرفت؛ گیت روی یکی می‌نوشت و هوکِ Mongoose از دیگری می‌خواند و همیشه
 * خالی می‌دید. در راستی‌آزماییِ سرتاسری دقیقاً همین اتفاق افتاد: هوک‌ها اجرا
 * می‌شدند ولی هیچ رویدادی جمع نمی‌شد.
 *
 * همان الگوی `global._mongooseCache` در configs/db.js.
 */
const storage = (globalThis.__tenadorAuditStorage ??= new AsyncLocalStorage());

/**
 * سقفِ رویداد در یک درخواست.
 *
 * یک عملیاتِ دسته‌ای (مثلاً مرتب‌سازیِ ۲۰۰ محصول) نباید یک سندِ ممیزیِ
 * چندمگابایتی بسازد. مازاد شمرده می‌شود ولی نگه داشته نمی‌شود؛ رکورد صریحاً
 * می‌گوید چند مورد جا نشده.
 */
export const MAX_SCOPE_EVENTS = 40;

/** دامنه‌ی درخواستِ جاری، حتی اگر هنوز فعال نشده باشد. */
export function peekAuditScope() {
  return storage.getStore() || null;
}

/** دامنه‌ی *فعالِ* درخواستِ جاری — چیزی که پلاگین با آن کار می‌کند. */
export function currentAuditScope() {
  const scope = storage.getStore();
  return scope && scope.active && !scope.flushed ? scope : null;
}

/**
 * بازکردنِ دامنه. **باید همگام و پیش از اولین await فراخوان اجرا شود.**
 *
 * اگر دامنه‌ای از قبل باز است همان برمی‌گردد — هندلرهای دومرحله‌ای (گیتِ
 * هویت، بعد گیتِ شاخه‌ای) دو بار گیت را صدا می‌زنند و نباید دو رکورد بسازند.
 */
export function openAuditScope() {
  const existing = storage.getStore();
  if (existing) return existing;

  const scope = {
    ctx: null,
    permissions: [],
    events: [],
    dropped: 0,
    active: false,
    flushed: false,
    handled: false,
  };
  storage.enterWith(scope);
  return scope;
}

/**
 * فعال‌سازیِ دامنه پس از عبورِ گیت. تا این لحظه هیچ رویدادی جمع نمی‌شود.
 */
export function activateAuditScope(scope, { ctx = null, permissions = [] } = {}) {
  if (!scope) return null;
  scope.active = true;
  if (ctx) scope.ctx = ctx;
  for (const key of permissions) {
    if (!scope.permissions.includes(key)) scope.permissions.push(key);
  }
  return scope;
}

/** باز کردن و فعال‌سازی در یک گام — برای تست‌ها و اسکریپت‌ها. */
export function beginAuditScope(init = {}) {
  return activateAuditScope(openAuditScope(), init);
}

/**
 * اجرای یک تابع در دامنه‌ی *ایزوله* — نسخه‌ی `run` به‌جای `enterWith`.
 *
 * روت‌ها نمی‌توانند از این استفاده کنند (باید کلِ هندلر را در بر بگیرد)، ولی
 * تست‌ها و اسکریپت‌ها می‌توانند و باید: با `enterWith` دامنه‌ی یک تست به تستِ
 * بعدی نشت می‌کند.
 */
export function withAuditScope(init, fn) {
  const scope = {
    ctx: init?.ctx || null,
    permissions: [...(init?.permissions || [])],
    events: [],
    dropped: 0,
    active: true,
    flushed: false,
    handled: false,
  };
  return storage.run(scope, () => fn(scope));
}

/**
 * افزودنِ یک رویدادِ نوشتنِ واقعی. از پلاگینِ Mongoose صدا زده می‌شود.
 *
 * هرگز throw نمی‌کند: ممیزی حق ندارد عملیاتِ کاربر را بشکند.
 */
export function recordMutation(event) {
  const scope = currentAuditScope();
  if (!scope) return;

  if (scope.events.length >= MAX_SCOPE_EVENTS) {
    scope.dropped += 1;
    return;
  }
  scope.events.push(event);
}

/**
 * «این روت خودش رکوردِ دقیق را نوشت.»
 *
 * چند روت (نقش‌ها، کاربران) از فاز ۶ رکوردِ دست‌نویسِ خودشان را دارند. آن‌ها
 * نباید یک رکوردِ خودکارِ دوم هم بگیرند، وگرنه یک اقدام دو بار در خطِ زمانی
 * می‌آید و معنیِ رکوردهای موجود هم عوض می‌شود.
 */
export function markAuditHandled() {
  const scope = storage.getStore();
  if (scope) scope.handled = true;
}

/**
 * آیا این رویداد در تراکنشی که برگشت خورده نوشته شده بود؟
 *
 * هوکِ post('save') حتی وقتی تراکنش بعداً abort می‌شود هم اجرا می‌شود. بدونِ
 * این فیلتر، یک عملیاتِ شکست‌خورده به‌عنوان «موفق» ثبت می‌شد — دقیقاً همان
 * چیزی که یک دفترِ ممیزی نباید بکند. وضعیتِ تراکنش پس از endSession هم روی
 * شیِ session باقی می‌ماند، پس می‌شود در پایانِ درخواست خواندش.
 */
export function isRolledBack(event) {
  const state = event?.session?.transaction?.state;
  return state === "TRANSACTION_ABORTED";
}

/** رویدادهای معتبرِ یک دامنه — بدونِ آنچه rollback شده. */
export function committedEvents(scope) {
  return (scope?.events || []).filter((event) => !isRolledBack(event));
}
