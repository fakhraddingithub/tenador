import mongoose from "mongoose";

const string = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

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

const entitySlider = (key) => (data, errors, field) => ({
  title: string(data.title, 300),
  [key]: idList(data[key], errors, `${field}.${key}`),
});

const validators = {
  heading: (data) => ({ text: string(data.text, 500), level: ["h2", "h3", "h4"].includes(data.level) ? data.level : "h2" }),
  paragraph: (data) => ({ text: string(data.text, 50000) }),
  image: (data, errors, field) => ({ url: url(data.url, errors, `${field}.url`, { media: true }), alt: string(data.alt, 300), caption: string(data.caption, 500), width: Number.isInteger(data.width) && data.width > 0 ? data.width : undefined, height: Number.isInteger(data.height) && data.height > 0 ? data.height : undefined }),
  gallery: (data, errors, field) => ({ images: gallery(data.images, errors, `${field}.images`) }),
  video: (data, errors, field) => ({ url: url(data.url, errors, `${field}.url`, { media: true }), title: string(data.title, 300) }),
  quote: (data) => ({ text: string(data.text, 5000), author: string(data.author, 300) }),
  divider: () => ({}),
  button: (data, errors, field) => ({ label: string(data.label, 160), href: url(data.href, errors, `${field}.href`), style: ["primary", "outline", "secondary"].includes(data.style) ? data.style : "primary" }),
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

