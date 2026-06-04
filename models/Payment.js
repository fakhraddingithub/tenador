import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: ["ONLINE", "BANK_RECEIPT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REJECTED"],
      default: "PENDING",
    },

    onlinePayment: {
      authority: String,
      refId: String,
      gateway: String,
      paidAt: Date,
    },

    bankReceipt: {
      imageUrls: [{ type: String }],
      uploadedAt: Date,
      reviewStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: Date,
      rejectReason: String,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Payment ||
  mongoose.model("Payment", PaymentSchema);
