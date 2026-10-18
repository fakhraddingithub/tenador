import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";
import { BrochureSchema } from "base/models/articleSchemas";

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

    // بروشورِ ورزش — همان BrochureSchema و همان قواعدِ بروشورِ برند: فقط نسخه‌ی
    // «published» با دست‌کم یک بلوک جای صفحه‌ی ورزش را می‌گیرد. select:false تا
    // در ناوبار، کانتکستِ صفحه و هر جای دیگری که ورزش خوانده می‌شود حمل نشود.
    brochure: {
      type: BrochureSchema,
      default: undefined,
      select: false,
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