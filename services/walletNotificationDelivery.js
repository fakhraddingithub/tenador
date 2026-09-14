import 'base/models/registerModels';
import { randomUUID } from 'node:crypto';
import WalletNotification from 'base/models/WalletNotification';
import User from 'base/models/User';
import { sendWalletTransactionEmail } from '@/lib/emailService';
import { sendPushToUser } from '@/lib/push';

export async function deliverWalletNotification(id, now = new Date()) {
  const lockToken = randomUUID();
  const receipt = await WalletNotification.findOneAndUpdate({ _id: id, completedAt: null,
    nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now } }, {
    $set: { lockToken, lockedUntil: new Date(now.getTime() + 5 * 60_000) }, $inc: { attempts: 1 },
  }, { returnDocument: 'after' }).lean();
  if (!receipt) return false;
  const filter = { _id: id, lockToken };
  try {
    const user = await User.findById(receipt.user).select('email').lean();
    // No address: still deliver the site notification and push. No fabricated
    // email recipient or fallback to an admin's address.
    const results = await Promise.allSettled([
      (async () => {
        if (receipt.emailSentAt || receipt.emailSkippedAt) return;
        if (user?.email) await sendWalletTransactionEmail(receipt, user.email);
        await WalletNotification.updateOne(filter, { $set: { [user?.email ? 'emailSentAt' : 'emailSkippedAt']: new Date() } });
      })(),
      (async () => {
        if (receipt.pushSentAt) return;
        await sendPushToUser(receipt.user, { title: receipt.title, body: receipt.message, url: '/p-user/wallet' });
        await WalletNotification.updateOne(filter, { $set: { pushSentAt: new Date() } });
      })(),
    ]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    await WalletNotification.updateOne(filter, { $set: { completedAt: new Date(), lockedUntil: new Date(0), lockToken: null } });
    return true;
  } catch (error) {
    await WalletNotification.updateOne(filter, { $set: { lockedUntil: new Date(0), lockToken: null,
      nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(receipt.attempts, 7))) } });
    console.warn('[wallet notification retry]', id, error.message);
    return false;
  }
}

export async function deliverPendingWalletNotifications(limit = 100) {
  const now = new Date();
  const pending = await WalletNotification.find({ completedAt: null, nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now } })
    .sort({ nextAttemptAt: 1 }).limit(limit).select('_id').lean();
  let processed = 0;
  for (let offset = 0; offset < pending.length && Date.now() - now.getTime() < 30_000; offset += 5) {
    const batch = pending.slice(offset, offset + 5);
    await Promise.allSettled(batch.map(row => deliverWalletNotification(row._id)));
    processed += batch.length;
  }
  return processed;
}
