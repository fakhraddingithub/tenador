/**
 * src/lib/adminContext.js
 *
 * حل‌کننده‌ی «زمینه‌ی ادمین» برای سمت سرور — تنها جایی که User + عضویت Admin +
 * نقش زنده + دسترسی مؤثر با هم محاسبه می‌شوند.
 *
 * فقط سمت سرور. در کلاینت import نشود.
 *
 * ⚠️ `next/headers` عمداً *استاتیک* import نمی‌شود: این ماژول از middleware هم
 * فراخوانی می‌شود (فاز ۴) و آنجا `next/headers` وجود ندارد. وقتی توکن صریح
 * پاس داده شود، هیچ‌وقت به کوکی‌های next/headers دست نمی‌زنیم.
 *
 * منطقِ تصمیم عمداً اینجا نیست: در src/lib/adminGuards.js
 * (`decideMembershipAccess`) است تا خالص و قابل تست بماند.
 */

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";
import Admin from "base/models/Admin";
import {
  computeEffectivePermissions,
  hasPermission,
} from "@/lib/permissions";
import { decideMembershipAccess } from "@/lib/adminGuards";

/** فیلدهای کاربر که برای تصمیم‌گیری/نمایش لازم‌اند. */
const USER_FIELDS = "role isBanned name lastName phone email";

/**
 * خواندنِ توکن از کوکی‌های درخواست — فقط در محیطِ App Router.
 * import پویا است چون `next/headers` در middleware قابل بارگذاری نیست.
 */
async function readCookieToken() {
  const { cookies } = await import("next/headers");
  return (await cookies()).get("accessToken")?.value;
}

/**
 * زمینه‌ی ادمینِ نشست جاری.
 *
 * خروجی: null (توکن/کاربر معتبر نیست) یا
 * {
 *   user, userId,
 *   membership,           // سند lean Admin (حتی اگر غیرفعال باشد) یا null
 *   role, isFullAccess,
 *   permissions,          // آرایه کلیدهای مؤثر (اگر مجاز نباشد: خالی)
 *   can(key|keys, opts),
 *   isAdmin,              // نتیجه‌ی نهاییِ تصمیم
 *   source,               // "membership" | "legacy-user-role" | "none"
 *   denyReason,           // "duplicate-membership" | "membership-revoked" | ...
 *   hasLegacyAdminRole,
 * }
 */
export async function resolveAdminContext({ token: explicitToken } = {}) {
  const token = explicitToken ?? (await readCookieToken());
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  await connectToDB();

  const user = await User.findById(decoded.userId).select(USER_FIELDS).lean();
  if (!user) return null;

  // ⚠️ عمداً بدون فیلترِ isActive: باید بین «عضویتِ لغو‌شده» و «بدون عضویت»
  // تفاوت قائل شویم، وگرنه ادمینِ لغو‌شده از مسیر legacy دوباره وارد می‌شود.
  // اسناد بدون `user` هرگز اینجا match نمی‌شوند (fail-closed).
  const memberships = await Admin.find({ user: user._id })
    .populate("role", "name description permissions isSystem isFullAccess systemKey")
    .lean();

  const hasLegacyAdminRole = user.role === "admin";

  // کاربر مسدود، هر مسیری که داشته باشد، ادمین نیست.
  const decision = user.isBanned
    ? {
        allowed: false,
        source: "none",
        membership: memberships[0] || null,
        reason: "user-banned",
      }
    : decideMembershipAccess({ memberships, hasLegacyAdminRole });

  const membership = decision.membership || null;
  const role = membership?.role || null;
  const isFullAccess = !!role?.isFullAccess;

  // فاز ۷: تنها منبعِ دسترسی، عضویتِ فعال است. پیش‌تر یک شاخه‌ی
  // `legacy-user-role` وجود داشت که همه‌ی کلیدها را می‌داد؛ با اجرای مهاجرت
  // حذف شد. `decideMembershipAccess` دیگر هرگز چنین منبعی برنمی‌گرداند، ولی
  // این شرط عمداً بر اساسِ `source === "membership"` نوشته شده تا اگر روزی
  // منبعِ جدیدی اضافه شود، fail-closed بماند (آرایه‌ی خالی) نه fail-open.
  const permissions =
    decision.allowed && decision.source === "membership"
      ? computeEffectivePermissions({
          rolePermissions: role?.permissions || [],
          grants: membership?.permissionGrants || [],
          denials: membership?.permissionDenials || [],
          fullAccess: isFullAccess,
        })
      : [];

  const permissionSet = new Set(permissions);

  return {
    user,
    userId: String(user._id),
    membership,
    role,
    isFullAccess,
    permissions,
    can: (required, opts) => hasPermission(permissionSet, required, opts),
    isAdmin: decision.allowed,
    source: decision.source,
    denyReason: decision.reason,
    hasLegacyAdminRole,
  };
}

/**
 * زمینه‌ی ادمین، فقط اگر نشست واقعاً ادمین باشد؛ در غیر این صورت null.
 */
export async function getAdminContext(options) {
  const ctx = await resolveAdminContext(options);
  return ctx?.isAdmin ? ctx : null;
}
