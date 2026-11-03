import mongoose from "mongoose";

/**
 * models/ProductPromptConfig.js
 *
 * تنظیماتِ پرامپتِ تولیدِ محصول — یک سندِ یکتا (key: "product").
 * شکل و قواعد در src/lib/productPromptConfig.js است؛ اینجا فقط ذخیره‌سازی.
 *
 *   document   : بخش‌های پرامپت به ترتیب. خالی = هنوز ذخیره نشده (productPromptResolve.js)
 *   fieldRules : قواعدِ پایه‌ی هر فیلدِ محصول
 *   templates  : قالبِ سطرهای داده‌محور
 *   groups     : گروه‌های پرامپت دسته، به ترتیبِ اعمال. rule.categories خالی یعنی
 *                «همه‌ی دسته‌های همین گروه».
 *   base       : شکلِ قدیمیِ پرامپت پایه؛ فقط خوانده می‌شود، تا وقتی document ذخیره نشده.
 */
const categoryRefs = { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }], default: [] };

const GroupRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    text: { type: String, required: true },
    categories: categoryRefs,
  },
  { _id: false },
);

// متن‌ها دقیقاً همان‌طور که ادمین نوشته می‌مانند: نه trim، نه required (خالی یعنی چاپ نشود)
const sectionHead = {
  key: { type: String, required: true },
  name: { type: String, required: true },
  top: { type: String, default: "" },
  title: { type: String, default: "" },
  bottom: { type: String, default: "" },
  description: { type: String, default: "" },
  blankLines: { type: Number, default: 1 },
};

const DocumentSectionSchema = new mongoose.Schema(
  {
    ...sectionHead,
    kind: { type: String, enum: ["text", "fields", "groups"], required: true },
    rules: { type: [String], default: [] },
    fieldBlankLines: { type: Number },
  },
  { _id: false },
);

const GroupSectionSchema = new mongoose.Schema(
  {
    ...sectionHead,
    rules: {
      type: [new mongoose.Schema({ text: { type: String, required: true }, categories: categoryRefs }, { _id: false })],
      default: [],
    },
  },
  { _id: false },
);

const ProductPromptConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "product" },
    document: { type: [DocumentSectionSchema], default: [] },
    fieldRules: {
      type: [{ field: { type: String, required: true }, rules: { type: [String], default: [] }, _id: false }],
      default: [],
    },
    templates: {
      type: [{ key: { type: String, required: true }, text: { type: String, default: "" }, _id: false }],
      default: [],
    },
    base: {
      type: [{ section: { type: String, required: true }, rules: { type: [String], default: [] }, _id: false }],
      default: [],
    },
    groups: {
      type: [
        {
          title: { type: String, default: "" },
          categories: categoryRefs,
          rules: { type: [GroupRuleSchema], default: [] },
          sections: { type: [GroupSectionSchema], default: [] },
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
