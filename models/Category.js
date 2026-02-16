import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";
const AttributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // مثل: color, size, weight
      trim: true,
    },

    label: {
      type: String,
      required: true, // برچسب برای UI مثل "رنگ"
    },

    type: {
      type: String,
      enum: ["string", "number", "select"],
      default: "string",
    },

    required: {
      type: Boolean,
      default: true,
    },

    // برای select:
    // ["Red","Blue","Green"]
    options: {
      type: [String],
      default: [],
    },

    prompt: {
      type: String,
      required: false, // اختیاری
      trim: true,
    },
  },
  { _id: false }
);

const TechnicalStatSchema = new mongoose.Schema(
  {
    name: {
      type: String, 
      required: true, // مثلا: power
    },
    label: {
      type: String, 
      required: true, // مثلا: قدرت
    },
    description: {
      type: String, 
    },
    
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 }
  },
  { _id: false }
);


const CategorySchema = new mongoose.Schema(
  {

    title: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          // بررسی اینکه فقط حروف انگلیسی و اعداد باشد
          return /^[a-zA-Z0-9\s\-_]+$/.test(v);
        },
        message: 'نام باید فقط شامل حروف انگلیسی، اعداد، فاصله، خط تیره و زیرخط باشد'
      }
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    prompts: [
      {
        field: String,
        context: String
      }
    ],

    attributes: {
      type: [AttributeSchema],
      default: [],
    },

    technicalStats: {
      type: [TechnicalStatSchema],
      default: [],
    },

    technicalStatsPrompt: {
      type: String,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null, // برای کتگوری‌های چندسطحی
    },
  },
  { timestamps: true }
);



// ایجاد اسلاگ اتوماتیک
CategorySchema.pre("validate", async function () {
  if (!this.slug && this.name) {
    const baseSlug = createSlug(this.name);
    let slug = baseSlug;
    let counter = 1;

    while (await mongoose.models.Category.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }

});




export default mongoose.models.Category ||
  mongoose.model("Category", CategorySchema);
