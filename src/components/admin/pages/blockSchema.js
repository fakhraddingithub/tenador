/**
 * تعریفِ انواع بلوک و فیلدهای قابل‌ویرایشِ هرکدام.
 * این فایل، ادیتورِ پنل را داده‌محور می‌کند و دقیقاً با رندرکننده‌ی عمومی
 * (src/components/pages/SectionRenderer) هم‌تراز است.
 *
 * انواع فیلد:
 *  text | textarea | image | icon | select | list | stringlist | grid
 */

const f = (key, type, label, extra = {}) => ({ key, type, label, ...extra });

export const BLOCK_TYPES = {
  hero: {
    label: "هیرو (سرصفحه)",
    fields: [
      f("eyebrow", "text", "برچسب بالا"),
      f("title", "text", "عنوان اصلی"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("image", "image", "تصویر پس‌زمینه"),
      f("align", "select", "چینش متن", {
        options: [
          { value: "center", label: "وسط" },
          { value: "right", label: "راست" },
          { value: "left", label: "چپ" },
        ],
      }),
    ],
  },
  richtext: {
    label: "متن",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("body", "textarea", "متن (هر خط = یک پاراگراف)"),
    ],
  },
  "image-text": {
    label: "تصویر و متن",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("body", "textarea", "متن (هر خط = یک پاراگراف)"),
      f("image", "image", "تصویر"),
      f("imageSide", "select", "سمت تصویر", {
        options: [
          { value: "right", label: "راست" },
          { value: "left", label: "چپ" },
        ],
      }),
    ],
  },
  cards: {
    label: "کارت‌ها",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("columns", "select", "تعداد ستون", {
        options: [
          { value: 2, label: "۲ ستون" },
          { value: 3, label: "۳ ستون" },
        ],
      }),
      f("items", "list", "کارت‌ها", {
        itemFields: [
          f("icon", "icon", "آیکون"),
          f("title", "text", "عنوان"),
          f("body", "textarea", "متن"),
        ],
      }),
    ],
  },
  timeline: {
    label: "خط زمانی",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("items", "list", "مراحل", {
        itemFields: [
          f("date", "text", "تاریخ / شماره"),
          f("title", "text", "عنوان"),
          f("body", "textarea", "متن"),
        ],
      }),
    ],
  },
  steps: {
    label: "گام‌ها",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("items", "list", "گام‌ها", {
        itemFields: [
          f("title", "text", "عنوان"),
          f("body", "textarea", "متن"),
          f("image", "image", "تصویر (اختیاری)"),
        ],
      }),
    ],
  },
  table: {
    label: "جدول",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("columns", "stringlist", "ستون‌ها"),
      f("rows", "grid", "ردیف‌ها", { columnsKey: "columns" }),
    ],
  },
  quote: {
    label: "نقل‌قول",
    fields: [
      f("text", "textarea", "متن نقل‌قول"),
      f("author", "text", "گوینده"),
      f("role", "text", "سمت (اختیاری)"),
    ],
  },
  "payment-methods": {
    label: "روش‌های پرداخت",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("items", "list", "روش‌ها", {
        itemFields: [
          f("icon", "icon", "آیکون"),
          f("title", "text", "عنوان"),
          f("body", "textarea", "متن"),
          f("badge", "text", "برچسب گوشه (اختیاری)"),
        ],
      }),
    ],
  },
  faq: {
    label: "پرسش‌های متداول",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("categories", "stringlist", "دسته‌بندی‌ها (اختیاری)"),
      f("items", "list", "پرسش‌ها", {
        itemFields: [
          f("category", "text", "دسته‌بندی"),
          f("question", "text", "پرسش"),
          f("answer", "textarea", "پاسخ"),
        ],
      }),
    ],
  },
  legal: {
    label: "سند حقوقی (بندها)",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("intro", "textarea", "مقدمه"),
      f("items", "list", "بندها", {
        itemFields: [
          f("title", "text", "عنوان بند"),
          f("body", "textarea", "متن بند"),
        ],
      }),
    ],
  },
  contact: {
    label: "فرم تماس",
    fields: [
      f("eyebrow", "text", "برچسب"),
      f("title", "text", "عنوان"),
      f("subtitle", "textarea", "زیرعنوان"),
      f("phone", "text", "تلفن"),
      f("email", "text", "ایمیل"),
      f("address", "text", "نشانی"),
      f("hours", "text", "ساعات پاسخ‌گویی"),
    ],
  },
};

export const BLOCK_TYPE_LIST = Object.entries(BLOCK_TYPES).map(([type, def]) => ({
  type,
  label: def.label,
}));

let idCounter = 0;
const genId = () => `b${Date.now().toString(36)}${idCounter++}`;

// مقدارِ اولیه‌ی یک آیتمِ خالی برای فیلدهای list
function emptyItem(itemFields) {
  const item = {};
  itemFields.forEach((ff) => {
    item[ff.key] = "";
  });
  return item;
}

// ساختِ بلوکِ خالیِ یک نوع هنگام افزودن
export function createEmptyBlock(type) {
  const def = BLOCK_TYPES[type];
  if (!def) return null;
  const block = { id: genId(), type };
  def.fields.forEach((field) => {
    switch (field.type) {
      case "list":
        block[field.key] = [emptyItem(field.itemFields)];
        break;
      case "stringlist":
        block[field.key] = [""];
        break;
      case "grid":
        block[field.key] = [[""]];
        break;
      case "select":
        block[field.key] = field.options?.[0]?.value ?? "";
        break;
      default:
        block[field.key] = "";
    }
  });
  return block;
}

export { genId };
