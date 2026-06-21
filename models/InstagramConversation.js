import mongoose from "mongoose";

/**
 * InstagramConversation — یک گفتگوی دایرکت اینستاگرام (یک ترِد با یک کاربر).
 *
 * هر گفتگو با IGSID (شناسه‌ی کاربرِ اسکوپ‌شده به اینستاگرام) شناخته می‌شود؛
 * این شناسه از پیلودِ وبهوک به‌دست می‌آید و کلیدِ یکتای ترِد است.
 *
 * پیام‌ها در مدل جداگانه‌ی InstagramMessage ذخیره می‌شوند؛ اینجا فقط متادیتای
 * ترِد (آخرین پیام، شمارش نخوانده‌ها، اطلاعات طرفِ مقابل) نگه داشته می‌شود تا
 * فهرستِ گفتگوها بدون پیمایشِ پیام‌ها سریع رندر شود.
 */

const InstagramConversationSchema = new mongoose.Schema(
  {
    // IGSID کاربرِ اینستاگرام (طرفِ گفتگو) — کلیدِ یکتای ترِد
    igsid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // اطلاعات پروفایلِ طرفِ مقابل (در صورت دسترسی از Graph API پر می‌شود)
    username: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    profilePic: { type: String, default: "" },

    // پیش‌نمایشِ آخرین پیام برای نمایش در فهرست
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: () => Date.now(), index: true },
    // فرستنده‌ی آخرین پیام: کاربر اینستاگرام یا ادمین
    lastMessageFrom: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // تعداد پیام‌های خوانده‌نشده (پیام‌های ورودیِ کاربر که ادمین ندیده)
    unreadCount: { type: Number, default: 0 },

    // زمانِ آخرین پیامِ ورودیِ کاربر — برای محاسبه‌ی پنجره‌ی ۲۴ ساعتهٔ مجاز برای پاسخ
    lastInboundAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// فهرستِ گفتگوها «جدیدترین فعالیت اول»
InstagramConversationSchema.index({ lastMessageAt: -1 });

export default mongoose.models.InstagramConversation ||
  mongoose.model("InstagramConversation", InstagramConversationSchema);
