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

  // These force-dynamic pages contain no server-rendered user data. Vercel's
  // dedicated CDN header can cache them without running Node middleware for
  // every public request (including crawler-generated 404s).
  async headers() {
    const headers = [
      {
        key: "Vercel-CDN-Cache-Control",
        value: "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    ];
    const sports = "tennis|padel|badminton|squash|beachtennis|pickleball|ping-pong";
    return [
      { source: `/:sport(${sports})`, headers },
      { source: `/:sport(${sports})/:path*`, headers },
      { source: "/articles/:path*", headers },
    ];
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
      // مسیرهای /brand/... و /sport/... هرگز در اپ وجود نداشته‌اند، اما sitemap
      // قدیمی /brand/[slug] تولید می‌کرد و گوگل الگوی /sport/[slug] را هم از روی
      // آن حدس زده و کرال می‌کند. ریدایرکت دائمی به آدرس کانونیکالِ ریشه
      // (/[slug]) تا این URLها از صف کشف/ایندکس گوگل پاک شوند.
      {
        source: "/brand/:slug*",
        destination: "/:slug*",
        permanent: true,
      },
      {
        source: "/sport/:slug*",
        destination: "/:slug*",
        permanent: true,
      },
      // لینک‌های قدیمی صفحه‌ی محصول به /brands/[slug] اشاره می‌کردند در حالی که
      // صفحه‌ی برند در ریشه است؛ /brands هم صفحه‌ی واقعی ندارد.
      {
        source: "/brands/:slug*",
        destination: "/:slug*",
        permanent: true,
      },
    ];
  },

  images: {
    // بهینه‌سازی تصاویر از طریق ImageKit انجام می‌شود (نه Image Optimization ورسل)
    // تا مصرف Transformations ورسل صفر بماند. منطق در src/lib/imagekitLoader.js
    // (که آدرس‌های قدیمیِ Cloudinary را هم تا پایان مهاجرت پشتیبانی می‌کند)
    loader: "custom",
    loaderFile: "./src/lib/imagekitLoader.js",
    // تعداد سایزهای مختلفی که Next.js برای srcset تولید می‌کند را محدود می‌کنیم
    // تا تعداد ترنسفورم/بندویدثِ مصرفی کمتر شود (به‌جای ۸+۸ پیش‌فرض، فقط ۴+۳).
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // آدرس‌های قدیمی تا پایان مهاجرت
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io", // آدرس‌های جدید ImageKit
      },
    ],
  },
};

export default nextConfig;
