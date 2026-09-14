import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import WalletNotification from './WalletNotification.js';
import UserNotification from './UserNotification.js';

export default function walletNotificationPlugin(schema, { source }) {
  schema.pre('save', function () { this.$locals.walletNotificationNew = this.isNew; });
  schema.post('save', async function (doc) {
    const session = doc.$session();
    // Only actual atomic wallet operations, not legacy ledger imports/updates.
    if (!doc.$locals.walletNotificationNew || !session?.inTransaction() || !(doc.amount > 0)) return;
    const user = source === 'coach' ? doc.coach : doc.user;
    const type = source === 'wallet' ? doc.type : 'credit';
    const description = source === 'review' ? 'پاداش نظر تأییدشده'
      : source === 'coach' ? 'واریز از کردیت خرید شاگرد' : doc.description;
    const title = type === 'credit' ? 'واریز به کیف پول' : 'برداشت از کیف پول';
    const message = `${new Intl.NumberFormat('fa-IR').format(doc.amount)} تومان ${type === 'credit' ? 'به کیف پول شما اضافه شد' : 'از کیف پول شما کسر شد'}. ${description}${doc.trackingCode ? ` — سفارش ${doc.trackingCode}` : ''}`;
    const id = `${source}:${doc._id}`;
    const notificationId = new mongoose.Types.ObjectId(createHash('sha256').update(id).digest('hex').slice(0, 24));
    // Both inbox and delivery receipt commit or roll back with the money.
    await UserNotification.create([{ _id: notificationId, title, message: message.slice(0, 2000),
      targetType: 'single', targetUserIds: [user], recipientCount: 1, createdBy: null }], { session });
    await WalletNotification.create([{ _id: id, user, type, amount: doc.amount, description,
      trackingCode: doc.trackingCode, title, message }], { session });
    // Next keeps the callback alive after the response. On transaction rollback
    // the receipt does not exist; concurrent callbacks claim the same receipt.
    // Non-HTTP callers and process crashes are covered by the durable worker.
    try {
      const { after } = await import('next/server.js');
      after(async () => {
        try {
          const { deliverWalletNotification } = await import('../services/walletNotificationDelivery.js');
          await deliverWalletNotification(id);
        } catch (error) { console.warn('[wallet notification delivery]', error.message); }
      });
    } catch { /* No request context: the worker delivers the persisted receipt. */ }
  });
}
