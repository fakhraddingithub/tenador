/** Notifications run only after the monetary transaction has committed. */
import { sendWalletCreditEmail } from "@/lib/emailService";
import { createUserNotification } from "base/services/userNotificationService";
import { sendPushToUser } from "@/lib/push";

export async function notifyReviewCreditGranted(credit) {
  if (credit?.status !== "granted") return;
  const { amount, userId, email, trackingCode } = credit;
  const amountLabel = new Intl.NumberFormat("fa-IR").format(amount);
  // A failed channel must not report a committed payment as failed or trigger
  // another credit attempt. Promise callbacks also contain synchronous errors.
  const results = await Promise.allSettled([
    Promise.resolve().then(() => email
      ? sendWalletCreditEmail({ trackingCode, amount }, email) : undefined),
    Promise.resolve().then(() => createUserNotification({
      title: "کیف پول شما شارژ شد",
      message: `بابت نظر تأییدشده روی سفارش ${trackingCode}، مبلغ ${amountLabel} تومان به کیف پول شما اضافه شد.`,
      targetType: "single", targetUserIds: [userId], createdBy: null,
    })),
    Promise.resolve().then(() => sendPushToUser(userId, {
      title: "کیف پول شما شارژ شد",
      body: `${amountLabel} تومان بابت نظر روی سفارش ${trackingCode} اضافه شد.`,
      url: "/p-user/wallet",
    })),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.warn("[review-credit notification]", result.reason?.message);
  }
}
