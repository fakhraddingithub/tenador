import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";
require("./Sport")

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[a-zA-Z0-9\s\-_]+$/.test(v);
        },
        message: 'نام باید فقط شامل حروف انگلیسی، اعداد، فاصله، خط تیره و زیرخط باشد'
      }
    },
    title: {
      type: String,
      required: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      required: true,
    },
    birthDate: {
      type: Date,
      default: null,
    },
    // --- فیلدهای جدید اضافه شده ---
    gender: {
      type: String,
      enum: ["male", "female"], // محدود کردن مقادیر ورودی
      default: "male",
    },
    height: {
      type: Number, // بر حسب سانتی‌متر
      default: null,
    },
    weight: {
      type: Number, // بر حسب کیلوگرم
      default: null,
    },
    nationality: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    honors: [
      {
        title: { type: String }, // مثلا: قهرمانی المپیک
        quantity: { type: Number },
        description: { type: String }
      }
    ],
    sponsors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand"
    }],
    // ----------------------------
    photo: {
      type: String, 
      default: "",
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

schema.pre("save", async function () {
  if (this.isModified("name")) {
    const baseSlug = createSlug(this.name);
    let slug = baseSlug;
    let counter = 1;
    while (await mongoose.models.Athlete.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
  }
});

export default mongoose.models.Athlete || mongoose.model("Athlete", schema);