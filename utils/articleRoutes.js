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
  // مسیرِ عمومیِ مقاله‌ها؛ "articles" هم می‌ماند چون ریدایرکتِ دائمیِ آدرس‌های
  // قدیمی روی همان مسیر نشسته است.
  "content",
  "faq",
  "how-to-order",
  "login-register",
  // برگه‌ی چاپِ آدرسِ سفارش — ریشه‌ی مستقلِ خودش را دارد (src/app/(Print))
  "order-print",
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

// همتای درون‌حافظه‌ایِ publicArticleFilter برای یک مقاله‌ی مشخص. این دو باید
// همیشه یک چیز بگویند؛ وگرنه پنل ادمین لینکِ عمومی را برای مقاله‌ای نشان
// می‌دهد که سایت رویش ۴۰۴ می‌دهد (یا برعکس، لینکِ معتبر را پنهان می‌کند).
export function isArticlePubliclyVisible(article, now = new Date()) {
  if (!article || typeof article !== "object") return false;
  if (article.deletedAt) return false;

  const { status } = article;
  if (status !== "published" && status !== "scheduled") return false;

  // فقط «منتشرشده» می‌تواند بدون تاریخ عمومی باشد؛ «زمان‌بندی‌شده» بدون تاریخ
  // هرگز منتشر نمی‌شود (هم‌تراز با شرطِ publishedAt: { $lte: now }).
  if (!article.publishedAt) return status === "published";

  const publishedAt = new Date(article.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return false;
  return publishedAt.getTime() <= now.getTime();
}

