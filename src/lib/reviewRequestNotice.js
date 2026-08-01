/**
 * src/lib/reviewRequestNotice.js
 *
 * ایمیل + اعلانِ «سفارش تحویل داده شد، نظر بدهید» — فقط از
 * orderFulfillmentSync.js فراخوانی می‌شود، دقیقاً همان لحظه‌ای که CAS آنجا
 * گذارِ واقعی به DELIVERED را تشخیص می‌دهد (نه تغییر دستی ادمین).
 *
 * تمام خطاها همینجا بلعیده می‌شوند تا هرگز مسیر فراخوان (sync/read-repair)
 * را نشکند؛ به همین دلیل بدون await در fire-and-forget فراخوانی می‌شود.
 */

import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import User from "base/models/User";
import { sendReviewRequestEmail, sendDeliveryFollowUpEmail } from "@/lib/emailService";
import { createUserNotification } from "base/services/userNotificationService";
import { sendPushToUser } from "@/lib/push";

export async function notifyOrderDelivered(orderId) {
  try {
    await connectToDB();
    const order = await Order.findById(orderId).select("trackingCode user").lean();
    if (!order) return;

    const user = await User.findById(order.user).select("email").lean();
    if (!user) return;

    await Promise.all([
      user.email ? sendReviewRequestEmail(order, user.email) : Promise.resolve(),
      createUserNotification({
        title: "سفارش شما تحویل داده شد",
        message: `سفارش با کد ${order.trackingCode} تحویل داده شد. با ثبت نظر برای محصولات این سفارش، اعتبار کیف پول هدیه بگیرید.`,
        targetType: "single",
        targetUserIds: [order.user],
        createdBy: null,
      }),
      // کانالِ اختیاریِ اضافه — اگر کاربر اشتراکِ push نداشته باشد بی‌اثر است
      sendPushToUser(order.user, {
        title: "سفارش شما تحویل داده شد",
        body: `کد سفارش ${order.trackingCode} — با ثبت نظر اعتبار کیف پول بگیرید.`,
        url: "/p-user/orders",
      }),
    ]);
  } catch (err) {
    console.warn("[reviewRequestNotice]", err?.message);
  }
}

/**
 * پیگیریِ «آیا سفارش به‌دستتان رسید؟» — فقط از workers/reviewFollowUpWorker.js
 * فراخوانی می‌شود، پس از claim اتمیکِ سفارش (reviewFollowUpSentAt).
 */
export async function notifyDeliveryFollowUp(orderId) {
  try {
    await connectToDB();
    const order = await Order.findById(orderId).select("trackingCode user").lean();
    if (!order) return;

    const user = await User.findById(order.user).select("email").lean();
    if (!user) return;

    await Promise.all([
      user.email ? sendDeliveryFollowUpEmail(order, user.email) : Promise.resolve(),
      createUserNotification({
        title: "سفارش شما به‌دستتان رسید؟",
        message: `چند روزی از تحویل سفارش ${order.trackingCode} می‌گذرد — لطفاً از دریافت آن اطمینان حاصل کنید و در صورت وجود مشکل به ما اطلاع دهید.`,
        targetType: "single",
        targetUserIds: [order.user],
        createdBy: null,
      }),
      sendPushToUser(order.user, {
        title: "سفارش شما به‌دستتان رسید؟",
        body: `سفارش ${order.trackingCode} — لطفاً دریافت آن را تأیید کنید.`,
        url: "/p-user/orders",
      }),
    ]);
  } catch (err) {
    console.warn("[reviewRequestNotice]", err?.message);
  }
}
