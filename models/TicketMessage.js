/**
 * models/TicketMessage.js
 *
 * پیام‌های گفتگوی هر تیکت — کالکشن جداگانه (نه ساب‌داکیومنت) تا تاریخچه‌ی
 * چت بدون سقف رشد کند و لیست تیکت‌ها سبک بماند.
 * پیوست‌ها از مکانیزم آپلود موجود (POST /api/upload — ImageKit) می‌آیند.
 */

import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    // pdf ها private آپلود می‌شوند و از طریق /api/files/pdf نمایش داده می‌شوند
    type: { type: String, enum: ["image", "pdf"], default: "image" },
    filename: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const TicketMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },

    // فرستنده: خودِ مشتری یا یک ادمین (هر دو در کالکشن User هستند)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },

    // متن می‌تواند خالی باشد اگر پیام فقط پیوست داشته باشد (اعتبارسنجی در روت)
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.TicketMessage ||
  mongoose.model("TicketMessage", TicketMessageSchema);
