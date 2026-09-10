/**
 * services/orderDeletion.js
 *
 * حذفِ دائمیِ یک سفارش و هر چیزی که بدونِ آن سفارش بی‌معنا یا خراب می‌شود.
 *
 * چرا یک سرویسِ جدا و نه چند خط داخلِ روت: «سفارش را پاک کن» در این دیتابیس
 * فقط یک `deleteOne` نیست. نه ارجاعِ ObjectId اینجا cascade دارد و نه مونگو
 * کلیدِ خارجی. پس هر ارجاع باید صریح تعیین‌تکلیف شود، وگرنه دقیقاً همان
 * چیزی می‌ماند که صورت‌مسئله ممنوعش کرده: رکوردِ یتیم.
 *
 * تصمیمِ هر ارجاع، بر اساسِ *اجباری‌بودنِ* آن در اسکیمای مقصد:
 *
 *   حذف می‌شود (ارجاعِ required — سند بدونِ سفارش نامعتبر است)
 *     • Payment.order                     ← خواسته‌ی صریحِ صورت‌مسئله
 *     • Installment.order + Installment.downPayment (هر دو required)
 *     • ReviewCreditTransaction.order
 *
 *   آزاد می‌شود (وگرنه برای همیشه قفلِ یک سفارشِ ناموجود می‌ماند)
 *     • UsedProduct.order  → order=null, status="available"
 *       (همان کاری که PATCH /api/admin/used-products/[id] موقعِ آزادسازی می‌کند)
 *     • بارکدهای انبار (tenadorOrderId) → وگرنه اسکنِ دوباره‌شان تا ابد ۴۰۹
 *       می‌گیرد: «قبلاً به سفارش X اختصاص یافته»، و X دیگر وجود ندارد.
 *
 *   فقط پیوندش باز می‌شود (سندِ مقصد خودش رکوردِ مستقلی است و باید بماند)
 *     • Comment.order            — نظر می‌ماند، فقط نشانِ «خرید تأییدشده» می‌رود
 *     • Ticket.relatedOrder/relatedPayment — تیکت و گفتگویش دست‌نخورده
 *     • CoachWalletTransaction.order — دفترِ پول است؛ حذفش موجودیِ مربی را
 *       بی‌صدا عوض می‌کند. ردیف می‌ماند، فقط لینکِ مرده‌اش برداشته می‌شود.
 *
 *   Notification.order/payment حذف می‌شود: اعلانِ زنگوله چیزی جز یک لینک نیست
 *   و لینکش به ۴۰۴ می‌خورد.
 *
 * ⚠️ ترتیبِ انبار عمدی است. دیتابیسِ انبار اتصالِ دیگری است، پس *نمی‌تواند*
 * داخلِ همان تراکنش باشد. بارکدها **پیش از** commit آزاد می‌شوند: اگر تراکنش
 * بعدش شکست بخورد، بارکد از یک سفارشِ *زنده* جدا شده که ادمین دوباره اسکنش
 * می‌کند — قابلِ جبران. حالتِ برعکس (اول commit، بعد انبار) در همان شکست
 * بارکد را روی سفارشی که دیگر وجود ندارد قفل می‌کند و هیچ رابطی آزادش
 * نمی‌کند.
 */

import mongoose from "mongoose";

import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Installment from "base/models/Installment";
import Notification from "base/models/Notification";
import Comment from "base/models/Comment";
import Ticket from "base/models/Ticket";
import UsedProduct from "base/models/UsedProduct";
import CoachWalletTransaction from "base/models/CoachWalletTransaction";
import ReviewCreditTransaction from "base/models/ReviewCreditTransaction";
import {
  connectWarehouseDB,
  getItemTrackingModel,
  getUsedItemTrackingModel,
} from "@/lib/warehouseDb";

/**
 * بارکدهای انبار را از سفارش جدا می‌کند (حذف نمی‌کند — خودِ کالا سرِ جایش است).
 * دقیقاً همان فیلدهایی صفر می‌شوند که DELETE روتِ tracking صفر می‌کند.
 */
export async function releaseWarehouseTracking(orderId) {
  const conn = await connectWarehouseDB();
  const id = String(orderId);

  const item = await getItemTrackingModel(conn).updateMany(
    { tenadorOrderId: id },
    {
      $set: {
        tenadorOrderId: null,
        relatedOrder: null,
        orderItemIndex: null,
        flowNodeId: null,
        procurementStatus: null,
      },
    }
  );

  // UsedItemTracking این فیلدهای اضافه را ندارد.
  const used = await getUsedItemTrackingModel(conn).updateMany(
    { tenadorOrderId: id },
    { $set: { tenadorOrderId: null } }
  );

  return {
    itemTracking: item.modifiedCount || 0,
    usedItemTracking: used.modifiedCount || 0,
  };
}

/**
 * پاک‌سازیِ همه‌ی ارجاع‌ها + حذفِ خودِ سفارش. همه داخلِ یک تراکنش.
 *
 * @param {string} orderId
 * @param {import("mongoose").ClientSession} session تراکنشِ باز
 * @param {(orderId: string) => Promise<object>} [releaseTracking] فقط برای تست
 * @returns {Promise<object|null>} خلاصه‌ی حذف، یا null اگر سفارش وجود نداشت
 */
export async function deleteOrderCascade(
  orderId,
  session,
  releaseTracking = releaseWarehouseTracking
) {
  const order = await Order.findById(orderId).session(session).lean();
  if (!order) return null;

  const _id = order._id;

  // پرداخت‌ها از *دو* طرف پیدا می‌شوند: هم Payment.order و هم order.payments.
  // این دو در داده‌ی واقعی می‌توانند واگرا باشند (روت‌های قدیمی فقط یکی را
  // نوشته‌اند)، و «رکوردِ پرداختِ یتیم نماند» یعنی اجتماعِ هر دو.
  const paymentIds = (
    await Payment.find({
      $or: [{ order: _id }, { _id: { $in: order.payments || [] } }],
    })
      .select("_id")
      .session(session)
      .lean()
  ).map((p) => p._id);

  // ── انبار: پیش از commit (بالا توضیح داده شد) ────────────────────────
  const tracking = await releaseTracking(_id);

  // ── حذف‌ها ───────────────────────────────────────────────────────────
  const payments = await Payment.deleteMany({ _id: { $in: paymentIds } }, { session });
  const installments = await Installment.deleteMany({ order: _id }, { session });
  const reviewCredits = await ReviewCreditTransaction.deleteMany({ order: _id }, { session });
  const notifications = await Notification.deleteMany(
    { $or: [{ order: _id }, { payment: { $in: paymentIds } }] },
    { session }
  );

  // ── آزادسازی ─────────────────────────────────────────────────────────
  const usedProducts = await UsedProduct.updateMany(
    { order: _id },
    { $set: { order: null, status: "available" } },
    { session }
  );

  // ── بازکردنِ پیوند ────────────────────────────────────────────────────
  const comments = await Comment.updateMany(
    { order: _id },
    { $set: { order: null } },
    { session }
  );
  await Ticket.updateMany({ relatedOrder: _id }, { $set: { relatedOrder: null } }, { session });
  await Ticket.updateMany(
    { relatedPayment: { $in: paymentIds } },
    { $set: { relatedPayment: null } },
    { session }
  );
  const coachWallet = await CoachWalletTransaction.updateMany(
    { order: _id },
    { $set: { order: null } },
    { session }
  );

  await Order.deleteOne({ _id }, { session });

  return {
    trackingCode: order.trackingCode || null,
    payments: payments.deletedCount || 0,
    installments: installments.deletedCount || 0,
    reviewCredits: reviewCredits.deletedCount || 0,
    notifications: notifications.deletedCount || 0,
    usedProductsReleased: usedProducts.modifiedCount || 0,
    commentsDetached: comments.modifiedCount || 0,
    coachWalletDetached: coachWallet.modifiedCount || 0,
    tracking,
  };
}

/** پوسته‌ی تراکنش‌دار — چیزی که روت صدا می‌زند. */
export async function deleteOrderPermanently(orderId, releaseTracking) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const summary = await deleteOrderCascade(orderId, session, releaseTracking);
    if (!summary) {
      await session.abortTransaction();
      return null;
    }
    await session.commitTransaction();
    return summary;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
