const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        // Next.js adds ?dpl=... to CSS/JS URLs. This more-specific rule
        // keeps rendering assets crawlable despite the query-string block.
        allow: ["/", "/_next/static/"],
        disallow: [
          "/p-admin/",
          "/p-user/",
          "/api/",
          "/checkout/",
          "/cart/",
          "/login-register",
          "/auth/",
          // Limit crawling of parameterized pages; static assets are allowed above.
          // A crawl restriction does not itself prevent URL indexing.
          "/*?*",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
