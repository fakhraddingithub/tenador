/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,

  // کش سمت‌کلاینت روتر: صفحاتی که یک‌بار بازدید/پری‌فچ شده‌اند تا این مدت
  // بدون درخواست مجدد به سرور نمایش داده می‌شوند (تجربه‌ی SPA و ناوبری آنی).
  //  - dynamic: صفحات داینامیک (لیست محصول، صفحات ورزش/برند) ۳۰ ثانیه
  //  - static : صفحات ایستا/ISR تا ۳ دقیقه
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // ریدایرکت دائمی مسیر قدیمیِ «رویدادها» به مسیر جدید «Collection».
  // اسلاگ‌ها بدون تغییر باقی مانده‌اند؛ فقط بخش مسیر تغییر کرده است.
  async redirects() {
    return [
      {
        source: "/events",
        destination: "/collection",
        permanent: true,
      },
      {
        source: "/events/:slug*",
        destination: "/collection/:slug*",
        permanent: true,
      },
    ];
  },

  images: {
    // بهینه‌سازی تصاویر از طریق Cloudinary انجام می‌شود (نه Image Optimization ورسل)
    // تا مصرف Transformations ورسل صفر بماند. منطق در src/lib/cloudinaryLoader.js
    loader: "custom",
    loaderFile: "./src/lib/cloudinaryLoader.js",
    // تعداد سایزهای مختلفی که Next.js برای srcset تولید می‌کند را محدود می‌کنیم
    // تا تعداد transformation های منحصربه‌فردِ Cloudinary (که هرکدام کِردیت مصرف
    // می‌کنند) کمتر شود. پیش‌فرضِ Next حدود ۱۶ سایز (۸ device + ۸ image) است که
    // به‌ازای هر عکس ۱۶ ترنسفورمِ جدا می‌ساخت. اینجا فقط ۷ سایز (۴+۳) داریم که
    // برای همه‌ی صفحه‌نمایش‌ها (موبایل تا دسکتاپ بزرگ) کیفیت را حفظ می‌کند.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
