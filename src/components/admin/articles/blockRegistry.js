import {
  FiAlignRight, FiBarChart2, FiBox, FiColumns, FiGrid, FiImage, FiLink, FiList,
  FiMail, FiMessageSquare, FiMinus, FiPlay, FiShoppingBag, FiStar, FiTable,
  FiTag, FiType, FiZap,
} from "react-icons/fi";
import { ARTICLE_BLOCK_TYPES } from "@/lib/articleBlockTypes";

const text = (key, label, kind = "text", extra = {}) => ({ key, label, kind, ...extra });
const entity = (key, label, entityType, multiple = true) => ({ key, label, kind: multiple ? "entities" : "entity", entityType });

export const ARTICLE_BLOCKS = {
  heading: { label: "تیتر", group: "محتوا", icon: FiType, defaults: { text: "", level: "h2" }, fields: [text("text", "متن تیتر"), text("level", "سطح تیتر", "select", { options: ["h2", "h3", "h4"] })] },
  paragraph: { label: "پاراگراف", group: "محتوا", icon: FiAlignRight, defaults: { text: "" }, fields: [text("text", "متن پاراگراف", "textarea")] },
  image: { label: "تصویر", group: "رسانه", icon: FiImage, defaults: { url: "", alt: "", caption: "" }, fields: [text("url", "تصویر", "image"), text("alt", "متن جایگزین"), text("caption", "زیرنویس")] },
  gallery: { label: "گالری", group: "رسانه", icon: FiGrid, defaults: { images: [] }, fields: [text("images", "تصاویر", "gallery")] },
  video: { label: "ویدئو", group: "رسانه", icon: FiPlay, defaults: { url: "", title: "" }, fields: [text("url", "آدرس ویدئو", "url"), text("title", "عنوان ویدئو")] },
  quote: { label: "نقل‌قول", group: "محتوا", icon: FiMessageSquare, defaults: { text: "", author: "" }, fields: [text("text", "متن نقل‌قول", "textarea"), text("author", "نام گوینده")] },
  divider: { label: "جداکننده", group: "چیدمان", icon: FiMinus, defaults: {}, fields: [] },
  button: { label: "دکمه", group: "محتوا", icon: FiLink, defaults: { label: "مشاهده", href: "", style: "primary" }, fields: [text("label", "متن دکمه"), text("href", "پیوند", "url"), text("style", "نوع", "select", { options: ["primary", "outline", "secondary"] })] },
  callout: { label: "نکته برجسته", group: "محتوا", icon: FiZap, defaults: { title: "", text: "", tone: "info" }, fields: [text("title", "عنوان"), text("text", "متن", "textarea"), text("tone", "نوع", "select", { options: ["info", "success", "warning", "danger"] })] },
  table: { label: "جدول", group: "داده", icon: FiTable, defaults: { headers: ["ستون ۱", "ستون ۲"], rows: [["", ""]] }, fields: [text("table", "داده‌های جدول", "table")] },
  faq: { label: "سوالات متداول", group: "داده", icon: FiList, defaults: { items: [{ question: "", answer: "" }] }, fields: [text("items", "پرسش‌ها", "faq")] },
  productCard: { label: "کارت محصول", group: "فروشگاه", icon: FiBox, defaults: { product: null }, fields: [entity("product", "محصول", "product", false)] },
  productSlider: { label: "اسلایدر محصول", group: "فروشگاه", icon: FiColumns, defaults: { title: "", products: [] }, fields: [text("title", "عنوان"), entity("products", "محصولات", "product")] },
  collectionSlider: { label: "اسلایدر کالکشن", group: "فروشگاه", icon: FiColumns, defaults: { title: "", collections: [] }, fields: [text("title", "عنوان"), entity("collections", "کالکشن‌ها", "collection")] },
  brandSlider: { label: "اسلایدر برند", group: "فروشگاه", icon: FiTag, defaults: { title: "", brands: [] }, fields: [text("title", "عنوان"), entity("brands", "برندها", "brand")] },
  categorySlider: { label: "اسلایدر دسته‌بندی", group: "فروشگاه", icon: FiGrid, defaults: { title: "", categories: [] }, fields: [text("title", "عنوان"), entity("categories", "دسته‌بندی‌ها", "category")] },
  sportSlider: { label: "اسلایدر ورزش", group: "فروشگاه", icon: FiBarChart2, defaults: { title: "", sports: [] }, fields: [text("title", "عنوان"), entity("sports", "ورزش‌ها", "sport")] },
  latestProducts: { label: "جدیدترین محصولات", group: "پویا", icon: FiShoppingBag, defaults: { title: "جدیدترین محصولات", limit: 12, sports: [], categories: [] }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number"), entity("sports", "محدود به ورزش", "sport"), entity("categories", "محدود به دسته", "category")] },
  bestSellers: { label: "پرفروش‌ترین‌ها", group: "پویا", icon: FiStar, defaults: { title: "پرفروش‌ترین‌ها", limit: 12, categories: [] }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number"), entity("categories", "محدود به دسته", "category")] },
  amazingOffers: { label: "پیشنهادهای شگفت‌انگیز", group: "پویا", icon: FiZap, defaults: { title: "پیشنهادهای شگفت‌انگیز", limit: 12 }, fields: [text("title", "عنوان"), text("limit", "تعداد", "number")] },
  usedProducts: { label: "محصولات دست دوم", group: "فروشگاه", icon: FiShoppingBag, defaults: { title: "محصولات دست دوم", products: [] }, fields: [text("title", "عنوان"), entity("products", "آگهی‌ها", "usedProduct")] },
  relatedArticles: { label: "مقالات مرتبط", group: "محتوا", icon: FiList, defaults: { title: "مقالات مرتبط", articles: [] }, fields: [text("title", "عنوان"), entity("articles", "مقالات", "article")] },
  newsletterCta: { label: "عضویت خبرنامه", group: "بازاریابی", icon: FiMail, defaults: { title: "", description: "", buttonLabel: "عضویت" }, fields: [text("title", "عنوان"), text("description", "توضیح", "textarea"), text("buttonLabel", "متن دکمه")] },
  customHtml: { label: "HTML سفارشی", group: "پیشرفته", icon: FiBox, defaults: { html: "" }, fields: [text("html", "کد HTML", "html")] },
};

const missingDefinitions = ARTICLE_BLOCK_TYPES.filter((type) => !ARTICLE_BLOCKS[type]);
if (missingDefinitions.length) throw new Error(`Missing article block definitions: ${missingDefinitions.join(", ")}`);

export const BLOCK_GROUPS = [...new Set(Object.values(ARTICLE_BLOCKS).map((block) => block.group))];

export function createArticleBlock(type) {
  const definition = ARTICLE_BLOCKS[type];
  if (!definition) throw new Error(`Unknown article block type: ${type}`);
  return { id: crypto.randomUUID(), type, version: 1, data: structuredClone(definition.defaults) };
}
