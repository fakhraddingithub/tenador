import mongoose from "mongoose";

const CheckSchema = new mongoose.Schema(
  {
    checkNumber: {
      type: String,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    paidAt: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["PENDING", "CLEARED", "BOUNCED"],
      default: "PENDING",
    },

    receiptImageUrl: {
      type: String,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: {
      type: Date,
    },

    bounceReason: {
      type: String,
    },

    // یادداشت ادمین برای این چک (اختیاری)
    notes: {
      type: String,
      default: "",
    },

    // آخرین زمانی که برای این چک به مشتری یادآوری ارسال شد (برای جلوگیری از ارسال تکراری)
    lastReminderAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const InstallmentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    downPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    numberOfChecks: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      // PENDING: درخواست ثبت شده، هنوز پیش‌پرداخت/چکی تأیید نشده
      // ACTIVE: حداقل یک چک تأیید شده ولی همه نه
      // COMPLETED: همه چک‌ها تأیید (CLEARED) شده‌اند
      // DEFAULTED: حداقل یک چک برگشت خورده (BOUNCED)
      enum: ["PENDING", "ACTIVE", "COMPLETED", "DEFAULTED"],
      default: "PENDING",
    },

    // ─── تأیید نهایی سفارش توسط ادمین پس از بازبینی چک‌ها ───
    // سفارش اقساطی تا زمانی که ادمین این فیلد را ست نکند به مرحله‌ی پردازش/ارسال نمی‌رود.
    orderConfirmedAt: {
      type: Date,
      default: null,
    },
    orderConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    checks: [CheckSchema],
  },
  { timestamps: true }
);

export default mongoose.models.Installment ||
  mongoose.model("Installment", InstallmentSchema);
