/**
 * templateImageSlots.js
 * 
 * هر تمپلیت اینجا تعریف می‌کنه چند تا عکس می‌خواد و هر کدوم چه نقشی دارن.
 * برای اضافه کردن تمپلیت جدید فقط همین فایل و فایل BannerRenderer رو لازم داری.
 * 
 * هر slot:
 *   key      — کلیدی که توی banner object ذخیره میشه (مثلاً "imageUrl", "image2Url")
 *   label    — نام نمایشی برای ادمین
 *   hint     — راهنما برای ادمین
 *   required — آیا اجباری است؟
 */

export const TEMPLATE_IMAGE_SLOTS = {
  // ─── تمپلیت‌های یک عکسه ─────────────────────────────────
  flame: [
    { key: "imageUrl", label: "تصویر محصول / مدل", hint: "سمت چپ بنر نمایش داده می‌شود", required: false },
  ],
  luxury: [
    { key: "imageUrl", label: "تصویر محصول", hint: "با فریم طلایی نمایش داده می‌شود", required: false },
  ],
  geometric: [
    { key: "imageUrl", label: "تصویر محصول", hint: "داخل دایره نمایش داده می‌شود", required: false },
  ],
  neon: [
    { key: "imageUrl", label: "تصویر محصول", hint: "با افکت نئون نمایش داده می‌شود", required: false },
  ],
  organic: [
    { key: "imageUrl", label: "تصویر محصول", hint: "با شکل آرگانیک نمایش داده می‌شود", required: false },
  ],
  editorial: [
    { key: "imageUrl", label: "تصویر اصلی", hint: "ستون چپ بنر را پر می‌کند", required: false },
  ],
  brutalist: [
    { key: "imageUrl", label: "تصویر محصول", hint: "با border مشکی نمایش داده می‌شود", required: false },
  ],
  "gradient-wave": [
    { key: "imageUrl", label: "تصویر محصول", hint: "سمت چپ با افکت محو", required: false },
  ],

  // ─── تمپلیت‌های با overlay عکس ─────────────────────────
  "overlay-photo": [
    { key: "imageUrl", label: "عکس پس‌زمینه", hint: "کل بنر را پوشش می‌دهد — عکس عمودی مناسب‌تر است", required: true },
  ],
  "elegant-overlay": [
    { key: "imageUrl", label: "عکس پس‌زمینه", hint: "کل بنر را پوشش می‌دهد", required: true },
  ],

  // ─── تمپلیت‌های دو عکسه ─────────────────────────────────
  "product-showcase": [
    { key: "imageUrl",  label: "عکس پس‌زمینه", hint: "فضا / محیط / تکسچر پشت محصول", required: false },
    { key: "image2Url", label: "عکس محصول",    hint: "PNG با پس‌زمینه شفاف ایده‌آل است — روی بنر float می‌شود", required: false },
  ],

  // ─── Adventure Shoes Banner ─────────────────────────────
"adventure-shoes": [
  {
    key: "imageUrl",
    label: "عکس بک‌گراند",
    hint: "پس‌زمینه کامل بنر — ترجیحاً روشن و مینیمال",
    required: false,
  },
  {
    key: "image2Url",
    label: "عکس محصول",
    hint: "محصول اصلی (ترجیحاً PNG بدون بک‌گراند)",
    required: true,
  },
  {
    key: "image3Url",
    label: "لایه براش",
    hint: "تکسچر / براش آبی پشت متن ADVENTURE",
    required: false,
  },
],

  // ─── نمونه برای تمپلیت‌های آینده ───────────────────────
  // "split-scene": [
  //   { key: "imageUrl",  label: "عکس سمت چپ",  hint: "نصف چپ بنر", required: true },
  //   { key: "image2Url", label: "عکس سمت راست", hint: "نصف راست بنر", required: true },
  // ],
  // "triple-grid": [
  //   { key: "imageUrl",  label: "عکس بزرگ",      hint: "۵۰٪ بنر", required: true },
  //   { key: "image2Url", label: "عکس کوچک بالا", hint: "۲۵٪ بنر", required: true },
  //   { key: "image3Url", label: "عکس کوچک پایین",hint: "۲۵٪ بنر", required: true },
  // ],
};

/** برگردوندن slotها برای یه تمپلیت خاص — اگه تعریف نشده بود، یه slot پیش‌فرض */
export function getSlotsForTemplate(templateKey) {
  return TEMPLATE_IMAGE_SLOTS[templateKey] ?? [
    { key: "imageUrl", label: "تصویر بنر", hint: "", required: false },
  ];
}
