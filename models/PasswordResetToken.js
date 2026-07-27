import mongoose from "mongoose";

/**
 * جلسه‌ی بازیابی رمز عبور از طریق ایمیل — یک سند فعال به‌ازای هر کاربر.
 * درخواست جدید (مرحله ۱) یا ارسال مجدد، سند قبلی را بازنویسی (invalidate) می‌کند.
 */
const PasswordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// پاکسازی خودکار پس‌زمینه؛ منطق برنامه هم expiresAt را مستقل بررسی می‌کند
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PasswordResetToken ||
  mongoose.model("PasswordResetToken", PasswordResetTokenSchema);
