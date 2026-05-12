const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",

        allow: [
          "/",
          "/products/",
          "/category/",
          "/brand/",
        ],

        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/",
          "/checkout/",
          "/cart/",
          "/login/",
          "/register/",
          "/private/",
        ],
      },
    ],

    sitemap: `${SITE_URL}/sitemap.xml`,

    host: SITE_URL,
  };
}