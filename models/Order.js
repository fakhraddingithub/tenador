/**
 * models/Order.js
 *
 * مدل سفارش — با پشتیبانی کامل از کوپن، تخفیف و قیمت تأیید‌شده سرور
 */

import mongoose from "mongoose";

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
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 }, // قیمت واحد تأیید‌شده سمت سرور (تومان)
      },
    ],

    // قیمت‌های تومانی تأیید‌شده سمت سرور
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

    // اطلاعات کوپن اعمال‌شده
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
      enum: ["WAITING", "PROCESSING", "SENT", "DELIVERED", "CANCELED"],
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
        fullAddress: String,
      },
    },

    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],

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

// Virtual: تعداد کل آیتم‌ها
OrderSchema.virtual("itemsCount").get(function () {
  return this.items.reduce((sum, i) => sum + i.quantity, 0);
});

OrderSchema.set("toJSON", { virtuals: true });
OrderSchema.set("toObject", { virtuals: true });

// تولید کد رهگیری یکتا
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
