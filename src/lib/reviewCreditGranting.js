/** Compatibility entry point: all wallet messages use the committed outbox. */
import { deliverWalletNotification } from 'base/services/walletNotificationDelivery';

export async function notifyReviewCreditGranted(credit) {
  if (credit?.status !== 'granted' || !credit.notificationId) return;
  try { await deliverWalletNotification(credit.notificationId); }
  catch (error) { console.warn('[review-credit notification]', error.message); }
}
