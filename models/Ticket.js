/**
 * models/Ticket.js
 *
 * تیکت پشتیبانی — جایگزین سیستم قدیمی (Ticket/Department با الگوی request/answer).
 * پیام‌های هر تیکت در کالکشن جداگانه‌ی TicketMessage نگهداری می‌شوند
 * (الگوی گفتگو با رشد نامحدود؛ همان الگویی که Comment جدا از Product است).
 */

import mongoose from "mongoose";
import {
  TICKET_DEPARTMENTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "base/utils/ticketMeta";

const TicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    department: {
      type: String,
      enum: TICKET_DEPARTMENTS,
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: "medium",
      index: true,
    },

    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: "open",
      index: true,
    },

    // ارجاع اختیاری به سفارش/پرداختِ خودِ کاربر (مالکیت سمت سرور بررسی می‌شود)
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // ادمینی که تیکت را در دست دارد (با اولین پاسخ تنظیم می‌شود)
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    closedBy: {
      type: String,
      enum: ["user", "admin", null],
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },

    // زمان آخرین پیام — برای مرتب‌سازی «آخرین فعالیت» بدون کوئریِ پیام‌ها
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
