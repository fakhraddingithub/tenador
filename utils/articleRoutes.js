const RESERVED_ARTICLE_ROOTS = new Set([
  "about",
  "about-us",
  "api",
  "articles",
  "athletes",
  "auth",
  "collection",
  "compare",
  "contact",
  "contact-us",
  "faq",
  "how-to-order",
  "login-register",
  "p-admin",
  "p-user",
  "payment",
  "products",
  "returns",
  "rss.xml",
  "second-hand",
  "shipping",
  "terms",
]);

export function isReservedArticleRoot(slug) {
  return RESERVED_ARTICLE_ROOTS.has(String(slug || "").trim().toLowerCase());
}

export function publicArticleFilter(now = new Date()) {
  return {
    deletedAt: null,
    $or: [
      { status: "published", publishedAt: null },
      { status: { $in: ["published", "scheduled"] }, publishedAt: { $lte: now } },
    ],
  };
}

