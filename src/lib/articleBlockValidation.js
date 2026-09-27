import mongoose from "mongoose";
// نسبی، نه با نامک @: این فایل مستقیم زیر node هم تست می‌شود.
import { normalizeFontSizePx, richTextValue } from "./sanitizeRichText.js";
import {
  IMAGE_CONTENT_POSITIONS, IMAGE_DISPLAY_HEIGHT, MAX_IMAGE_BLOCK_ITEMS, clampImageShade, mirrorFirstImage, normalizeImageHref,
} from "./articleImageBlock.js";
import { IMAGE_SLIDER_DELAY, IMAGE_SLIDER_HEIGHT } from "./articleBlockTypes.js";

const string = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

/** عدد را روی پله‌ی تعریف‌شده و داخلِ بازه می‌نشاند؛ نامعتبر → پیش‌فرض. */
const clampStep = (value, spec) => {
  const number = Math.round(Number(value) / spec.step) * spec.step;
  if (!Number.isFinite(number)) return spec.default;
  return Math.min(spec.max, Math.max(spec.min, number));
};

// کلیدِ html فقط وقتی ساخته می‌شود که قالب‌بندیِ واقعی وجود داشته باشد؛ در غیر
// این صورت شیءِ خالی برمی‌گردد و دادهٔ بلوک دقیقاً همان شکلِ قبلی را دارد.
const rich = (value) => {
  const html = richTextValue(value);
  return html ? { html } : {};
};

export function safeArticleUrl(value, { media = false } = {}) {
  const raw = string(value, 2000);
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    const allowed = media ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"];
    return allowed.includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

// ——— استایلِ سطحِ بلوک ————————————————————————————————————————————————
// واژگان بسته و کوچک است: فقط همین کلیدها و همین مقادیر. هر چیزِ دیگری دور
// ریخته می‌شود تا هیچ مقدارِ دلخواهِ CSS به DOM نرسد.
export const BLOCK_SPACINGS = ["none", "sm", "md", "lg"];
export const BLOCK_TABLE_VARIANTS = ["default", "striped", "bordered", "plain"];
export const BLOCK_COLOR_KEYS = ["textColor", "background", "accent"];
export const BLOCK_ALIGNS = ["left", "center", "right"];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function hexColor(value) {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  return HEX_COLOR.test(raw) ? raw.toLowerCase() : undefined;
}

/**
 * مقادیرِ پیش‌فرض ("md" و "default") عمداً حذف می‌شوند و اگر هیچ کلیدی باقی
 * نماند خروجی undefined است — یعنی «بدونِ استایل» هرگز به‌صورتِ یک شیءِ truthy
 * ذخیره نمی‌شود و بلوک دقیقاً مثل قبل رندر می‌گردد.
 */
export function sanitizeArticleBlockStyle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const style = {};
  // پیش‌فرض حالا «بدونِ فاصله» است، پس همان یکی حذف می‌شود و "md" (فاصله‌ی
  // ۳۶پیکسلیِ قدیمی، که مهاجرت روی محتوای موجود نوشته) باید ذخیره بماند.
  if (value.spacing !== "none" && BLOCK_SPACINGS.includes(value.spacing)) style.spacing = value.spacing;
  for (const key of BLOCK_COLOR_KEYS) {
    const color = hexColor(value[key]);
    if (color) style[key] = color;
  }
  if (value.tableVariant !== "default" && BLOCK_TABLE_VARIANTS.includes(value.tableVariant)) {
    style.tableVariant = value.tableVariant;
  }
  if (BLOCK_ALIGNS.includes(value.align)) style.align = value.align;

  return Object.keys(style).length ? style : undefined;
}

function url(value, errors, field, options) {
  const raw = string(value, 2000);
  const safe = safeArticleUrl(raw, options);
  if (raw && !safe) errors[field] = "URL is invalid or uses an unsupported protocol";
  return safe;
}

function id(value, errors, field) {
  if (value == null || value === "") return null;
  if (!mongoose.isValidObjectId(value)) {
    errors[field] = "Entity id is invalid";
    return null;
  }
  return String(value);
}

function idList(value, errors, field, max = 50) {
  if (!Array.isArray(value)) return [];
  const result = [...new Set(value.map(String))].slice(0, max);
  if (result.some((item) => !mongoose.isValidObjectId(item))) {
    errors[field] = "Entity list contains an invalid id";
    return result.filter((item) => mongoose.isValidObjectId(item));
  }
  if (value.length > max) errors[field] = `Entity list cannot exceed ${max} items`;
  return result;
}

function gallery(value, errors, field) {
  if (!Array.isArray(value)) return [];
  if (value.length > 50) errors[field] = "Gallery cannot exceed 50 images";
  return value.slice(0, 50).map((item, index) => {
    if (typeof item === "string") return url(item, errors, `${field}.${index}`, { media: true });
    const image = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    return {
      url: url(image.url, errors, `${field}.${index}.url`, { media: true }),
      alt: string(image.alt, 300),
      caption: string(image.caption, 500),
    };
  }).filter((item) => typeof item === "string" ? item : item.url);
}

const positiveInt = (value) => (Number.isInteger(value) && value > 0 ? value : undefined);

// بلوکِ تصویرِ بدونِ کلیدهای جدید دقیقاً همان خروجیِ قبلی را می‌دهد؛ کلیدهای
// images / displayHeight / shade / contentPosition فقط وقتی اضافه می‌شوند که
// واقعاً مقدار دارند.
function imageBlock(data, errors, field) {
  const result = { url: url(data.url, errors, `${field}.url`, { media: true }), alt: string(data.alt, 300), caption: string(data.caption, 500), width: positiveInt(data.width), height: positiveInt(data.height) };

  if (Array.isArray(data.images)) {
    if (data.images.length > MAX_IMAGE_BLOCK_ITEMS) errors[`${field}.images`] = `Image block cannot exceed ${MAX_IMAGE_BLOCK_ITEMS} images`;
    const images = data.images.slice(0, MAX_IMAGE_BLOCK_ITEMS).map((item, index) => {
      const image = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const at = `${field}.images.${index}`;
      const entry = { url: url(image.url, errors, `${at}.url`, { media: true }), alt: string(image.alt, 300) };
      if (positiveInt(image.width)) entry.width = image.width;
      if (positiveInt(image.height)) entry.height = image.height;
      const href = normalizeImageHref(image.href);
      if (href === null) errors[`${at}.href`] = `پیوندِ تصویرِ ${index + 1} نامعتبر است (مثلاً ‎/tennis/racket‎ یا ‎https://…‎)`;
      else if (href) entry.href = href;
      return entry;
    }).filter((image) => image.url);
    if (images.length) Object.assign(result, { images }, mirrorFirstImage(images));
  }

  if (data.displayHeight != null && data.displayHeight !== "") {
    const height = Math.round(Number(data.displayHeight));
    if (Number.isFinite(height)) {
      result.displayHeight = Math.min(IMAGE_DISPLAY_HEIGHT.max, Math.max(IMAGE_DISPLAY_HEIGHT.min, height));
    }
  }

  // لایه‌ی تیره و جای عمودیِ بلوک‌های روی تصویر. پیش‌فرض‌ها ذخیره نمی‌شوند، پس
  // بلوکِ تصویرِ موجود بایت‌به‌بایت همان داده‌ی قبلی را نگه می‌دارد. خودِ
  // data.blocks اینجا نیست: بلوک‌های تودرتو در sanitizeBlock بازگشتی پاک می‌شوند،
  // با همان اعتبارسنجی‌ای که بیرون دارند.
  const shade = clampImageShade(data.shade);
  if (shade) result.shade = shade;
  if (data.contentPosition !== "center" && IMAGE_CONTENT_POSITIONS.includes(data.contentPosition)) result.contentPosition = data.contentPosition;
  return result;
}

// واژگانِ بسته‌ی دکمه (هم‌نام با کنترل‌های ویرایشگر).
export const BUTTON_ALIGNS = ["right", "center", "left"];
export const BUTTON_SIZES = ["sm", "md", "lg"];
export const BUTTON_ICONS = ["none", "arrow", "external", "download"];

const entitySlider = (key) => (data, errors, field) => ({
  title: string(data.title, 300),
  [key]: idList(data[key], errors, `${field}.${key}`),
});

const validators = {
  heading: (data) => ({ text: string(data.text, 500), ...rich(data.html), level: ["h2", "h3", "h4"].includes(data.level) ? data.level : "h2" }),
  paragraph: (data) => ({ text: string(data.text, 50000), ...rich(data.html) }),
  // فقط سه متن؛ بقیه‌ی ظاهر از HomeSectionHeading می‌آید و قابلِ تنظیم نیست.
  tenadorTitle: (data) => ({ highlight: string(data.highlight, 200), title: string(data.title, 300), subtitle: string(data.subtitle, 500) }),
  // هدر: فقط تیتر و تصویر. بقیه‌ی ظاهر از SportHero می‌آید و تنظیم‌پذیر نیست،
  // پس width/height ای که کادرِ تصویر می‌فرستد هم ذخیره نمی‌شود (<img> ساده است).
  header: (data, errors, field) => ({ title: string(data.title, 300), url: url(data.url, errors, `${field}.url`, { media: true }) }),
  image: imageBlock,
  // مکث و ارتفاع؛ فرزندان در sanitizeBlock بازگشتی پاک می‌شوند. هر دو همیشه
  // ذخیره می‌شوند چون «اندازه‌ی ثابت» ویژگیِ تعریفیِ این بلوک است، نه یک افزونه.
  imageSlider: (data) => ({
    delay: clampStep(data.delay, IMAGE_SLIDER_DELAY),
    height: clampStep(data.height, IMAGE_SLIDER_HEIGHT),
  }),
  gallery: (data, errors, field) => ({ images: gallery(data.images, errors, `${field}.images`) }),
  video: (data, errors, field) => ({ url: url(data.url, errors, `${field}.url`, { media: true }), title: string(data.title, 300) }),
  quote: (data) => ({ text: string(data.text, 5000), ...rich(data.html), author: string(data.author, 300) }),
  divider: () => ({}),
  // گزینه‌های تازه همه اختیاری‌اند و مقدارِ پیش‌فرض *ذخیره نمی‌شود*، پس دکمه‌های
  // موجود دقیقاً همان داده‌ی قبلی را نگه می‌دارند.
  button: (data, errors, field) => {
    const result = { label: string(data.label, 160), href: url(data.href, errors, `${field}.href`), style: ["primary", "outline", "secondary"].includes(data.style) ? data.style : "primary" };
    if (BUTTON_ALIGNS.includes(data.align) && data.align !== "right") result.align = data.align;
    if (BUTTON_ALIGNS.includes(data.textAlign) && data.textAlign !== "center") result.textAlign = data.textAlign;
    if (BUTTON_SIZES.includes(data.size) && data.size !== "md") result.size = data.size;
    const fontSize = normalizeFontSizePx(data.fontSize);
    if (fontSize) result.fontSize = fontSize;
    if (data.fullWidth === true) result.fullWidth = true;
    if (BUTTON_ICONS.includes(data.icon) && data.icon !== "none") result.icon = data.icon;
    return result;
  },
  callout: (data) => ({ title: string(data.title, 300), text: string(data.text, 10000), tone: ["info", "success", "warning", "danger"].includes(data.tone) ? data.tone : "info" }),
  table: (data, errors, field) => {
    const headers = (Array.isArray(data.headers) ? data.headers : []).slice(0, 30).map((item) => string(item, 500));
    const rows = (Array.isArray(data.rows) ? data.rows : []).slice(0, 100).map((row) => (Array.isArray(row) ? row : []).slice(0, headers.length || 30).map((item) => string(item, 2000)));
    if ((data.headers || []).length > 30) errors[`${field}.headers`] = "Table cannot exceed 30 columns";
    if ((data.rows || []).length > 100) errors[`${field}.rows`] = "Table cannot exceed 100 rows";
    return { headers, rows };
  },
  faq: (data, errors, field) => {
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length > 50) errors[`${field}.items`] = "FAQ cannot exceed 50 items";
    return { items: items.slice(0, 50).map((item) => ({ question: string(item?.question, 500), answer: string(item?.answer, 5000) })) };
  },
  productCard: (data, errors, field) => ({ product: id(data.product, errors, `${field}.product`) }),
  productSlider: entitySlider("products"),
  collectionSlider: entitySlider("collections"),
  brandSlider: entitySlider("brands"),
  categorySlider: entitySlider("categories"),
  sportSlider: entitySlider("sports"),
  latestProducts: (data, errors, field) => ({ title: string(data.title, 300), limit: Math.min(16, Math.max(1, Number(data.limit) || 8)), sports: idList(data.sports, errors, `${field}.sports`), categories: idList(data.categories, errors, `${field}.categories`) }),
  bestSellers: (data, errors, field) => ({ title: string(data.title, 300), limit: Math.min(16, Math.max(1, Number(data.limit) || 8)), categories: idList(data.categories, errors, `${field}.categories`) }),
  amazingOffers: (data) => ({ title: string(data.title, 300), limit: Math.min(16, Math.max(1, Number(data.limit) || 8)) }),
  usedProducts: entitySlider("products"),
  relatedArticles: entitySlider("articles"),
  newsletterCta: (data) => ({ title: string(data.title, 300), description: string(data.description, 2000), buttonLabel: string(data.buttonLabel, 160) }),
  customHtml: (data) => ({ html: typeof data.html === "string" ? data.html.slice(0, 250000) : "" }),
};

export function sanitizeArticleBlockData(type, value, errors, field) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return validators[type](data, errors, field);
}

