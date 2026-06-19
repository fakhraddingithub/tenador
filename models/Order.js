/**
 * models/Order.js
 *
 * مدل سفارش — با پشتیبانی از محصولات معمولی و دست‌دوم
 */

import mongoose from "mongoose";

// انتخاب‌های فرایند سفارش برای هر آیتم (خدمات + محصولات انتخاب‌شده)
const OrderFlowSelectionSchema = new mongoose.Schema(
  {
    nodeId:    { type: String },
    nodeLabel: { type: String, default: "" },
    nodeType:  { type: String, enum: ["service", "category"] },

    // نود نوع service
    serviceLabel: { type: String, default: "" },
    serviceValue: { type: String, default: "" },

    // نود نوع category
    selectedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    selectedVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
    },
    selectedProductName:  { type: String, default: "" },
    selectedVariantLabel: { type: String, default: null },

    // افزوده‌ی قیمت این انتخاب (تومان، تأییدشده سمت سرور)
    addonToman: { type: Number, default: 0 },

    // وضعیت تأمین این انتخاب فرایند: موجود در انبار / باید خریداری شود / خریداری شد
    procurementStatus: {
      type: String,
      enum: ["IN_STOCK", "TO_PURCHASE", "PURCHASED"],
      default: null,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────
// سیستم یورو (EUR) — کاملاً مستقل از سیستم تومان
// این بخش هیچ ربطی به فیلدهای تومانی (totalPrice / payments / ...) ندارد و
// به‌صورت دستی توسط ادمین مدیریت می‌شود. هیچ تبدیل خودکاری بین یورو و تومان
// انجام نمی‌شود.
// ─────────────────────────────────────────────────────────────────────────
const EurPaymentSchema = new mongoose.Schema(
  {
    // مبلغ پرداخت‌شده به یورو (وارد‌شده دستی توسط ادمین)
    amount: { type: Number, required: true, min: 0 },
    // یادداشت اختیاری (مثلاً روش پرداخت یا شماره تراکنش)
    note: { type: String, default: "" },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    confirmedAt: { type: Date, default: Date.now },

    // ─── ردپای ممیزی ویرایش مبلغ (مستقل از تومان) ───
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editedAt: { type: Date, default: null },
    editHistory: {
      type: [
        {
          _id: false,
          oldAmount: Number,
          newAmount: Number,
          at: { type: Date, default: Date.now },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        },
      ],
      default: [],
    },
  },
  { _id: true, timestamps: true }
);

const OrderSchema = new mongoose.Schema(
  {
    trackingCode: {
      type: String,
      unique: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: [
      {
        // محصول معمولی (Product)
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          default: null,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },

        // محصول دست‌دوم (UsedProduct)
        usedProduct: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "UsedProduct",
          default: null,
        },

        // نوع آیتم
        itemType: {
          type: String,
          enum: ["product", "used_product"],
          default: "product",
        },

        quantity:  { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 }, // قیمت واحد تأیید‌شده سمت سرور (تومان) — شامل افزوده‌ی فرایند

        // ─── اسنپ‌شات قیمت‌گذاری برای بازمحاسبه‌ی دقیق هنگام ویرایش ادمین ───
        // basePriceToman = قیمت واحدِ پیش از تخفیف محصول (شامل افزوده‌ی فرایند) =
        // unitPrice + unitDiscount. برای آیتم‌های قدیمی null است؛ در این صورت
        // بازمحاسبه آن آیتم را بدون تخفیف فرض می‌کند (unitPrice همان base).
        // این فیلدها هرگز در محاسبه‌ی مانده/مبلغ کل دخیل مستقیم نیستند؛ فقط برای
        // بازسازی دقیق subtotalPrice / discountAmount استفاده می‌شوند.
        basePriceToman: { type: Number, default: null, min: 0 },
        unitDiscount:   { type: Number, default: 0, min: 0 },

        // وضعیت تأمین محصول اصلی این آیتم: موجود در انبار / باید خریداری شود / خریداری شد
        procurementStatus: {
          type: String,
          enum: ["IN_STOCK", "TO_PURCHASE", "PURCHASED"],
          default: null,
        },

        // انتخاب‌های فرایند سفارش (خدمات و محصولات مرتبط)
        flowSelections: { type: [OrderFlowSelectionSchema], default: [] },
      },
    ],

    subtotalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    coupon: {
      code: { type: String, default: null },
      _id:  { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    },

    paymentMethod: {
      type: String,
      enum: ["ONLINE", "BANK_RECEIPT", "INSTALLMENT"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
    },

    fulfillmentStatus: {
      type: String,
      enum: ["WAITING", "NEEDS_PURCHASE", "PROCESSING", "SENT", "DELIVERED", "CANCELED"],
      default: "WAITING",
    },

    address: {
      ref: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
        default: null,
      },
      snapshot: {
        fullName:    String,
        phone:       String,
        province:    String,
        city:        String,
        postalCode:  String,
        addressLine: String,
      },
    },

    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],

    // ─── سیستم یورو (EUR) — مستقل از تومان ───────────────────────────────
    // قیمت سفارش به یورو — به‌صورت دستی توسط ادمین وارد می‌شود (بدون تبدیل خودکار).
    // برای سفارش‌های قدیمی که یورو ندارند مقدار پیش‌فرض null است تا چیزی نشکند.
    priceEUR: {
      type: Number,
      default: null,
      min: 0,
    },

    // تاریخچه‌ی پرداخت‌های یورویی — جدا از آرایه‌ی payments تومانی.
    // مانده‌ی یورو از priceEUR منهای مجموع این آرایه محاسبه می‌شود.
    paymentsEUR: {
      type: [EurPaymentSchema],
      default: [],
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      maxlength: 500,
      default: "",
    },

    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

OrderSchema.virtual("itemsCount").get(function () {
  return this.items.reduce((sum, i) => sum + i.quantity, 0);
});

OrderSchema.set("toJSON", { virtuals: true });
OrderSchema.set("toObject", { virtuals: true });

function generateTrackingCode(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const dd   = String(date.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterPart =
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)];

  const numberPart = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  return `${datePart}${letterPart}${numberPart}`;
}

OrderSchema.pre("save", function () {
  if (!this.trackingCode) {
    this.trackingCode = generateTrackingCode(this.orderDate);
  }
});

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);