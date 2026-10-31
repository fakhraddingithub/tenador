import 'base/models/registerModels';
import AssistantQuota from 'base/models/AssistantQuota';
import { AssistantError } from './validation.js';

// `scope` separates budgets that share this collection (e.g. "product:" for
// AI product generation), so one feature cannot exhaust the other's quota.
export async function consumeAssistantQuota(userId, now = Date.now(), {
  scope = '',
  message = 'سقف استفاده از دستیار رسیده است (۱۰ سؤال در دقیقه و ۱۰۰ سؤال در روز). کمی بعد دوباره تلاش کنید.',
} = {}) {
  for (const [duration, limit] of [[60000, 10], [86400000, 100]]) {
    const bucket = Math.floor(now / duration);
    const filter = { _id: `${scope}${userId}:${duration}:${bucket}`, count: { $lt: limit } };
    try {
      await AssistantQuota.findOneAndUpdate(
        filter,
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * duration) } },
        { upsert: true, returnDocument: 'after', maxTimeMS: 5000 },
      );
    } catch (error) {
      if (error.code === 11000) {
        // Concurrent first inserts can collide before the bucket is actually full.
        const retry = await AssistantQuota.findOneAndUpdate(filter, { $inc: { count: 1 } }, { returnDocument: 'after', maxTimeMS: 5000 });
        if (retry) continue;
        throw new AssistantError(message, 429);
      }
      throw error;
    }
  }
}
