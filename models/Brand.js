import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";
import Serie from "base/models/Serie";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          // بررسی اینکه فقط حروف انگلیسی و اعداد باشد
          return /^[a-zA-Z0-9\s\-_]+$/.test(v);
        },
        message: 'نام باید فقط شامل حروف انگلیسی، اعداد، فاصله، خط تیره و زیرخط باشد'
      }
    },

    title: {
      type: String,
      required: true,
    },


    country: {
      type: String,
      default: null,
    },

    foundedYear: {
      type: Number,
      default: null,
    },

    description: {
      type: String,
      default: "",
    },

    logo: {
      type: String,
      default: "",
    },

    icon: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },
    
    series: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Serie",
      }
    ],

    prompts: [
      {
        field: String,
        context: String
      }
    ],

    slug: {
      type: String,
      unique: true,
      trim: true,
    },

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
    while (await mongoose.models.Brand.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }
    this.slug = slug;
  }
});

export default mongoose.models.Brand || mongoose.model("Brand", schema);
