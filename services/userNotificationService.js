/**
 * services/userNotificationService.js
 *
 * منطق سیستم «اعلان‌های ادمین → کاربران».
 * کاملاً جدا از services/notificationService.js (اعلان‌های داخلی پنل) است.
 */

import mongoose from "mongoose";
import UserNotification, {
  USER_NOTIFICATION_TARGETS,
  TARGETABLE_ROLES,
} from "base/models/UserNotification";
import UserNotificationState from "base/models/UserNotificationState";
import User from "base/models/User";

/* ───────────────────────── هدف‌گذاری ───────────────────────── */

/**
 * فیلتر «اعلان‌های مرتبط با این کاربر».
 * @param {{ _id?: any, id?: any, role?: string }} user
 */
export function targetFilterForUser(user) {
  const userId = user?._id || user?.id;
  const role = user?.role || "user";
  return {
    $or: [
      { targetType: "all" },
      { targetType: "role", targetRole: role },
      { targetType: { $in: ["group", "single"] }, targetUserIds: userId },
    ],
  };
}

/* ───────────────────────── ساخت/ارسال ───────────────────────── */

/**
 * اعتبارسنجی و نرمال‌سازی داده‌ی هدف‌گذاری.
 * در صورت خطا یک Error با پیام فارسی پرتاب می‌کند.
 */
function validateTargeting({ targetType, targetRole, targetUserIds }) {
  if (!USER_NOTIFICATION_TARGETS.includes(targetType)) {
    throw new Error("نوع هدف‌گذاری نامعتبر است");
  }

  let role = null;
  let ids = [];

  if (targetType === "role") {
    if (!TARGETABLE_ROLES.includes(targetRole)) {
      throw new Error("نقش انتخاب‌شده نامعتبر است");
    }
    role = targetRole;
  }

  if (targetType === "group" || targetType === "single") {
    const raw = Array.isArray(targetUserIds) ? targetUserIds : [];
    // فقط آیدی‌های معتبر و یکتا
    const seen = new Set();
    for (const v of raw) {
      const s = String(v);
      if (mongoose.Types.ObjectId.isValid(s) && !seen.has(s)) {
        seen.add(s);
        ids.push(s);
      }
    }
    if (ids.length === 0) {
      throw new Error("حداقل یک کاربر باید انتخاب شود");
    }
    if (targetType === "single" && ids.length !== 1) {
      throw new Error("برای ارسال تکی فقط یک کاربر مجاز است");
    }
  }

  return { role, ids };
}

/** شمارشِ گیرنده‌ها برای یک هدف‌گذاری (snapshot هنگام ارسال). */
async function countRecipients(targetType, role, ids) {
  if (targetType === "all") return User.countDocuments({});
  if (targetType === "role") return User.countDocuments({ role });
  // group / single → کاربرانِ موجود از میان آیدی‌های انتخاب‌شده
  return User.countDocuments({ _id: { $in: ids } });
}

/**
 * پیش‌نمایشِ تعداد گیرنده (برای تأییدیه‌ی ارسال در پنل ادمین).
 * اعتبارسنجی سبک — در صورت نامعتبر بودن صفر برمی‌گرداند به‌جای پرتاب خطا.
 */
export async function previewRecipientCount({ targetType, targetRole }) {
  if (targetType === "all") return User.countDocuments({});
  if (targetType === "role") {
    if (!TARGETABLE_ROLES.includes(targetRole)) return 0;
    return User.countDocuments({ role: targetRole });
  }
  // group/single تعدادشان سمت کلاینت از روی انتخاب مشخص است
  return 0;
}

/**
 * ساخت و ارسال یک اعلان به کاربران.
 * @returns سند ساخته‌شده (lean)
 */
export async function createUserNotification({
  title,
  message,
  targetType,
  targetRole,
  targetUserIds,
  createdBy,
}) {
  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();
  if (!cleanTitle) throw new Error("عنوان اعلان الزامی است");
  if (!cleanMessage) throw new Error("متن اعلان الزامی است");

  const { role, ids } = validateTargeting({ targetType, targetRole, targetUserIds });
  const recipientCount = await countRecipients(targetType, role, ids);

  if (recipientCount === 0) {
    throw new Error("هیچ کاربری با این هدف‌گذاری یافت نشد");
  }

  const doc = await UserNotification.create({
    title: cleanTitle,
    message: cleanMessage,
    targetType,
    targetRole: role,
    targetUserIds: ids,
    recipientCount,
    createdBy: createdBy || null,
  });

  return doc.toObject();
}

/* ───────────────────────── واکشی (سمت کاربر) ───────────────────────── */

/** زمانِ watermark خواندنِ کاربر (در صورت نبود، null). */
async function getLastReadAt(userId) {
  const state = await UserNotificationState.findOne({ user: userId })
    .select("lastReadAt")
    .lean();
  return state?.lastReadAt || null;
}

/** فقط شمارشِ نخوانده‌ها — برای بَجِ زنگوله. */
export async function getUnreadCount(user) {
  const userId = user?._id || user?.id;
  if (!userId) return 0;
  const filter = targetFilterForUser(user);
  const lastReadAt = await getLastReadAt(userId);
  if (lastReadAt) filter.createdAt = { $gt: lastReadAt };
  return UserNotification.countDocuments(filter);
}

/**
 * لیست اعلان‌های کاربر (جدیدترین اول) + شمارشِ نخوانده.
 * هر آیتم یک فلگ isRead (بر اساس watermark) برای استایل‌دهی دریافت می‌کند.
 */
export async function getUserNotifications(user, { limit = 30 } = {}) {
  const userId = user?._id || user?.id;
  if (!userId) return { items: [], unreadCount: 0 };

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const filter = targetFilterForUser(user);

  const [items, lastReadAt] = await Promise.all([
    UserNotification.find(filter)
      .select("title message targetType createdAt")
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean(),
    getLastReadAt(userId),
  ]);

  const watermark = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  let unreadCount = 0;
  for (const it of items) {
    const isRead = watermark > 0 && new Date(it.createdAt).getTime() <= watermark;
    it.isRead = isRead;
    if (!isRead) unreadCount += 1;
  }

  // اگر صفحه پر بود ممکن است نخوانده‌های قدیمی‌تر از سقفِ لیست هم باشند — شمارش دقیق:
  if (items.length === safeLimit) {
    unreadCount = await getUnreadCount(user);
  }

  return { items, unreadCount };
}

/**
 * «همه را خوانده‌شده علامت بزن» — watermark کاربر را به اکنون می‌برد.
 * @returns { unreadCount: 0 }
 */
export async function markAllRead(user) {
  const userId = user?._id || user?.id;
  if (!userId) return { unreadCount: 0 };

  await UserNotificationState.updateOne(
    { user: userId },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );

  return { unreadCount: 0 };
}

/* ───────────────────────── تاریخچه (سمت ادمین) ───────────────────────── */

/** فهرست اعلان‌های ارسال‌شده برای پنل ادمین (جدیدترین اول). */
export async function getSentNotifications({ limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const items = await UserNotification.find({})
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
  return items;
}
