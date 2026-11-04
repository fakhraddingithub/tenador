// فیلدهای برند و دسته که در خروجی‌های عمومیِ محصول به مرورگر می‌رسند.
// این داده داخل HTML صفحه سریالایز می‌شود، پس هر فیلد اضافه هم حجم صفحه را بالا می‌برد
// و هم عمومی می‌شود؛ پرامپت‌های AI ادمین هرگز نباید اینجا باشند.

// کارت محصول و کوییک‌ویو (همان قراردادِ POPULATES صفحه‌ی لیست، بدون prompt ویژگی‌ها).
export const CARD_BRAND_FIELDS = "name title slug icon logo";
export const CARD_CATEGORY_FIELDS =
  "name title slug variantAttributes.name variantAttributes.label variantAttributes.multiUnit variantAttributes.units";

// صفحه‌ی محصول: همه‌چیز می‌ماند و فقط فیلدهایی حذف می‌شوند که این صفحه هیچ‌وقت نمی‌خواند.
export const PRODUCT_PAGE_BRAND_FIELDS = "-prompts -articleBlocks";
export const PRODUCT_PAGE_CATEGORY_FIELDS =
  "-prompts -technicalStatsPrompt -customTab.prompt -customTab.items.prompt -attributes.prompt -variantAttributes.prompt";
