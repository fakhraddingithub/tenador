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
  new_ticket: "support",
};

const SECTIONS = ["orders", "coachCredits", "coachApplications", "support"];

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

/** تیکت پشتیبانی جدید یا پاسخ کاربر روی تیکت — نیاز به رسیدگی ادمین */
export async function notifyNewTicket(ticket, { reply = false } = {}) {
  if (!ticket?._id) return;
  const subject = String(ticket.subject || "").slice(0, 80);
  await safeCreate({
    type: "new_ticket",
    message: reply
      ? `پاسخ جدید روی تیکت «${subject}»`
      : `تیکت پشتیبانی جدید: «${subject}»`,
    ticket: ticket._id,
    actor: ticket.user?._id || ticket.user || null,
    link: `/p-admin/support/tickets/${ticket._id}`,
  });
}

/* ─────────────────────────  علامت‌گذاری خوانده‌شده  ───────────────────────── */

/**
 * ساختِ کوئریِ mongo برای علامت‌گذاری خوانده‌شده — تابعِ خالص و تست‌پذیر.
 * برمی‌گرداند { query, allowed }. اگر filter هیچ scope و نه all داشته باشد،
 * allowed=false تا از پاک‌کردنِ ناخواسته‌ی همه‌ی اعلان‌ها جلوگیری شود.
 */
export function buildReadQuery(filter = {}) {
  const query = { isRead: false };

  if (filter.order) query.order = filter.order;
  if (filter.coach) query.coach = filter.coach;
  if (filter.ticket) query.ticket = filter.ticket;
  if (filter.type) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    query.type = { $in: types.filter((t) => NOTIFICATION_TYPES.includes(t)) };
  }
  if (Array.isArray(filter.ids) && filter.ids.length) query._id = { $in: filter.ids };

  const hasScope = Object.keys(query).length > 1;
  // اجازه فقط با scope مشخص یا all صریح؛ در غیر این‌صورت هیچ چیزی آپدیت نمی‌شود
  return { query, allowed: hasScope || filter.all === true };
}

/**
 * علامت‌گذاری متمرکز اعلان‌ها به‌عنوان خوانده‌شده.
 * فیلتر بر اساس یکی از: entity ref (order/coach/ticket)، type، ids، یا all.
 * فقط اعلان‌های خوانده‌نشده آپدیت می‌شوند و شمارشِ به‌روز برمی‌گردد.
 */
export async function markNotificationsRead(filter = {}) {
  const { query, allowed } = buildReadQuery(filter);
  if (!allowed) return getNotificationCounts();

  await Notification.updateMany(query, {
    $set: { isRead: true, readAt: new Date() },
  });

  return getNotificationCounts();
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

  const sections = Object.fromEntries(SECTIONS.map((s) => [s, 0]));
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
