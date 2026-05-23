/**
 * models/Order.js — نسخه بازنویسی‌شده
 *
 * تغییرات:
 *  + items حالا unitPriceToman, basePriceToman, discountToman دارد
 *  + فیلد coupon برای ذخیره اطلاعات کوپن اعمال‌شده
 *  + paymentStatus default به UNPAID تغییر کرد (قبلاً PENDING بود که enum نبود)
 */

import mongoose from "mongoose";

function generateTrackingCode(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterPart =
    letters[Math.floor(Math.random() * 26)] +
    letters[Math.floor(Math.random() * 26)];
  const numberPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${yyyy}${mm}${dd}${letterPart}${numberPart}`;
}

const OrderItemSchema = new mongoose.Schema(
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

    // قیمت‌ها به تومان — ذخیره‌شده در لحظه سفارش
    basePriceToman: { type: Number, required: true }, // قیمت قبل از تخفیف
    discountToman: { type: Number, default: 0 },       // مقدار تخفیف per unit
    unitPriceToman: { type: Number, required: true },  // قیمت نهایی per unit
  },
  { _id: false }
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

    items: [OrderItemSchema],

    /** مجموع قیمت نهایی به تومان */
    totalPrice: {
      type: Number,
      required: true,
    },

    /** اطلاعات کوپن اعمال‌شده */
    coupon: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
      code: { type: String, default: null },
      discountToman: { type: Number, default: 0 },
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
        fullName: String,
        phone: String,
        province: String,
        city: String,
        postalCode: String,
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

    description: { type: String, default: "" },

    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

OrderSchema.virtual("itemsCount").get(function () {
  return this.items.reduce((sum, i) => sum + i.quantity, 0);
});

OrderSchema.set("toJSON", { virtuals: true });
OrderSchema.set("toObject", { virtuals: true });

OrderSchema.pre("save", function () {
  if (!this.trackingCode) {
    this.trackingCode = generateTrackingCode(this.orderDate);
  }
});

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
