// فیلدهای برند و دسته که در خروجی‌های عمومی به مرورگر می‌رسند.
// این داده داخل HTML صفحه سریالایز می‌شود، پس هر فیلد اضافه هم حجم صفحه را بالا می‌برد
// و هم عمومی می‌شود؛ پرامپت‌های AI ادمین هرگز نباید اینجا باشند.
//
// فقط سرویس‌ها و روت‌های ویترین از این فایل استفاده می‌کنند. API‌های پنل ادمین
// (مثل /api/categories و /api/query) پرامپت را لازم دارند و نباید به اینجا وصل شوند.

// همه‌ی کلیدهای AttributeSchema به‌جز prompt. تست با اسکیمای واقعی مقایسه‌اش می‌کند.
const ATTRIBUTE_KEYS = [
  "name", "label", "description", "uiType", "required", "filterable",
  "options", "targetAudiences", "multiUnit", "units",
];
const attributeFields = (path) => ATTRIBUTE_KEYS.map((key) => `${path}.${key}`).join(" ");

export const PUBLIC_ATTRIBUTES = attributeFields("attributes");
export const PUBLIC_VARIANT_ATTRIBUTES = attributeFields("variantAttributes");

// کارت محصول و کوییک‌ویو
export const CARD_BRAND_FIELDS = "name title slug icon logo";
export const CARD_CATEGORY_FIELDS =
  "name title slug variantAttributes.name variantAttributes.label variantAttributes.multiUnit variantAttributes.units";

// صفحه‌ی لیست و هر جا که قرارداد POPULATES را به کار می‌برد
export const LISTING_CATEGORY_FIELDS = `name title slug ${PUBLIC_VARIANT_ATTRIBUTES}`;

// همه‌چیز می‌ماند و فقط پرامپت‌ها حذف می‌شوند. روی هر مدل معتبر است، چون مسیرِ ناموجود نادیده گرفته می‌شود.
export const WITHOUT_AI_PROMPTS =
  "-prompts -technicalStatsPrompt -customTab.prompt -customTab.items.prompt -attributes.prompt -variantAttributes.prompt";

// صفحه‌ی محصول مقاله‌ی برند را هم نمی‌خواند.
export const PRODUCT_PAGE_BRAND_FIELDS = "-prompts -articleBlocks";
