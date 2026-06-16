/**
 * models/LimitedEdition.js
 *
 * لیمیتد ادیشن (مثل Roland Garros) — ساختاری مشابه Serie، اما اکنون به یک برند
 * خاص محدود می‌شود (هر برند می‌تواند لیمیتد ادیشن‌های مخصوص خود را داشته باشد).
 * ارتباط با محصولات از طریق فیلد limitedEdition روی هر محصول برقرار می‌شود
 * (هر محصول هم serie دارد هم می‌تواند یک limitedEdition داشته باشد).
 */

import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

const schema = new mongoose.Schema(
  {
    // برندی که این لیمیتد ادیشن متعلق به آن است — مدیریت از صفحه‌ی همان برند انجام می‌شود
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },

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

    while (await mongoose.models.LimitedEdition.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    this.slug = slug;
  }
});

export default mongoose.models.LimitedEdition ||
  mongoose.model("LimitedEdition", schema);
