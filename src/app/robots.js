const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/p-admin/",
          "/p-user/",
          "/api/",
          "/checkout/",
          "/cart/",
          "/login-register",
          "/auth/",
          // هر URL حاویِ query-string (فیلترهای اتریبیوت، صفحه‌بندی، جستجو و...) از
          // ایندکس/کرالِ گوگل و سایر بات‌ها معاف می‌شود، تا فقط نسخه‌ی کانونیکالِ
          // هر صفحه (بدونِ پارامتر) کرال شود. این هزاران ترکیبِ فیلترِ ممکن روی
          // صفحاتِ ورزش/دسته‌بندی/محصول را از بودجه‌ی کرال و بارِ سرور خارج می‌کند،
          // بدونِ این‌که هیچ صفحه‌ی واقعیِ سایت از دسترسِ کرال خارج شود.
          "/*?*",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
