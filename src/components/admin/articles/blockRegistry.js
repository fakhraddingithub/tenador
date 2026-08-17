import {
  FiAlignRight, FiBarChart2, FiBox, FiColumns, FiGrid, FiImage, FiLink, FiList,
  FiMail, FiMessageSquare, FiMinus, FiPlay, FiShoppingBag, FiStar, FiTable,
  FiTag, FiType, FiZap,
} from "react-icons/fi";
import { ARTICLE_BLOCK_TYPES } from "@/lib/articleBlockTypes";

const text = (key, label, kind = "text", extra = {}) => ({ key, label, kind, ...extra });
const entity = (key, label, entityType, multiple = true) => ({ key, label, kind: multiple ? "entities" : "entity", entityType });

// کنترل‌های استایلِ هر بلوک. فقط کلیدهایی که برای آن بلوک معنا دارند نشان داده
// می‌شوند — «رنگ دکمه» روی پاراگراف چیزی جز سردرگمی نیست. همه‌ی بلوک‌ها فاصله
// دارند؛ بقیه‌ی کلیدها انتخابی‌اند.
const SPACING_ONLY = ["spacing"];
const TEXTY = ["spacing", "textColor", "background"];
const TITLED = ["spacing", "textColor"];

export const BLOCK_STYLE_LABELS = {
  spacing: "فاصله بالا و پایین",
  textColor: "رنگ متن",
  background: "رنگ پس‌زمینه",
  accent: "رنگ شاخص",
  tableVariant: "نوع جدول",
};

// توضیحِ معنیِ «رنگ شاخص» برای هر بلوک، چون در هر کدام جای متفاوتی می‌نشیند.
export const BLOCK_ACCENT_HINTS = {
  button: "رنگ پس‌زمینه دکمه",
  table: "رنگ سربرگ جدول",
  quote: "رنگ خط کناری",
  callout: "رنگ حاشیه و آیکون",
  divider: "رنگ خط",
  faq: "رنگ حاشیه",
  newsletterCta: "رنگ دکمه",
};

export const BLOCK_SPACING_LABELS = { none: "بدون فاصله", sm: "کم", md: "پیش‌فرض", lg: "زیاد" };
export const BLOCK_TABLE_VARIANT_LABELS = { default: "پیش‌فرض", striped: "راه‌راه", bordered: "خط‌دار", plain: "ساده" };

export const ARTICLE_BLOCKS = {
  heading: { label: "تیتر", group: "محتوا", icon: FiType, defaults: { text: "", level: "h2" }, fields: [text("text", "متن تیتر"), text("level", "سطح تیتر", "select", { options: ["h2", "h3", "h4"] })], styleKeys: TEXTY },
  paragraph: { label: "پاراگراف", group: "محتوا", icon: FiAlignRight, defaults: { text: "" }, fields: [text("text", "متن پاراگراف", "textarea")], styleKeys: TEXTY },
  image: { label: "تصویر", group: "رسانه", icon: FiImage, defaults: { url: "", alt: "", caption: "" }, fields: [text("url", "تصویر", "image"), text("alt", "متن جایگزین"), text("caption", "زیرنویس")], styleKeys: SPACING_ONLY },
  gallery: { label: "گالری", group: "رسانه", icon: FiGrid, defaults: { images: [] }, fields: [text("images", "تصاویر", "gallery")], styleKeys: SPACING_ONLY },
  video: { label: "ویدئو", group: "رسانه", icon: FiPlay, defaults: { url: "", title: "" }, fields: [text("url", "آدرس ویدئو", "url"), text("title", "عنوان ویدئو")], styleKeys: SPACING_ONLY },
  quote: { label: "نقل‌قول", group: "محتوا", icon: FiMessageSquare, defaults: { text: "", author: "" }, fields: [text("text", "متن نقل‌قول", "textarea"), text("author", "نام گوینده")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  divider: { label: "جداکننده", group: "چیدمان", icon: FiMinus, defaults: {}, fields: [], styleKeys: ["spacing", "accent"] },
  button: { label: "دکمه", group: "محتوا", icon: FiLink, defaults: { label: "مشاهده", href: "", style: "primary" }, fields: [text("label", "متن دکمه"), text("href", "پیوند", "url"), text("style", "نوع", "select", { options: ["primary", "outline", "secondary"] })], styleKeys: ["spacing", "textColor", "accent"] },
  callout: { label: "نکته برجسته", group: "محتوا", icon: FiZap, defaults: { title: "", text: "", tone: "info" }, fields: [text("title", "عنوان"), text("text", "متن", "textarea"), text("tone", "نوع", "select", { options: ["info", "success", "warning", "danger"] })], styleKeys: ["spacing", "textColor", "background", "accent"] },
  table: { label: "جدول", group: "داده", icon: FiTable, defaults: { headers: ["ستون ۱", "ستون ۲"], rows: [["", ""]] }, fields: [text("table", "داده‌های جدول", "table")], styleKeys: ["spacing", "textColor", "accent", "tableVariant"] },
  faq: { label: "سوالات متداول", group: "داده", icon: FiList, defaults: { items: [{ question: "", answer: "" }] }, fields: [text("items", "پرسش‌ها", "faq")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  productCard: { label: "کارت محصول", group: "فروشگاه", icon: FiBox, defaults: { product: null }, fields: [entity("product", "محصول", "product", false)], styleKeys: TITLED },
  productSlider: { label: "اسلایدر محصول", group: "فروشگاه", icon: FiColumns, defaults: { title: "", products: [] }, fields: [text("title", "عنوان"), entity("products", "محصولات", "product")], styleKeys: TITLED },
  collectionSlider: { label: "اسلایدر کالکشن", group: "فروشگاه", icon: FiColumns, defaults: { title: "", collections: [] }, fields: [text("title", "عنوان"), entity("collections", "کالکشن‌ها", "collection")], styleKeys: TITLED },
  brandSlider: { label: "اسلایدر برند", group: "فروشگاه", icon: FiTag, defaults: { title: "", brands: [] }, fields: [text("title", "عنوان"), entity("brands", "برندها", "brand")], styleKeys: TITLED },
  categorySlider: { label: "اسلایدر دسته‌بندی", group: "فروشگاه", icon: FiGrid, defaults: { title: "", categories: [] }, fields: [text("title", "عنوان"), entity("categories", "دسته‌بندی‌ها", "category")], styleKeys: TITLED },
  sportSlider: { label: "اسلایدر ورزش", group: "فروشگاه", icon: FiBarChart2, defaults: { title: "", sports: [] }, fields: [text("title", "عنوان"), entity("sports", "ورزش‌ها", "sport")], styleKeys: TITLED },
  latestProducts: { label: "جدیدترین محصولات", group: "پویا", icon: FiShoppingBag, defaults: { title: "جدیدترین محصولات", limit: 12, sports: [], categories: [] }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number"), entity("sports", "محدود به ورزش", "sport"), entity("categories", "محدود به دسته", "category")], styleKeys: TITLED },
  bestSellers: { label: "پرفروش‌ترین‌ها", group: "پویا", icon: FiStar, defaults: { title: "پرفروش‌ترین‌ها", limit: 12, categories: [] }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number"), entity("categories", "محدود به دسته", "category")], styleKeys: TITLED },
  amazingOffers: { label: "پیشنهادهای شگفت‌انگیز", group: "پویا", icon: FiZap, defaults: { title: "پیشنهادهای شگفت‌انگیز", limit: 12 }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number")], styleKeys: TITLED },
  usedProducts: { label: "محصولات دست دوم", group: "فروشگاه", icon: FiShoppingBag, defaults: { title: "محصولات دست دوم", products: [] }, fields: [text("title", "عنوان"), entity("products", "آگهی‌ها", "usedProduct")], styleKeys: TITLED },
  relatedArticles: { label: "مقالات مرتبط", group: "محتوا", icon: FiList, defaults: { title: "مقالات مرتبط", articles: [] }, fields: [text("title", "عنوان"), entity("articles", "مقالات", "article")], styleKeys: TITLED },
  newsletterCta: { label: "عضویت خبرنامه", group: "بازاریابی", icon: FiMail, defaults: { title: "", description: "", buttonLabel: "عضویت" }, fields: [text("title", "عنوان"), text("description", "توضیح", "textarea"), text("buttonLabel", "متن دکمه")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  customHtml: { label: "HTML سفارشی", group: "پیشرفته", icon: FiBox, defaults: { html: "" }, fields: [text("html", "کد HTML", "html")], styleKeys: TEXTY },
};

const missingDefinitions = ARTICLE_BLOCK_TYPES.filter((type) => !ARTICLE_BLOCKS[type]);
if (missingDefinitions.length) throw new Error(`Missing article block definitions: ${missingDefinitions.join(", ")}`);

export const BLOCK_GROUPS = [...new Set(Object.values(ARTICLE_BLOCKS).map((block) => block.group))];

export function createArticleBlock(type) {
  const definition = ARTICLE_BLOCKS[type];
  if (!definition) throw new Error(`Unknown article block type: ${type}`);
  return { id: crypto.randomUUID(), type, version: 1, data: structuredClone(definition.defaults) };
}
