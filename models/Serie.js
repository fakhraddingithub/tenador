import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,

      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s\-_]+$/.test(v);
        },

        message:
          "نام باید فقط شامل حروف انگلیسی، اعداد، فاصله، خط تیره و زیرخط باشد",
      },
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    colors: {
      primary: String,
      secondary: String,
    },

    logo: {
      type: String,
      default: "",
    },

    headImage: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    sportImages: {
      type: [
        {
          sport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Sport",
            required: true,
          },
          image: {
            type: String,
            default: "",
          },
          headImage: {
            type: String,
            default: "",
          },
        },
      ],
      default: [],
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },

    // والد
    parentSerie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Serie",
      default: null,
    },

    // سطح
    level: {
      type: Number,
      default: 0,
    },

    isLimitedEdition: {
      type: Boolean,
      default: false,
    },

    // "isNew" در Mongoose رزرو شده است؛ به همین دلیل isNewSerie نام‌گذاری شد
    isNewSerie: {
      type: Boolean,
      default: false,
    },

    slug: {
      type: String,
      unique: true,
      trim: true,
    },

    // ترتیب نمایش (drag & drop در پنل ادمین) — عدد کمتر = جلوتر
    order: {
      type: Number,
      default: 0,
      index: true,
    },
  },

  { timestamps: true }
);

schema.pre("save", async function () {
  if (this.isModified("name")) {
    const baseSlug = createSlug(this.name);

    let slug = baseSlug;

    let counter = 1;

    while (await mongoose.models.Serie.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }

  // auto level
  if (this.parentSerie) {
    const parent = await mongoose.models.Serie.findById(
      this.parentSerie
    );

    this.level = parent ? parent.level + 1 : 1;
  } else {
    this.level = 0;
  }
});

export default mongoose.models.Serie ||
  mongoose.model("Serie", schema);
