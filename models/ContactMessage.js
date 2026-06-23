const mongoose = require("mongoose");

/**
 * ContactMessage — پیام‌های فرم «تماس با ما».
 *
 * مدل Ticket موجود برای کاربرانِ واردشده طراحی شده (user و department اجباری‌اند)
 * و برای بازدیدکنندگانِ ناشناسِ فرم تماس مناسب نیست؛ بنابراین یک مدل اختصاصی
 * می‌سازیم و آن را در بخش «پشتیبانی» پنل مدیریت (در کنار دایرکت اینستاگرام)
 * به‌صورت یک صندوقِ پیام نمایش می‌دهیم.
 */
const schema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true }, // اختیاری
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    message: { type: String, required: true },

    // فایل پیوست اختیاری (تصویر یا PDF) — روی Cloudinary آپلود می‌شود
    attachmentUrl: { type: String, default: "" },
    attachmentType: { type: String, default: "" }, // image | pdf

    // وضعیت رسیدگی در پنل پشتیبانی
    status: {
      type: String,
      enum: ["new", "read", "archived"],
      default: "new",
      index: true,
    },

    // اگر کاربر واردشده فرم را پر کند، به سند او لینک می‌شود (اختیاری)
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

const model =
  mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", schema);

export default model;
