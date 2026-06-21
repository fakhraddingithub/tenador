import mongoose from "mongoose";

/**
 * InstagramMessage — یک پیامِ منفرد درون یک گفتگوی دایرکت اینستاگرام.
 *
 * sender:
 *   - "user"  → پیامِ ورودی از کاربرِ اینستاگرام (از وبهوک)
 *   - "admin" → پاسخِ ادمین از داخل پنل (ارسال‌شده با Send API)
 *
 * mid (Message ID) یکتای متا است؛ روی آن unique index داریم تا وبهوک‌های
 * تکراری (متا گاهی دوباره می‌فرستد) پیام تکراری نسازند. برای پیام‌های
 * ارسالیِ ادمین، mid از پاسخِ Send API پر می‌شود.
 */

const InstagramMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstagramConversation",
      required: true,
      index: true,
    },

    // IGSID کاربرِ ترِد (برای کوئریِ ساده بدون populate)
    igsid: { type: String, required: true, index: true, trim: true },

    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },

    text: { type: String, default: "" },

    // در صورتِ وجود پیوست تصویر (ورودی یا خروجی)، URL عمومیِ آن
    imageUrl: { type: String, default: "" },

    // شناسه‌ی یکتای پیام نزد متا (mid) — جلوگیری از ذخیره‌ی تکراری
    mid: {
      type: String,
      default: null,
      index: true,
    },

    // برای پیام‌های ادمین: وضعیتِ تحویل به اینستاگرام
    status: {
      type: String,
      enum: ["sent", "failed", "received"],
      default: "received",
    },

    // در صورت شکستِ ارسال، پیامِ خطا برای نمایش به ادمین
    error: { type: String, default: "" },

    // آیا ادمین این پیام را خوانده است (برای پیام‌های ورودیِ کاربر)
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// واکشیِ پیام‌های یک ترِد به‌ترتیبِ زمانی
InstagramMessageSchema.index({ conversation: 1, createdAt: 1 });
// dedupe وبهوک: mid یکتا وقتی null نباشد
InstagramMessageSchema.index(
  { mid: 1 },
  { unique: true, partialFilterExpression: { mid: { $type: "string" } } }
);

export default mongoose.models.InstagramMessage ||
  mongoose.model("InstagramMessage", InstagramMessageSchema);
