import mongoose from "mongoose";

/**
 * دفترکل پاداش‌های نقدی اعطا شده بابت نظر تأییدشده. هر ردیف یعنی یک پاداش
 * از قبل واریز شده است — این مدل خودش مانع از پرداخت دوباره می‌شود، نه
 * وضعیت کامنت.
 *
 * item در حالت per-order همیشه null است؛ ایندکس یکتای {order, item} چون
 * Mongo مقادیر null تکراری را در یک فیلد ایندکس‌شده یکتا، تکراری در نظر
 * می‌گیرد، به‌طور اتمی مانع از ثبت بیش از یک پاداش برای همان سفارش می‌شود.
 * در حالت per-item، item شناسه‌ی محصول/کالای دست دوم است، پس هر آیتم
 * متفاوتِ همان سفارش پاداش جداگانه‌ی خودش را می‌گیرد.
 */
const ReviewCreditTransactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },
    itemType: {
      type: String,
      enum: ["product", "usedProduct"],
      default: null,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    granularity: {
      type: String,
      enum: ["per-order", "per-item"],
      required: true,
    },
    kind: {
      type: String,
      enum: ["percent", "amount"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

ReviewCreditTransactionSchema.index({ order: 1, item: 1 }, { unique: true });

export default mongoose.models.ReviewCreditTransaction ||
  mongoose.model("ReviewCreditTransaction", ReviewCreditTransactionSchema);
