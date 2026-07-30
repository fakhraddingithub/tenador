/**
 * src/lib/reviewCreditGranting.js
 *
 * اعطای اعتبار کیف پول بابت نظرِ تأییدشده — فقط از PATCH
 * /api/admin/comments/[id] فراخوانی می‌شود، دقیقاً همان لحظه‌ای که وضعیت
 * واقعاً به approved گذار می‌کند (نه هر بار که یک نظرِ ازقبل‌approved دوباره
 * ذخیره شود).
 *
 * محافظت در برابر دوبار-اعتبار: ایندکس یکتای {order, item} روی
 * ReviewCreditTransaction (نه چک وضعیت کامنت) — درج لجر و افزایش کیف‌پول در
 * یک تراکنش مشترک انجام می‌شود (در صورت پشتیبانی دیپلوی از تراکنش؛ همان الگوی
 * runWithOptionalTransaction که در article.service.js هم استفاده شده). اگر درج
 * به‌خاطر تکراری‌بودن (order,item) شکست بخورد، تراکنش خودکار abort می‌شود و
 * پیام «قبلاً اعطا شده» را بدون افزایش کیف‌پول برمی‌گردانیم.
 */

import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import User from "base/models/User";
import ReviewCreditTransaction from "base/models/ReviewCreditTransaction";
import { getReviewCreditConfig } from "@/lib/reviewCreditConfig";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";
import { sendWalletCreditEmail } from "@/lib/emailService";
import { createUserNotification } from "base/services/userNotificationService";
import { sendPushToUser } from "@/lib/push";

function resolveItem(comment) {
  if (comment.product) return { item: comment.product, itemType: "product" };
  if (comment.usedProduct) return { item: comment.usedProduct, itemType: "usedProduct" };
  return { item: null, itemType: null };
}

function findOrderLine(order, item) {
  return (order.items || []).find(
    (it) =>
      (it.product && String(it.product) === String(item)) ||
      (it.usedProduct && String(it.usedProduct) === String(item))
  );
}

/**
 * @param {Object} comment  سند Comment پس از ذخیره‌ی status="approved"
 * @returns {Promise<number|null>} مبلغ اعطاشده یا null (غیرفعال/نامعتبر/قبلاً اعطاشده)
 */
export async function grantReviewCreditIfEligible(comment) {
  try {
    await connectToDB();

    const config = await getReviewCreditConfig();
    if (!config.enabled) return null;
    if (!comment.order) return null;

    const [order, user] = await Promise.all([
      Order.findById(comment.order)
        .select("user totalPrice trackingCode items.product items.usedProduct items.unitPrice items.quantity")
        .lean(),
      User.findById(comment.user).select("role email").lean(),
    ]);
    if (!order || !user) return null;
    if (!config.eligibleRoles.includes(user.role)) return null;

    let item = null;
    let itemType = null;
    let base = 0;

    if (config.granularity === "per-item") {
      ({ item, itemType } = resolveItem(comment));
      if (!item) return null;
      const line = findOrderLine(order, item);
      if (!line) return null;
      base = (line.unitPrice || 0) * (line.quantity || 1);
    } else {
      base = order.totalPrice || 0;
    }

    const amount =
      config.kind === "percent"
        ? Math.round((base * (Number(config.value) || 0)) / 100)
        : Math.round(Number(config.value) || 0);
    if (!(amount > 0)) return null;

    try {
      await runWithOptionalTransaction(async (session) => {
        await ReviewCreditTransaction.create(
          [
            {
              order: order._id,
              user: user._id,
              comment: comment._id,
              itemType,
              item,
              granularity: config.granularity,
              kind: config.kind,
              value: config.value,
              amount,
            },
          ],
          { session: session || undefined }
        );

        await User.updateOne(
          { _id: user._id },
          { $inc: { walletBalance: amount } },
          { session: session || undefined }
        );
      });
    } catch (err) {
      if (err?.code === 11000) return null; // قبلاً اعطا شده
      throw err;
    }

    const amountLabel = new Intl.NumberFormat("fa-IR").format(amount);
    await Promise.all([
      user.email
        ? sendWalletCreditEmail({ trackingCode: order.trackingCode, amount }, user.email)
        : Promise.resolve(),
      createUserNotification({
        title: "کیف پول شما شارژ شد",
        message: `بابت نظر تأییدشده روی سفارش ${order.trackingCode}، مبلغ ${amountLabel} تومان به کیف پول شما اضافه شد.`,
        targetType: "single",
        targetUserIds: [user._id],
        createdBy: null,
      }),
      // کانالِ اختیاریِ اضافه — اگر کاربر اشتراکِ push نداشته باشد بی‌اثر است
      sendPushToUser(user._id, {
        title: "کیف پول شما شارژ شد",
        body: `${amountLabel} تومان بابت نظر روی سفارش ${order.trackingCode} اضافه شد.`,
        url: "/p-user",
      }),
    ]);

    return amount;
  } catch (err) {
    console.warn("[reviewCreditGranting]", err?.message);
    return null;
  }
}
