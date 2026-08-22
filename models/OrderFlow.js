import mongoose from "mongoose";

// ⚠️ قدیمی — فقط برای خواندنِ فرایندهای موجود نگه داشته شده است.
// تعریفِ جدید در ServiceOptionSchema پایین است. رجوع به src/lib/serviceConfig.js
const OptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // مثلا: "تنش ۲۵"
    value: { type: String, required: true, trim: true }, // مثلا: "25"
    priceModifier: { type: Number, default: 0 }, // تغییر قیمت (مثبت یا منفی)
  },
  { _id: false }
);

// یک گزینه از آپشنِ نوع choice — مثلا «۱.۲۵» زیرِ آپشنِ «قطر زه»
const ServiceChoiceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true }, // شناسه‌ی پایدار داخل آپشن
    label: { type: String, required: true, trim: true },
    priceModifier: { type: Number, default: 0 }, // تومان
    image: { type: String, default: null }, // اختیاری (ImageKit URL)
  },
  { _id: false }
);

// یک آپشنِ قابلِ پیکربندی از یک خدمت — مثلا «قطر زه» یا «تنش»
// نوعِ ورودی قابلِ گسترش است؛ فعلاً choice و range.
const ServiceOptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true }, // شناسه‌ی پایدار داخل نود
    title: { type: String, required: true, trim: true }, // مثلا: "تنش"
    description: { type: String, default: "", trim: true }, // متن راهنما
    inputType: { type: String, enum: ["choice", "range"], default: "choice" },
    required: { type: Boolean, default: false },
    image: { type: String, default: null },

    // inputType === "choice"
    choices: { type: [ServiceChoiceSchema], default: [] },

    // inputType === "range" — گام می‌تواند اعشاری باشد (۰.۵ و ...)
    range: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      step: { type: Number, default: 1 },
      unit: { type: String, default: "", trim: true }, // مثلا: "kg"
      basePrice: { type: Number, default: 0 }, // افزوده‌ی ثابت هنگام انتخاب
      pricePerStep: { type: Number, default: 0 }, // افزوده به‌ازای هر گام بالاتر از min
    },
  },
  { _id: false }
);

// یک شرطِ نمایشِ مرحله — منطقِ ارزیابی در src/lib/flowConditions.js است.
// نوعِ شرط عمداً enum نیست تا افزودنِ نوعِ جدید نیازی به تغییرِ اسکیما نداشته باشد؛
// اعتبارسنجیِ نوع در validateNodeConditions انجام می‌شود.
const FlowConditionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true }, // answered | notAnswered | choiceEquals | ...
    nodeId: { type: String, required: true, trim: true }, // مرحله‌ی مرجع (همیشه یکی از مراحلِ قبلی)
    optionKey: { type: String, default: null }, // برای choiceEquals
    choiceKey: { type: String, default: null }, // برای choiceEquals
  },
  { _id: false }
);

// یک نود در گراف فرایند سفارش
const FlowNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // شناسه داخلی نود (uuid)
    type: {
      type: String,
      required: true,
      enum: ["category", "service"], // دسته‌بندی محصول یا خدمت
    },
    label: { type: String, required: true, trim: true }, // عنوان نمایشی
    required: { type: Boolean, default: false }, // آیا انتخاب اجباری است؟

    // برای نود نوع "category"
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    allowVariantSelection: { type: Boolean, default: true }, // آیا انتخاب واریانت فعال است؟

    // برای نود نوع "service"
    serviceName: { type: String, trim: true }, // مثلا: "زه‌کشی"
    // هزینه‌ی خودِ خدمت (تومان) — بدونِ نیاز به ساختنِ یک آپشنِ ساختگی برای قیمت.
    // مرحله‌ی اجباری همیشه آن را می‌گیرد، مرحله‌ی اختیاری فقط وقتی مشتری خدمت را
    // انتخاب کند؛ و در هر دو حالت فقط اگر شرطِ نمایشِ مرحله برقرار باشد.
    servicePrice: { type: Number, default: 0 },
    // آپشن‌های قابلِ پیکربندیِ خدمت (ساختار فعلی)
    options: { type: [ServiceOptionSchema], default: [] },
    // ⚠️ قدیمی — فقط برای فرایندهای ذخیره‌شده‌ی قبلی. با ذخیره‌ی دوباره‌ی نود
    // در پنل ادمین به options تبدیل می‌شود. رجوع به src/lib/serviceConfig.js
    serviceOptions: { type: [OptionSchema], default: [] },

    // نمایشِ شرطی — خالی یعنی «همیشه دیده شود» (رفتارِ همه‌ی فرایندهای موجود)
    visibleWhen: {
      mode: { type: String, enum: ["all", "any"], default: "all" },
      conditions: { type: [FlowConditionSchema], default: [] },
    },

    // موقعیت در گراف
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

// لبه‌های اتصال بین نودها
const FlowEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true }, // id نود مبدا
    target: { type: String, required: true }, // id نود مقصد
    label: { type: String, trim: true }, // عنوان اختیاری روی لبه
  },
  { _id: false }
);

const OrderFlowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // مثلا: "فرایند سفارش راکت تنیس"
    description: { type: String, trim: true },

    // دسته‌بندی ریشه که این فرایند برای آن تعریف شده (مثلا: راکت تنیس)
    rootCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    isActive: { type: Boolean, default: true },

    nodes: { type: [FlowNodeSchema], default: [] },
    edges: { type: [FlowEdgeSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.OrderFlow ||
  mongoose.model("OrderFlow", OrderFlowSchema);
