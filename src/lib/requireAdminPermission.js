/**
 * src/lib/requireAdminPermission.js
 *
 * گیتِ واحدِ روت‌های ادمین — فاز ۲ (enforcement).
 *
 * جایگزین `requireAdmin()` در هندلرها: علاوه بر «ادمین هست؟»، «این کلید را
 * دارد؟» را هم بررسی می‌کند و ۴۰۱ را از ۴۰۳ جدا می‌کند.
 *
 * قرارداد ۴۰۱/۴۰۳ در `decideGateOutcome` (src/lib/adminGuards.js) تعریف و تست
 * شده است؛ این فایل فقط پوسته‌ی HTTP آن است:
 *   ۴۰۱ → هیچ هویتی نداریم (توکن نیست/نامعتبر، یا کاربر در دیتابیس نیست)
 *   ۴۰۳ → هویت هست ولی مجاز نیست (بدون عضویت، لغو‌شده، تکراری، مسدود، یا
 *          نداشتنِ همان کلید)
 *
 * ⚠️ مسیر legacy: تا وقتی مهاجرت اجرا نشده، کاربرانِ `User.role === "admin"`
 * که هیچ سند Admin ندارند از مسیر legacy وارد می‌شوند و همه‌ی کلیدها را
 * دارند — یعنی enforcement عملاً روی آن‌ها محدودیتی نمی‌گذارد. این عمدی است:
 * در غیر این صورت با روشن‌شدنِ enforcement هر ۸ ادمینِ فعلی قفلِ بیرون
 * می‌شدند. با اجرای مهاجرت این مسیر بسته می‌شود و enforcement واقعی می‌شود.
 */

import { after } from "next/server";

import { resolveAdminContext } from "@/lib/adminContext";
import { decideGateOutcome } from "@/lib/adminGuards";
import {
  recordAdminActivity,
  recordAuthorizationDenial,
} from "@/lib/adminActivity";
import { activateAuditScope, openAuditScope } from "@/lib/adminAuditScope";
import { flushAuditScope } from "@/lib/adminAuditFlush";

/** ۴۰۱ — هیچ هویتِ معتبری وجود ندارد. */
export function unauthorized() {
  return Response.json({ message: "دسترسی غیرمجاز" }, { status: 401 });
}

/**
 * ۴۰۳ — هویت هست، ولی مجاز نیست.
 *
 * عمداً هیچ جزئیاتی برنمی‌گرداند: نه کلیدِ لازم، نه دلیلِ رد. اینها ساختار
 * داخلیِ مجوزدهی را لو می‌دهند و به مهاجم نقشه‌ی کلیدها می‌دهند. دلیل فقط در
 * لاگِ سرور می‌ماند.
 */
export function forbidden() {
  return Response.json(
    { message: "شما دسترسی لازم برای این عملیات را ندارید" },
    { status: 403 }
  );
}

/**
 * گیتِ هندلر.
 *
 * @param {string|string[]|null} required کلید(های) لازم. `null` یعنی «هر ادمینِ
 *        معتبر» (مثل رجیستری دسترسی‌ها یا وضعیت اعلان‌های خودِ ادمین).
 * @param {{mode?: "all"|"any", audit?: boolean}} [options]
 *        `audit: false` فقط ثبتِ *خودکارِ* «مجاز شد» را خاموش می‌کند و برای
 *        روت‌هایی است که خودشان رکوردِ دقیق‌تری می‌نویسند. ثبتِ ردها هرگز
 *        خاموش نمی‌شود.
 * @returns {Promise<{actor: object|null, ctx: object|null, denied: Response|null}>}
 *
 * الگوی مصرف در هندلر:
 *   const { denied } = await requireAdminPermission("products.create");
 *   if (denied) return denied;
 *
 * `actor` عمداً هم‌شکلِ خروجیِ قدیمیِ `requireAdmin()` است (`_id`, `role`,
 * `userId`) تا هندلرهایی که برای ردپای ممیزی به `admin.userId` تکیه دارند
 * بدون تغییر کار کنند.
 */
export default async function requireAdminPermission(required = null, options) {
  // ⚠️ همگام و پیش از اولین await — و این ترتیب اتفاقی نیست.
  // `enterWith` دامنه را روی فریمِ async فعلی می‌نشاند؛ تا اینجا آن فریم هنوز
  // مالِ *هندلر* است، پس دامنه در ادامه‌ی درخواست دیده می‌شود. اگر یک await
  // جلوتر بیفتد، دامنه در همین تابع دفن می‌شود و پلاگین هیچ‌وقت پیدایش
  // نمی‌کند. جزئیات در src/lib/adminAuditScope.js.
  const scope = openAuditScope();

  // ⚠️ ctx حتی وقتی isAdmin=false است هم برگردانده می‌شود؛ همین تفاوتِ
  // «هویت نداریم» با «مجاز نیست» را ممکن می‌کند.
  const ctx = await resolveAdminContext();
  const decision = decideGateOutcome({
    ctx,
    required,
    mode: options?.mode || "all",
  });

  // ── ممیزیِ خودکارِ ردها (فاز ۶) ────────────────────────────────────────
  // اینجا تنها نقطه‌ای است که *همه‌ی* ردهای مجوز از آن رد می‌شوند، پس ثبتِ
  // آن‌ها هیچ تغییری در ۱۹۰ هندلر لازم ندارد.
  //
  // ⚠️ این یکی عمداً await می‌شود. نسخه‌ی اولش نمی‌شد و در اجرای واقعی
  // مشخص شد ردها اصلاً نوشته نمی‌شوند: هندلر بلافاصله پاسخ می‌دهد و
  // promiseِ معلق قبل از رسیدن به دیتابیس قطع می‌شود. رکوردِ رد
  // امنیتی‌ترین چیزی است که این دفتر دارد و «بهترین تلاش» برایش کافی نیست.
  // درخواستی که رد شده هیچ عملیاتِ کاربری‌ای ندارد که چند میلی‌ثانیه
  // تأخیرش مهم باشد. شکستِ نوشتن همچنان بی‌صدا است و رد را عوض نمی‌کند.
  if (decision.status !== 200) {
    await recordAuthorizationDenial({
      ctx,
      required,
      mode: options?.mode,
      statusCode: decision.status,
      reason: decision.outcome,
    });
  }

  if (decision.status === 401) {
    return { actor: null, ctx: null, denied: unauthorized() };
  }

  if (decision.status === 403) {
    console.warn(
      `[authz] 403 user=${ctx?.userId || "?"} reason=${decision.outcome} required=${
        Array.isArray(required) ? required.join(",") : required || "-"
      }`
    );
    return { actor: null, ctx, denied: forbidden() };
  }

  // ── ممیزی (فاز ۹) ──────────────────────────────────────────────────────
  // روت‌هایی که خودشان رکوردِ کاملِ success/failure + diff می‌نویسند با
  // `{ audit: false }` این ثبتِ خودکار را خاموش می‌کنند.
  if (options?.audit !== false) {
    const keys = asKeys(required);
    const writes = keys.filter((key) => !isReadKey(key));
    const auditedReads = keys.filter((key) => AUDITED_READ_KEYS.has(key));

    // برای یک درخواستِ نوشتنی، دامنه فعال می‌شود و رکورد در *پایانِ* درخواست
    // ساخته می‌شود — آن‌وقت دیگر معلوم است کدام سفارش، کدام محصول، و چه
    // چیزی از چه به چه تغییر کرد. اگر هیچ نوشتنی رخ ندهد، همان رکوردِ
    // `authz.granted / attempted`ِ قبلی ثبت می‌شود، پس معنیِ رکوردهای قدیمی
    // دست‌نخورده می‌ماند.
    if (writes.length) {
      activateAuditScope(scope, { ctx, permissions: writes });
      scheduleAuditFlush(scope);
    }

    // خواندن‌های حساس همان‌جا ثبت می‌شوند؛ نوشتنی در کار نیست که منتظرش بمانیم.
    if (auditedReads.length) {
      recordAdminActivity({
        ctx,
        action: "authz.read",
        permissions: auditedReads,
        result: "attempted",
        statusCode: 200,
      });
    }
  }

  return {
    actor: { _id: ctx.user._id, role: ctx.user.role, userId: ctx.userId },
    ctx,
    denied: null,
  };
}

/**
 * ثبتِ رکوردِ پایانِ درخواست.
 *
 * `after()` بعد از ارسالِ پاسخ اجرا می‌شود، پس ساختِ رکورد هیچ تأخیری به
 * عملیاتِ ادمین اضافه نمی‌کند و هندلر هم لازم نیست چیزی صدا بزند. در محیطی
 * که درخواستی در جریان نیست (تست، اسکریپت) `after` خطا می‌دهد و ثبت به
 * فراخوانِ دستیِ flush واگذار می‌شود.
 */
function scheduleAuditFlush(scope) {
  if (scope.flushScheduled) return;
  scope.flushScheduled = true;
  try {
    after(() => flushAuditScope(scope));
  } catch {
    scope.flushScheduled = false;
  }
}

function asKeys(required) {
  if (Array.isArray(required)) return required.filter((key) => typeof key === "string");
  return typeof required === "string" ? [required] : [];
}

/**
 * کلیدهایی که خواندنی‌اند ولی پسوندِ `.view` ندارند.
 *
 * بدونِ این فهرست، `admins.viewActivity` «نوشتنی» تشخیص داده می‌شد و هر بار
 * باز کردنِ خودِ دفتر یک رکوردِ «اقدامِ نوشتنی» می‌ساخت — دفتری که خودش را
 * پر می‌کند.
 */
const NON_SUFFIX_READ_KEYS = new Set(["admins.viewActivity", "analytics.export"]);

const isReadKey = (key) => key.endsWith(".view") || NON_SUFFIX_READ_KEYS.has(key);

/**
 * خواندن‌هایی که *باید* ثبت شوند.
 *
 * تصمیمِ صریح فاز ۶: خواندن‌های عادی ثبت نمی‌شوند (حجمِ بی‌فایده و پرنویز)،
 * ولی دو مورد استثناست چون خودشان حساس‌اند:
 *   • admins.viewActivity — «چه کسی دفترِ ممیزی را خوانده» بخشی از ممیزی است.
 *   • analytics.export    — خروجیِ گزارشِ مالی. توجه: این کلید هیچ روتی ندارد
 *     (فاز ۵ ثبتش کرده)، پس عملاً هرگز از این گیت عبور نمی‌کند؛ اینجا هست تا
 *     اگر روزی روتِ خروجی ساخته شد، خودبه‌خود ممیزی شود.
 */
export const AUDITED_READ_KEYS = new Set(["admins.viewActivity", "analytics.export"]);
