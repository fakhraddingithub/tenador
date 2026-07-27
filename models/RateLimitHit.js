import mongoose from "mongoose";

/**
 * شمارنده‌ی عمومی نرخ‌محدودسازی — یک سند به‌ازای هر درخواست با یک کلید دلخواه
 * (مثلاً `fpw-email:ip:1.2.3.4`). تعداد اسناد یک کلید در بازه‌ی زمانی مشخص
 * شمارش می‌شود؛ اسناد پس از ۱ ساعت خودکار حذف می‌شوند.
 */
const RateLimitHitSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

RateLimitHitSchema.index({ key: 1, createdAt: -1 });
RateLimitHitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.models.RateLimitHit ||
  mongoose.model("RateLimitHit", RateLimitHitSchema);
