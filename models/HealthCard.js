import mongoose from "mongoose";

const FieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      match: /^[a-z0-9_]+$/,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const HealthCardSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      unique: true, // one HealthCard per category
    },
    fields: {
      type: [FieldSchema],
      validate: {
        validator(fields) {
          const keys = fields.map((f) => f.key);
          return keys.length === new Set(keys).size;
        },
        message: "Duplicate keys in fields",
      },
    },
  },
  { timestamps: true }
);

HealthCardSchema.index({ category: 1 });

export default mongoose.models.HealthCard ||
  mongoose.model("HealthCard", HealthCardSchema);