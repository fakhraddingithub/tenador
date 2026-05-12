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
      trim: true,
    },

    description: {
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

    slug: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },

    order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ساخت slug
schema.pre("save", async function () {
  if (!this.slug || this.isModified("name")) {
    const baseSlug = createSlug(this.name);

    let slug = baseSlug;
    let counter = 1;

    while (
      await mongoose.models.Sport.findOne({
        slug,
        _id: { $ne: this._id },
      })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }
});

export default mongoose.models.Sport ||
  mongoose.model("Sport", schema);