import mongoose from "mongoose";
import { createSlug } from "base/utils/slugify";

function throwVariantValidationError(document, message) {
  const validationError = new mongoose.Error.ValidationError(document);
  validationError.addError(
    "attributes",
    new mongoose.Error.ValidatorError({
      path: "attributes",
      message,
      value: document.attributes,
    })
  );
  throw validationError;
}

const VariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      trim: true,
    },

    // -----------------------------
    // DYNAMIC ATTRIBUTE SYSTEM
    // attributes = Map<string, string>
    // مثل: weight, color, gripSize, material ...
    // -----------------------------
    attributes: {
      type: Map,
      of: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);



// -----------------------------
// 1) Generate slug automatically
// -----------------------------
VariantSchema.pre("save", function () {
  if (this.isModified("sku") || this.isModified("attributes")) {
    const attrString = Array.from(this.attributes.values()).join("-");
    this.slug = createSlug(`${this.sku}-${attrString}`);
  }
});



// -----------------------------------------------
// 2) Validate attributes based on Category schema
// -----------------------------------------------
VariantSchema.pre("validate", async function () {
  const Category = mongoose.model("Category");
  const category = await Category.findById(this.categoryId);

  if (!category) {
    throwVariantValidationError(this, "دسته‌بندی واریانت یافت نشد؛ دسته‌بندی محصول را دوباره انتخاب کنید");
  }

  // فقط ویژگی‌هایی که در بخش variantAttributes تعریف شده‌اند مجاز هستند
  const allowedVariantKeys = category.variantAttributes.map(a => a.name);
  const currentVariantKeys = Array.from(this.attributes.keys());

  // بررسی فیلدهای اجباری
  const missingRequired = category.variantAttributes
    .filter(a => a.required)
    .filter(a => !currentVariantKeys.includes(a.name));

  if (missingRequired.length > 0) {
    throwVariantValidationError(
      this,
      `ویژگی‌های واریانت اجباری وارد نشده‌اند: ${missingRequired
        .map((attribute) =>
          attribute.label && attribute.label !== attribute.name
            ? `${attribute.label} (${attribute.name})`
            : attribute.name
        )
        .join("، ")}. لطفاً برای همهٔ ویژگی‌های الزامی حداقل یک مقدار وارد کنید`
    );
  }

  // (اختیاری) جلوگیری از وارد کردن ویژگی‌های گلوبال در بخش واریانت
  const forbiddenKeys = currentVariantKeys.filter(key => !allowedVariantKeys.includes(key));
  if (forbiddenKeys.length > 0) {
    throwVariantValidationError(
      this,
      `ویژگی‌های ${forbiddenKeys.join("، ")} مربوط به مشخصات کلی محصول هستند، نه واریانت. آن‌ها را از بخش ویژگی‌های متغیر حذف کنید`
    );
  }
});



// FINAL EXPORT
export default mongoose.models.Variant ||
  mongoose.model("Variant", VariantSchema);
