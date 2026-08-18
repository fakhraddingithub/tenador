import sanitizeHtml from "sanitize-html";

/**
 * پاک‌سازیِ متنِ غنیِ بلوک‌های متنی (تیتر، پاراگراف، نقل‌قول).
 *
 * عمداً از sanitizeArticleHtml جداست: آن یکی برای بلوکِ «HTML سفارشی» است و
 * واژگانِ بازتری دارد. اینجا فقط قالب‌بندیِ درون‌خطی اجازه دارد، پس مرزِ امنیتیِ
 * آن بلوک با افزودنِ این قابلیت گشاد نمی‌شود.
 */

// اندازه‌ها نسبی‌اند (em) تا در تیتر و پاراگراف هر دو معنا بدهند؛ مقادیرِ مطلق
// در تیترِ بزرگ نتیجه‌ی عجیبی می‌دادند.
export const RICH_TEXT_FONT_SIZES = ["0.8em", "1em", "1.25em", "1.5em", "2em"];

const FONT_SIZE_PATTERN = new RegExp(`^(?:${RICH_TEXT_FONT_SIZES.map((size) => size.replace(".", "\\.")).join("|")})$`);
const STYLEABLE = ["span", "b", "strong", "i", "em", "u", "s"];
const MAX_INPUT = 100000;

const OPTIONS = {
  allowedTags: ["b", "strong", "i", "em", "u", "s", "a", "span", "br"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    ...Object.fromEntries(STYLEABLE.map((tag) => [tag, ["style"]])),
  },
  allowedStyles: {
    "*": {
      // execCommand در مرورگرها rgb() می‌دهد و انتخابگرِ رنگ هگز؛ هر دو پذیرفته
      // می‌شوند، ولی هیچ شکلِ دیگری (نام، var، url، expression) نه.
      color: [/^#[0-9a-fA-F]{6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      "font-size": [FONT_SIZE_PATTERN],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    // contentEditable برای هر خطِ تازه یک div (یا p) می‌سازد. تبدیلشان به br
    // هم شکستِ خط را نگه می‌دارد و هم از تودرتوییِ نامعتبرِ block داخلِ <p>
    // در رندرِ عمومی جلوگیری می‌کند.
    div: "br",
    p: "br",
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}) },
    }),
  },
};

const EDGE_BREAKS = /^(?:\s|<br\s*\/?>)+|(?:\s|<br\s*\/?>)+$/g;

export function sanitizeRichText(value) {
  if (typeof value !== "string" || !value) return "";
  return sanitizeHtml(value.slice(0, MAX_INPUT), OPTIONS).replace(EDGE_BREAKS, "");
}

// «قالب‌بندیِ واقعی» یعنی یک تگِ معنادار یا یک spanِ استایل‌دار. spanِ خالی
// (که استایلش رد شده) و br به‌تنهایی به حساب نمی‌آیند.
const MEANINGFUL = /<(?:b|strong|i|em|u|s|a)(?:\s|>)|<span\s+style=/i;

/**
 * مقداری که باید در data.html ذخیره شود — یا رشته‌ی خالی، اگر متن هیچ
 * قالب‌بندی‌ای ندارد. رشته‌ی خالی یعنی کلیدِ html اصلاً نوشته نمی‌شود و بلوک
 * دقیقاً از همان مسیرِ رندرِ متنِ ساده‌ی قبلی عبور می‌کند.
 */
export function richTextValue(value) {
  const html = sanitizeRichText(value);
  return MEANINGFUL.test(html) ? html : "";
}
