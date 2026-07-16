// Custom next/image loader — جایگزینِ cloudinaryLoader.js
// تصاویر را از طریق ترنسفورم‌های URL-based ImageKit بهینه می‌کند
// (f-auto/q-auto + ریسایز بر اساس سایز دستگاه)، دقیقاً هم‌ارزِ منطقِ قبلیِ Cloudinary.
//
// نکته: این تابع علاوه‌بر آدرس‌های تازه‌آپلودشده روی ImageKit (که با
// NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT شروع می‌شوند)، همچنین آدرس‌های قدیمیِ
// Cloudinary را هم پشتیبانی می‌کند — تا وقتی مهاجرتِ کاملِ دیتابیس انجام نشده،
// عکس‌های قدیمی همچنان (بدون ترنسفورم اضافه، مستقیم) نمایش داده شوند و ۴۰۴ نشوند.

const IMAGEKIT_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";

export default function imagekitLoader({ src, width, quality }) {
  if (typeof src !== "string") return src;

  // SVG را ترنسفورم نکن (وکتور است و نیازی به ریسایز/تبدیل فرمت ندارد).
  // نکته‌ی مهم: ImageKit به‌صورتِ پیش‌فرض (در سطحِ تنظیماتِ حساب) SVG ها را
  // خودکار به فرمتِ رستر (PNG/JPEG) تبدیل می‌کند، حتی بدونِ هیچ پارامترِ
  // ترنسفورمی در URL — این باعثِ تار/کوچک‌شدنِ نمایشِ لوگوها/آیکون‌ها می‌شود.
  // با tr=orig-true این تبدیلِ خودکار را صریحاً غیرفعال می‌کنیم.
  if (/\.svg(\?|$)/i.test(src)) {
    if (IMAGEKIT_ENDPOINT && src.startsWith(IMAGEKIT_ENDPOINT)) {
      const sep = src.includes("?") ? "&" : "?";
      return `${src}${sep}tr=orig-true`;
    }
    return src;
  }

  const q = quality || "auto";

  // ── حالت ۱: آدرس روی ImageKit (بعد از مهاجرت) ──
  if (IMAGEKIT_ENDPOINT && src.startsWith(IMAGEKIT_ENDPOINT)) {
    const params = [`w-${width}`, `q-${q === "auto" ? 80 : q}`, "f-auto"].join(",");
    // ImageKit پارامترهای ترنسفورم را به‌صورت tr:param1,param2 در URL می‌پذیرد
    const hasQuery = src.includes("?");
    const sep = hasQuery ? "&" : "?";
    return `${src}${sep}tr=${params}`;
  }

  // ── حالت ۲: آدرس قدیمیِ Cloudinary (قبل یا حینِ مهاجرت) ──
  if (src.includes("res.cloudinary.com")) {
    const marker = "/upload/";
    const idx = src.indexOf(marker);
    if (idx === -1) return src;

    const params = ["f_auto", "c_limit", `w_${width}`, `q_${q}`].join(",");
    const before = src.slice(0, idx + marker.length);
    const after = src.slice(idx + marker.length);
    return `${before}${params}/${after}`;
  }

  // آدرس‌های دیگر (لوکال یا هاست‌های ناشناخته) دست‌نخورده بمانند
  return src;
}