import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // فقط برای نظری که از مسیر سفارش (خرید تأییدشده) ثبت شده تنظیم می‌شود
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    date: {
      type: Date,
      default: () => Date.now(),
      immutable: false,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    // وضعیت بازبینی توسط ادمین — منبع حقیقت برای نمایش عمومی
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // true فقط وقتی order ست شده باشد و آن سفارشِ کاربر شامل این محصول و
    // ارسال‌شده/تحویل‌شده باشد (تأییدشده سمت سرور)
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },

    // فلگ سازگار با کد قدیمی — همگام با status نگه داشته می‌شود
    approved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

CommentSchema.virtual("replies", {
  ref: "Comment",
  localField: "_id",
  foreignField: "parent",
});

// همگام‌سازی فلگ legacy «approved» با وضعیت بازبینی
CommentSchema.pre("save", function () {
  this.approved = this.status === "approved";
});

// واکشی سریعِ نظرهای تأییدشده‌ی یک محصول و کنترل تکراری‌نبودنِ نظر کاربر
CommentSchema.index({ product: 1, status: 1, parent: 1 });
CommentSchema.index({ user: 1, product: 1, parent: 1 });

CommentSchema.set("toJSON", { virtuals: true });
CommentSchema.set("toObject", { virtuals: true });

export default mongoose.models.Comment ||
  mongoose.model("Comment", CommentSchema);
