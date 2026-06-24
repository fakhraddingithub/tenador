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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
