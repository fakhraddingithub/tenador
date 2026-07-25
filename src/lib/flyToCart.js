/**
 * src/lib/flyToCart.js
 *
 * انیمیشنِ «پروازِ تصویرِ محصول به سبد خرید».
 * قبلاً فقط داخل ProductInfo.jsx بود؛ حالا کوییک‌ویو هم از همین استفاده می‌کند تا
 * رفتارِ افزودن به سبد در هر دو جا یکسان باشد.
 *
 * فلایِر روی <body> با z-index بالا سوار می‌شود، پس روی مودالِ کوییک‌ویو هم دیده می‌شود.
 * اگر آیکنِ سبد یا مبدأ پیدا نشود بی‌سروصدا کاری نمی‌کند (بدون خطا).
 *
 *   flyToCart(imageSrc, fromElement)
 */
export function flyToCart(imageSrc, fromElement) {
  if (typeof document === "undefined") return;

  const cartIcon = document.getElementById("cart-nav-icon");
  if (!cartIcon || !fromElement || !imageSrc) return;

  const btnRect = fromElement.getBoundingClientRect();
  const cartRect = cartIcon.getBoundingClientRect();

  // ایجاد المان تصویر برای پرواز
  const flyer = document.createElement("img");
  flyer.src = imageSrc;

  // استایل‌های تصویر متحرک
  Object.assign(flyer.style, {
    position: "fixed",
    top: `${btnRect.top}px`,
    left: `${btnRect.left + btnRect.width / 2 - 25}px`, // مرکز کردن نسبت به دکمه
    width: "60px",
    height: "60px",
    objectFit: "cover",
    borderRadius: "12px", // کمی گرد برای زیبایی
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    zIndex: "9999",
    pointerEvents: "none",
    transition: "all 0.9s cubic-bezier(0.42, 0, 0.58, 1)", // حرکت نرم شتاب‌دار
    opacity: "1",
  });

  document.body.appendChild(flyer);

  // شروع انیمیشن
  requestAnimationFrame(() => {
    flyer.style.top = `${cartRect.top}px`;
    flyer.style.left = `${cartRect.left}px`;
    flyer.style.width = "20px"; // کوچک شدن همزمان با رسیدن به سبد
    flyer.style.height = "20px";
    flyer.style.opacity = "0.2";
    flyer.style.transform = "rotate(360deg)"; // یک چرخش جذاب هنگام پرواز
  });

  // پاکسازی و افکت لرزش سبد خرید
  setTimeout(() => {
    if (document.body.contains(flyer)) {
      document.body.removeChild(flyer);
    }
    // افکت لرزش سبد خرید در هدر
    cartIcon.classList.add("cart-bounce");
    setTimeout(() => cartIcon.classList.remove("cart-bounce"), 300);
  }, 900);
}
