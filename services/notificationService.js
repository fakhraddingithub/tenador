/**
 * services/notificationService.js
 *
 * توابع کمکی برای ساخت و واکشی اعلان‌های پنل مدیریت.
 *
 * ── ساخت اعلان (triggerها) ──
 * توابع notify* هرگز استثنا پرتاب نمی‌کنند؛ هر خطایی فقط لاگ می‌شود تا جریان
 * اصلی (ثبت سفارش / تأیید پرداخت / درخواست مربیگری) هیچ‌وقت به‌خاطر اعلان نشکند.
 * نوشتن یک insert تکی زیر-میلی‌ثانیه است، بنابراین await می‌شود تا روی
 * سرورلِس (Vercel) قبل از فریز شدن تابع، واقعاً ذخیره شود.
 */

import Notification, { NOTIFICATION_TYPES } from "base/models/Notification";
import { getUserFullName } from "base/utils/userName";

/** نگاشت نوع → بخش سایدبار (برای بَج‌ها) */
export const SECTION_BY_TYPE = {
  new_order: "orders",
  new_payment: "orders",
  coach_student_order: "coachCredits",
  coach_application: "coachApplications",
};

/* ─────────────────────────  ساخت اعلان  ───────────────────────── */

/** ساخت امن — خطا را می‌بلعد و جریان میزبان را متوقف نمی‌کند */
async function safeCreate(doc) {
  try {
    await Notification.create(doc);
  } catch (err) {
    console.warn("[notificationService] خطا در ساخت اعلان:", err?.message);
  }
}

/** سفارش جدید ثبت شد */
export async function notifyNewOrder(order) {
  if (!order?._id) return;
  await safeCreate({
    type: "new_order",
    message: `سفارش جدید به مبلغ ${Number(order.totalPrice || 0).toLocaleString("fa-IR")} تومان ثبت شد`,
    order: order._id,
    actor: order.user || null,
    link: `/p-admin/admin-orders/${order._id}`,
  });
}

/** پرداخت یک سفارش تأیید شد */
export async function notifyNewPayment(order) {
  if (!order?._id) return;
  await safeCreate({
    type: "new_payment",
    message: `پرداخت سفارش ${order.trackingCode ? `#${order.trackingCode}` : ""} تأیید شد`.trim(),
    order: order._id,
    actor: order.user?._id || order.user || null,
    link: `/p-admin/admin-orders/${order._id}`,
  });
}

/**
 * شاگردِ یک مربی سفارش ثبت کرده — ادمین باید برای مربی کردیت ثبت کند.
 * @param order  سند سفارش (حداقل _id)
 * @param coach  سند مربی ({ _id, name })
 */
export async function notifyCoachStudentOrder(order, coach) {
  if (!order?._id || !coach?._id) return;
  const coachName = getUserFullName(coach, "\u0645\u0631\u0628\u06cc");
  await safeCreate({
    type: "coach_student_order",
    message: `شاگرد ${coachName} سفارش ثبت کرده، برای او کردیت ثبت کنید`,
    order: order._id,
    coach: coach._id,
    actor: order.user || null,
    // صفحه‌ی ثبت کردیت مربی برای همین سفارش
    link: `/p-admin/users/coaches/${coach._id}/credit/${order._id}`,
  });
}

/** درخواست مربیگری جدید */
export async function notifyCoachApplication(applicant) {
  if (!applicant?._id) return;
  const name = applicant.coachApplication?.fullName || getUserFullName(applicant, "\u06cc\u06a9 \u06a9\u0627\u0631\u0628\u0631");
  await safeCreate({
    type: "coach_application",
    message: `${name} درخواست مربیگری ثبت کرده است`,
    actor: applicant._id,
    link: `/p-admin/users/coaches?tab=applications`,
  });
}

/* ─────────────────────────  واکشی اعلان  ───────────────────────── */

/**
 * شمارش خوانده‌نشده‌ها بر اساس نوع و بخش — برای بَج‌های سایدبار و زنگوله.
 * هرگز مقدار منفی برنمی‌گرداند (شمارش مستقیم از دیتابیس).
 */
export async function getNotificationCounts() {
  const rows = await Notification.aggregate([
    { $match: { isRead: false } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);

  const byType = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, 0]));
  for (const r of rows) {
    if (r._id in byType) byType[r._id] = r.count;
  }

  const sections = { orders: 0, coachCredits: 0, coachApplications: 0 };
  for (const type of NOTIFICATION_TYPES) {
    const section = SECTION_BY_TYPE[type];
    if (section) sections[section] += byType[type];
  }

  const total = Object.values(byType).reduce((s, n) => s + n, 0);

  return { total, byType, sections };
}

/** جدیدترین اعلان‌ها (پیش‌فرض ۲۰ مورد) به‌همراه شمارش‌ها */
export async function getRecentNotifications(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const [items, counts] = await Promise.all([
    Notification.find({})
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean(),
    getNotificationCounts(),
  ]);

  return { items, counts };
}
