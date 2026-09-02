import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // ------------------
    // Auth
    // ------------------
    provider: {
      type: String,
      enum: ["local", "google"],
      required: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: function() { return this.provider === 'local'; },
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      required: function() { return this.provider === 'google'; },
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
    },

    phoneVerified: {
      type: Boolean,
      default: function() { return this.provider === 'google'; },
    },

    otp: {
      code: String,
      expiresAt: Date,
    },

    // ------------------
    // Profile
    // ------------------
    name: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatar: { type: String },

    // ------------------
    // Roles
    // ------------------
    // نقش "seller" (فروشنده) حذف شده است — با "store" (فروشگاه) هم‌پوشان و اضافی
    // بود. رکوردهای قدیمی توسط normalizeLegacyRole (پایین) و اسکریپت
    // `npm run migrate:remove-seller-role` به "store" منتقل می‌شوند.
    role: {
      type: String,
      enum: ["user", "coach", "admin", "national_player", "store"],
      default: "user",
    },

    // ------------------
    // Level
    // ------------------
    level: {
      type: Number,
      default: 0, // 0=normal, 1=silver, 2=gold, 3=platinum
    },

    vipExpiresAt: {
      type: Date,
      default: null,
    },

    // ------------------
    // Account status (مسدودسازی حساب توسط ادمین)
    // ------------------
    isBanned: {
      type: Boolean,
      default: false,
    },

    // ------------------
    // Coach System & Verification (تغییر یافته)
    // ------------------
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // کد اختصاصی مربی برای لینک معرف و کارت دیجیتال
    coachCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // فیلدهای مربوط به فرآیند احراز هویت مربی
    coachApplication: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
      },
      fullName: { type: String, trim: true },
      certificateImage: { type: String }, // آدرس عکس مدرک مربیگری
      personalImage: { type: String },    // آدرس عکس پرسنلی ارسالی مربی
      appliedAt: { type: Date },
      reviewedAt: { type: Date },
      rejectionReason: { type: String },  // دلیل رد درخواست توسط ادمین
    },

    // ------------------
    // Wallet System (جدید)
    // ------------------
    walletBalance: {
      type: Number,
      default: 0, // موجودی کیف پول به تومان/ریال
    },

    // ------------------
    // Favorites
    // ------------------
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

/* ───────────────────────────  ایندکس‌ها  ───────────────────────────
   لیستِ کاربرانِ پنل ادمین با { createdAt: -1 } مرتب و روی role / isBanned
   فیلتر می‌شود؛ بدون ایندکس هر درخواست کلِ کالکشن را می‌پیمود.                */
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ isBanned: 1, createdAt: -1 });

// Orders
UserSchema.virtual("orders", {
  ref: "Order",
  localField: "_id",
  foreignField: "user",
});

// Comments
UserSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "user",
});

// Addresses
UserSchema.virtual("addresses", {
  ref: "Address",
  localField: "_id",
  foreignField: "user",
});

/* ─── سازگاری با نقشِ حذف‌شده‌ی "seller" ───────────────────────────────
   نقش "seller" از enum برداشته شده است. اگر سندی که هنوز مهاجرت نکرده
   (`npm run migrate:remove-seller-role`) از دیتابیس خوانده و بعد ذخیره شود —
   مثلاً کاربر پروفایلش را ویرایش کند — اعتبارسنجیِ enum شکست می‌خورد و آن
   عملیاتِ بی‌ربط با خطا برمی‌گشت. این هوک قبل از اعتبارسنجی مقدار را بی‌صدا به
   "store" (همان نقشی که seller قرار بود باشد) نگاشت می‌کند تا هیچ کاربر قدیمی
   قفل نشود. عمداً روی save/validate است و نه روی خواندن: خواندن هرگز شکست
   نمی‌خورد و داده‌ی تاریخی را دست‌کاری نمی‌کنیم مگر همان سند در حال نوشتن باشد. */
function normalizeLegacyRole(next) {
  if (this.role === "seller") this.role = "store";
  next();
}
UserSchema.pre("validate", normalizeLegacyRole);

UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);