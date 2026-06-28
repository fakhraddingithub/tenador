import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

const AttributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true },

    // این فیلد حالا هم نوع نمایش را تعیین می‌کند و هم به طور ضمنی نوع داده را
    uiType: {
      type: String,
      enum: [
        "text-input",
        "number-input",
        "dropdown",
        "swatch",
        "button-toggle",
      ],
      default: "text-input",
    },

    required: { type: Boolean, default: true },

    // آیا این ویژگی در صفحه‌ی محصولات به‌عنوان فیلتر متنی قابل استفاده است؟
    // پیش‌فرض false؛ ادمین باید آن را صریحاً فعال کند.
    filterable: { type: Boolean, default: false },

    // همیشه آرایه‌ای از String
    options: { type: [String], default: [] },

    prompt: { type: String, trim: true },

    // ویژگیِ چندواحدی (Change 3): مثلاً سایز با واحدهای ["EU", "سانتی‌متر"].
    // مقدارِ اصلی (primary) همان واحدِ اول است؛ سایر واحدها فقط برای نمایش‌اند و
    // در product.variantMeta[attr][value].units نگه‌داری می‌شوند.
    multiUnit: { type: Boolean, default: false },
    units: { type: [String], default: [] },
  },
  { _id: false },
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
    max: { type: Number, default: 100 },
  },
  { _id: false },
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
        message:
          "نام باید فقط شامل حروف انگلیسی، اعداد، فاصله، خط تیره و زیرخط باشد",
      },
    },

    slug: {
      type: String,
      required: true,
      trim: true,
    },

    // ورزشِ صاحبِ این دسته — اسلاگ دسته فقط در محدوده‌ی همین ورزش یکتاست
    // (ساختار سئو: /[sportSlug]/[categorySlug] مثل /tennis/racket و /padel/racket)
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      required: true,
      index: true,
    },

    prompts: [
      {
        field: String,
        context: String,
      },
    ],
    
    icon: {
      type: String,
      default: "",
    },
    
    image: {
      type: String,
      default: "",
    },

    attributes: {
      type: [AttributeSchema],
      default: [],
    },

    variantAttributes: {
      type: [AttributeSchema],
      default: [],
    },

    // ویژگیِ انتخاب‌شده برای فیلترِ مگامنو — نامِ یکی از ویژگی‌های همین دسته
    // (از attributes یا variantAttributes). مقادیرِ این ویژگی به‌صورتِ تب‌های فیلتر
    // در مگامنو نمایش داده می‌شوند و لینکِ برند را با ?[name]=[value] می‌سازند.
    // null = این دسته در مگامنو فیلتری ندارد.
    megaMenuFilterAttribute: {
      type: String,
      default: null,
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
      default: null,
    },

    order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true },
);

// اسلاگ فقط در محدوده‌ی هر ورزش یکتاست (نه سراسری). دو ورزش مختلف می‌توانند
// دسته‌ای با اسلاگ یکسان (مثلاً "racket") داشته باشند.
CategorySchema.index({ sport: 1, slug: 1 }, { unique: true });

// ایجاد اسلاگ اتوماتیک — یکتایی فقط درونِ همان ورزش بررسی می‌شود
CategorySchema.pre("validate", async function () {
  if (!this.slug && this.name) {
    const baseSlug = createSlug(this.name);
    let slug = baseSlug;
    let counter = 1;

    while (
      await mongoose.models.Category.findOne({ slug, sport: this.sport })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }
});

export default mongoose.models.Category ||
  mongoose.model("Category", CategorySchema);
