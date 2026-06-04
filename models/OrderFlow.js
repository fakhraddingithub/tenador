import mongoose from "mongoose";

// هر گزینه در یک سرویس یا محصول
const OptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // مثلا: "تنش ۲۵"
    value: { type: String, required: true, trim: true }, // مثلا: "25"
    priceModifier: { type: Number, default: 0 }, // تغییر قیمت (مثبت یا منفی)
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
    serviceOptions: { type: [OptionSchema], default: [] }, // آپشن‌های خدمت

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
