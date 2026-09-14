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
      default: null,
    },

    // نظرِ محصول دست دوم مستقل از Product نگه داشته می‌شود تا هر کالای
    // یکتای خریداری‌شده فقط یک‌بار قابل بررسی باشد.
    usedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UsedProduct",
      default: null,
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

    // تصاویر واقعی کالای دریافت‌شده — برای نظرِ خریدِ تأییدشده، چه محصول نو و
    // چه دست دوم. اعتبارسنجیِ «چه کسی حق تصویر دارد» در روت POST /api/comments
    // انجام می‌شود؛ اسکیما فقط سقفِ تعداد را تضمین می‌کند.
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length <= 4,
        message: "حداکثر ۴ تصویر برای هر نظر مجاز است",
      },
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    reviewRewardAmount: { select: false, type: Number, default: null, min: 0 },
    reviewRewardEditedBy: { select: false, type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewRewardEditedAt: { select: false, type: Date, default: null },
    reviewRewardLocked: { select: false, type: Boolean, default: false },

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
CommentSchema.index({ usedProduct: 1, status: 1, parent: 1 });
CommentSchema.index({ user: 1, usedProduct: 1, parent: 1 });

// «هر کاربر، برای هر محصول، فقط یک نظرِ سطح‌بالا». چکِ findOne در روت یک پنجره‌ی
// رقابتی دارد؛ تنها چیزی که دو ثبتِ هم‌زمان را واقعاً غیرممکن می‌کند همین ایندکس
// است و روت خطای E11000 آن را به ۴۰۹ ترجمه می‌کند. partial است تا پاسخ‌ها
// (parent !== null) و سمتِ خالیِ product/usedProduct را در بر نگیرد.
// autoIndex خاموش است → با `npm run ensure:indexes` ساخته می‌شود. اگر داده‌ی
// تکراریِ قدیمی مانع ساختش شود، آن اسکریپت گزارش می‌دهد و چیزی از کار نمی‌افتد
// (روت همچنان چکِ findOne را دارد).
CommentSchema.index(
  { user: 1, product: 1 },
  {
    unique: true,
    partialFilterExpression: { product: { $type: "objectId" }, parent: null },
  }
);
CommentSchema.index(
  { user: 1, usedProduct: 1 },
  {
    unique: true,
    partialFilterExpression: { usedProduct: { $type: "objectId" }, parent: null },
  }
);

CommentSchema.set("toJSON", { virtuals: true });
CommentSchema.set("toObject", { virtuals: true });

export default mongoose.models.Comment ||
  mongoose.model("Comment", CommentSchema);
