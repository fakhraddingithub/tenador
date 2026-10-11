import {
  FiAlignRight, FiBarChart2, FiBox, FiColumns, FiGrid, FiImage, FiLink, FiList,
  FiFeather, FiLayout, FiMail, FiMessageSquare, FiMinus, FiPlay, FiShoppingBag, FiStar, FiTable,
  FiLayers, FiTag, FiType, FiZap,
} from "react-icons/fi";
import { ARTICLE_BLOCK_TYPES, IMAGE_SLIDER_DELAY, IMAGE_SLIDER_HEIGHT } from "@/lib/articleBlockTypes";

const text = (key, label, kind = "text", extra = {}) => ({ key, label, kind, ...extra });
const entity = (key, label, entityType, multiple = true) => ({ key, label, kind: multiple ? "entities" : "entity", entityType });

// چیدمانِ فرمِ ویرایش — فقط ظاهر، بی‌اثر بر داده:
//   row: فیلدهای پشتِ‌سرِ‌همی که row یکسان دارند کنارِ هم در یک ردیف می‌نشینند
//        (و در جای تنگ زیرِ هم می‌روند). فیلدِ بی‌row ردیفِ خودش را دارد.
//   section: عنوانِ کوچکی بالای همان ردیف، برای بلوک‌هایی با تنظیماتِ زیاد.
//   advanced: فیلدِ کم‌کاربرد؛ همه‌ی advancedهای یک بلوک با هم در یک «تنظیمات بیشتر»ِ
//        بسته می‌نشینند، جای آخرینشان. فقط نمایش است: کلید و داده همان است.
// پهنای هر فیلد از نوعش می‌آید (BlockEditor → fieldWidth)، نه از اینجا.

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

export const BLOCK_SPACING_LABELS = { none: "بدون فاصله (پیش‌فرض)", sm: "کم", md: "متوسط", lg: "زیاد" };
export const BLOCK_TABLE_VARIANT_LABELS = { default: "پیش‌فرض", striped: "راه‌راه", bordered: "خط‌دار", plain: "ساده" };

export const ARTICLE_BLOCKS = {
  heading: { label: "تیتر", group: "محتوا", icon: FiType, defaults: { text: "", level: "h2" }, fields: [text("text", "متن تیتر", "rich", { singleLine: true, row: "main" }), text("level", "سطح تیتر", "select", { row: "main", options: ["h2", "h3", "h4"] })], styleKeys: TEXTY },
  tenadorTitle: {
    label: "تیتر تنادور", group: "محتوا", icon: FiFeather,
    defaults: { highlight: "", title: "", subtitle: "" },
    fields: [
      text("highlight", "متن نارنجی (ابتدای عنوان)", "text", { row: "title" }),
      text("title", "ادامه‌ی عنوان", "text", { row: "title" }),
      text("subtitle", "زیرعنوان"),
    ],
    // ظاهر عیناً همان عنوانِ بخش‌های صفحه‌ی اصلی است و تنظیم‌پذیر نیست.
    styleKeys: SPACING_ONLY,
  },
  paragraph: { label: "پاراگراف", group: "محتوا", icon: FiAlignRight, defaults: { text: "" }, fields: [text("text", "متن پاراگراف", "rich")], styleKeys: TEXTY },
  // تصویر یک *ظرف* است: تصویرِ پس‌زمینه، یک لایه‌ی تیره، و بلوک‌های واقعی روی
  // آن‌ها (همان ویرایشگر و همان تنظیماتِ همیشگیِ هر بلوک).
  image: { label: "تصویر", group: "رسانه", icon: FiImage, defaults: { url: "", alt: "", caption: "" }, fields: [text("images", "تصاویر", "imageList"), text("displayHeight", "ارتفاع نمایش", "imageHeight", { advanced: true }), text("caption", "زیرنویس"), text("shade", "لایه‌ی رنگ و جای محتوا", "imageShade", { advanced: true }), text("blocks", "بلوک‌های روی تصویر", "mergedBlocks", { addLabel: "بلوک روی تصویر", addGroup: "media" })], styleKeys: SPACING_ONLY },
  // اسلایدرِ تصویر: ظرفی که فقط بلوکِ *تصویر* می‌پذیرد، با اندازه‌ی ثابت.
  imageSlider: { label: "اسلایدر تصویر", group: "رسانه", icon: FiColumns, defaults: { blocks: [], delay: IMAGE_SLIDER_DELAY.default, height: IMAGE_SLIDER_HEIGHT.default }, fields: [text("slider", "اندازه و زمان‌بندی", "imageSliderSettings", { section: "تنظیمات کلِ اسلایدر" }), text("blocks", "اسلایدها — هر اسلاید یک بلوکِ تصویر با بلوک‌های روی خودش", "imageSliderBlocks")], styleKeys: SPACING_ONLY },
  gallery: { label: "گالری", group: "رسانه", icon: FiGrid, defaults: { images: [] }, fields: [text("images", "تصاویر", "gallery")], styleKeys: SPACING_ONLY },
  video: { label: "ویدئو", group: "رسانه", icon: FiPlay, defaults: { url: "", title: "" }, fields: [text("url", "آدرس ویدئو", "url", { row: "video" }), text("title", "عنوان ویدئو", "text", { row: "video" })], styleKeys: SPACING_ONLY },
  quote: { label: "نقل‌قول", group: "محتوا", icon: FiMessageSquare, defaults: { text: "", author: "" }, fields: [text("text", "متن نقل‌قول", "rich"), text("author", "نام گوینده")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  // همان هدرِ صفحه‌ی ورزش. ظاهرش از SportHero می‌آید، پس فقط دو چیز تنظیم‌پذیر است.
  // once: جایش بالاترین نقطه‌ی صفحه است، پس دو تا معنا ندارد — کتابخانه پس از
  // افزودن پنهانش می‌کند و پاک‌سازیِ سرور هم همین را نگه می‌دارد.
  header: { label: "هدر", group: "چیدمان", icon: FiLayout, once: true, defaults: { title: "", url: "" }, fields: [text("title", "متن تیتر (H1)"), text("url", "تصویر پس‌زمینه", "image")], styleKeys: SPACING_ONLY },
  divider: { label: "جداکننده", group: "چیدمان", icon: FiMinus, defaults: {}, fields: [], styleKeys: ["spacing", "accent"] },
  button: {
    label: "دکمه", group: "محتوا", icon: FiLink,
    defaults: { label: "مشاهده", href: "", style: "primary" },
    fields: [
      text("label", "متن دکمه", "text", { row: "content" }),
      text("href", "پیوند", "url", { row: "content" }),
      text("style", "نوع", "select", { row: "look", options: ["primary", "outline", "secondary"], labels: { primary: "اصلی", outline: "خطی", secondary: "ثانویه" } }),
      text("size", "اندازه دکمه", "select", { row: "look", options: ["sm", "md", "lg"], labels: { sm: "کوچک", md: "متوسط", lg: "بزرگ" } }),
      // آیکن، اندازه‌ی متن و جایگیری کم‌کاربردترند: زیرِ «تنظیمات بیشتر».
      text("icon", "آیکن", "select", { row: "extra", advanced: true, options: ["none", "arrow", "external", "download"], labels: { none: "بدون آیکن", arrow: "فلش", external: "پیوند بیرونی", download: "دانلود" } }),
      text("fontSize", "اندازه متن دکمه", "fontSize", { row: "extra", advanced: true }),
      text("align", "جای دکمه در صفحه", "select", { row: "place", section: "جایگیری", advanced: true, options: ["right", "center", "left"], labels: { right: "راست", center: "وسط", left: "چپ" } }),
      text("fullWidth", "دکمه تمام‌عرض", "checkbox", { row: "place", advanced: true }),
      text("textAlign", "چینش متن داخل دکمه (وقتی تمام‌عرض است)", "select", { row: "place", advanced: true, options: ["right", "center", "left"], labels: { right: "راست", center: "وسط", left: "چپ" } }),
    ],
    styleKeys: ["spacing", "textColor", "accent"],
  },
  callout: { label: "نکته برجسته", group: "محتوا", icon: FiZap, defaults: { title: "", text: "", tone: "info" }, fields: [text("title", "عنوان", "text", { row: "head" }), text("tone", "نوع", "select", { row: "head", options: ["info", "success", "warning", "danger"], labels: { info: "اطلاعات", success: "موفقیت", warning: "هشدار", danger: "خطر" } }), text("text", "متن", "rich")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  table: { label: "جدول", group: "داده", icon: FiTable, defaults: { headers: ["ستون ۱", "ستون ۲"], rows: [["", ""]] }, fields: [text("table", "داده‌های جدول", "table")], styleKeys: ["spacing", "textColor", "accent", "tableVariant"] },
  faq: { label: "سوالات متداول", group: "داده", icon: FiList, defaults: { items: [{ question: "", answer: "" }] }, fields: [text("items", "پرسش‌ها", "faq")], styleKeys: ["spacing", "textColor", "background", "accent"] },
  productCard: { label: "کارت محصول", group: "فروشگاه", icon: FiBox, defaults: { product: null }, fields: [entity("product", "محصول", "product", false)], styleKeys: TITLED },
  productSlider: { label: "اسلایدر محصول", group: "فروشگاه", icon: FiColumns, defaults: { title: "", products: [] }, fields: [text("title", "عنوان"), entity("products", "محصولات", "product")], styleKeys: TITLED },
  collectionSlider: { label: "اسلایدر کالکشن", group: "فروشگاه", icon: FiColumns, defaults: { title: "", collections: [] }, fields: [text("title", "عنوان"), entity("collections", "کالکشن‌ها", "collection")], styleKeys: TITLED },
  brandSlider: { label: "اسلایدر برند", group: "فروشگاه", icon: FiTag, defaults: { title: "", brands: [] }, fields: [text("title", "عنوان"), entity("brands", "برندها", "brand")], styleKeys: TITLED },
  categorySlider: { label: "اسلایدر دسته‌بندی", group: "فروشگاه", icon: FiGrid, defaults: { title: "", categories: [] }, fields: [text("title", "عنوان"), entity("categories", "دسته‌بندی‌ها", "category")], styleKeys: TITLED },
  sportSlider: { label: "اسلایدر ورزش", group: "فروشگاه", icon: FiBarChart2, defaults: { title: "", sports: [] }, fields: [text("title", "عنوان"), entity("sports", "ورزش‌ها", "sport")], styleKeys: TITLED },
  latestProducts: { label: "جدیدترین محصولات", group: "پویا", icon: FiShoppingBag, defaults: { title: "جدیدترین محصولات", limit: 12, sports: [], categories: [] }, fields: [text("title", "عنوان", "text", { row: "head" }), text("limit", "تعداد", "number", { row: "head" }), entity("sports", "محدود به ورزش", "sport"), entity("categories", "محدود به دسته", "category")], styleKeys: TITLED },
  bestSellers: { label: "پرفروش‌ترین‌ها", group: "پویا", icon: FiStar, defaults: { title: "پرفروش‌ترین‌ها", limit: 12, categories: [] }, fields: [text("title", "عنوان", "text", { row: "head" }), text("limit", "تعداد", "number", { row: "head" }), entity("categories", "محدود به دسته", "category")], styleKeys: TITLED },
  amazingOffers: { label: "پیشنهادهای شگفت‌انگیز", group: "پویا", icon: FiZap, defaults: { title: "پیشنهادهای شگفت‌انگیز", limit: 12 }, fields: [text("title", "عنوان", "text", { row: "head" }), text("limit", "تعداد", "number", { row: "head" })], styleKeys: TITLED },
  usedProducts: { label: "محصولات دست دوم", group: "فروشگاه", icon: FiShoppingBag, defaults: { title: "محصولات دست دوم", products: [] }, fields: [text("title", "عنوان"), entity("products", "آگهی‌ها", "usedProduct")], styleKeys: TITLED },
  relatedArticles: { label: "مقالات مرتبط", group: "محتوا", icon: FiList, defaults: { title: "مقالات مرتبط", articles: [] }, fields: [text("title", "عنوان"), entity("articles", "مقالات", "article")], styleKeys: TITLED },
  newsletterCta: { label: "عضویت خبرنامه", group: "بازاریابی", icon: FiMail, defaults: { title: "", description: "", buttonLabel: "عضویت" }, fields: [text("title", "عنوان", "text", { row: "head" }), text("buttonLabel", "متن دکمه", "text", { row: "head" }), text("description", "توضیح", "rich", { htmlKey: "descriptionHtml", align: false })], styleKeys: ["spacing", "textColor", "background", "accent"] },
  customHtml: { label: "HTML سفارشی", group: "پیشرفته", icon: FiBox, defaults: { html: "" }, fields: [text("html", "کد HTML", "html")], styleKeys: TEXTY },
  // فقط با «ادغام» ساخته می‌شود (hidden: در کتابخانه‌ی بلوک نیست). فرزندان عیناً در data.blocks می‌مانند.
  merged: { label: "بلوک ادغام‌شده", group: "چیدمان", icon: FiLayers, hidden: true, defaults: { blocks: [] }, fields: [text("blocks", "بلوک‌های این ردیف — عرضِ هر بلوک (از «ظاهر و چیدمان» خودش) سهمِ آن در ردیف است؛ در موبایل ردیف افقی اسکرول می‌شود", "mergedBlocks", { addLabel: "افزودن بلوک به ترکیب" })], styleKeys: SPACING_ONLY },
};

const missingDefinitions = ARTICLE_BLOCK_TYPES.filter((type) => !ARTICLE_BLOCKS[type]);
if (missingDefinitions.length) throw new Error(`Missing article block definitions: ${missingDefinitions.join(", ")}`);

export const BLOCK_GROUPS = [...new Set(Object.values(ARTICLE_BLOCKS).map((block) => block.group))];

// نامِ لاتینِ هر گروه، فقط برای رنگ‌بندیِ کارتِ بلوک در ویرایشگر (data-block-group؛
// رنگ‌ها در admin-theme.css). گروه همان دسته‌بندیِ کتابخانه‌ی بلوک است، پس رنگ با
// همان چیزی که ادمین هنگامِ افزودن دیده یکی است — نه ۲۵ رنگِ جدا که فهرست را شلوغ کند.
export const BLOCK_GROUP_SLUGS = {
  "محتوا": "content",
  "رسانه": "media",
  "چیدمان": "layout",
  "داده": "data",
  "فروشگاه": "shop",
  "پویا": "dynamic",
  "بازاریابی": "marketing",
  "پیشرفته": "advanced",
};

// گروهِ تازه بدونِ رنگ، خاموش از قلم می‌افتد؛ همان‌طور که تعریفِ جاافتاده‌ی بلوک می‌افتاد.
const missingGroupSlugs = BLOCK_GROUPS.filter((group) => !BLOCK_GROUP_SLUGS[group]);
if (missingGroupSlugs.length) throw new Error(`Missing block group slugs: ${missingGroupSlugs.join(", ")}`);

export function createArticleBlock(type) {
  const definition = ARTICLE_BLOCKS[type];
  if (!definition) throw new Error(`Unknown article block type: ${type}`);
  return { id: crypto.randomUUID(), type, version: 1, data: structuredClone(definition.defaults) };
}
