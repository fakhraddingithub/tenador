import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    fullName: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true
    },

    city: {
      type: String,
      required: true
    },

    addressLine: {
      type: String,
      required: true
    },

    postalCode: {
      type: String,
      required: false
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.models.Address ||
  mongoose.model("Address", AddressSchema);
