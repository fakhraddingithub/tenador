// Custom next/image loader.
// تصاویر را به‌جای Image Optimization ورسل، از طریق ترنسفورم‌های Cloudinary بهینه می‌کند
// تا مصرف Transformations ورسل صفر شود. (f_auto/q_auto + ریسایز بر اساس سایز دستگاه)
export default function cloudinaryLoader({ src, width, quality }) {
  // فقط URLهای Cloudinary را ترنسفورم کن؛ بقیه (لوکال، هاست‌های دیگر) دست‌نخورده بمانند
  if (typeof src !== "string" || !src.includes("res.cloudinary.com")) {
    return src;
  }

  // SVG را ترنسفورم نکن (وکتور است و نیازی به ریسایز/تبدیل فرمت ندارد)
  if (/\.svg(\?|$)/i.test(src)) {
    return src;
  }

  // ساختار URL: https://res.cloudinary.com/<cloud>/image/upload/<transforms?>/v123/path
  const marker = "/upload/";
  const idx = src.indexOf(marker);
  if (idx === -1) {
    return src;
  }

  const params = [
    "f_auto", // بهترین فرمت (AVIF/WebP) بر اساس مرورگر
    "c_limit", // فقط کوچک‌کن، هیچ‌وقت بزرگ‌تر از اصل نکن
    `w_${width}`,
    `q_${quality || "auto"}`,
  ].join(",");

  const before = src.slice(0, idx + marker.length);
  const after = src.slice(idx + marker.length);

  return `${before}${params}/${after}`;
}
