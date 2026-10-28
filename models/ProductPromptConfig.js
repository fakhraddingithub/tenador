import mongoose from "mongoose";

/**
 * models/ProductPromptConfig.js
 *
 * تنظیماتِ پرامپتِ تولیدِ محصول — یک سندِ یکتا (key: "product").
 * شکل و قواعد در src/lib/productPromptConfig.js است؛ اینجا فقط ذخیره‌سازی.
 *
 *   base   : بخش‌هایی از پرامپت پایه که ادمین ذخیره کرده. بخشِ غایب = پیش‌فرض،
 *            rules: [] = عمداً خالی.
 *   groups : گروه‌های پرامپت دسته، به ترتیبِ اعمال. rule.categories خالی یعنی
 *            «همه‌ی دسته‌های همین گروه».
 */
const GroupRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    text: { type: String, required: true },
    categories: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }], default: [] },
  },
  { _id: false },
);

const ProductPromptConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "product" },
    base: {
      type: [{ section: { type: String, required: true }, rules: { type: [String], default: [] }, _id: false }],
      default: [],
    },
    groups: {
      type: [
        {
          title: { type: String, default: "" },
          categories: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }], default: [] },
          rules: { type: [GroupRuleSchema], default: [] },
        },
      ],
      default: [],
    },
  },
  // دو ادمینِ هم‌زمان: ذخیره‌ی دوم با VersionError رد می‌شود، نه بازنویسیِ بی‌صدا
  { timestamps: true, optimisticConcurrency: true },
);

export default mongoose.models.ProductPromptConfig ||
  mongoose.model("ProductPromptConfig", ProductPromptConfigSchema);
