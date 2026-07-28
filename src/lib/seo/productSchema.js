const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");
const TOMAN_TO_RIAL = 10;

/**
 * ساخت اسکیمای محصول برای نتایج گوگل (JSON-LD).
 *
 * @param {object} product  محصول؛ basePrice به «تومان» است.
 * @param {{ average?: number, ratedCount?: number }} [reviewStats]
 *        خلاصه‌ی امتیاز نظرهای تأییدشده (از getApprovedReviews).
 */
export function generateProductSchema(product, reviewStats) {
  const images = [
    product.mainImage,
    ...(product.gallery || []),
  ]
    .filter(Boolean)
    .map((img) =>
      img.startsWith("http")
        ? img
        : `${SITE_URL}${img}`
    );

  // AggregateRating فقط از نظرهای واقعی و تأییدشده ساخته می‌شود. اعلام امتیاز
  // ساختگی برای محصول بدون نظر با محتوای قابل مشاهده صفحه تطابق ندارد.
  const ratedCount = reviewStats?.ratedCount || 0;
  const average = reviewStats?.average || 0;
  const aggregateRating =
    ratedCount > 0 && average > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: average,
          reviewCount: ratedCount,
          bestRating: 5,
          worstRating: 1,
        }
      : null;

  // Google product snippets expect ISO 4217 currency codes. Toman has no
  // official code, so publish the equivalent Rial amount for structured data.
  const priceInRial = String(Math.round(product.basePrice || 0) * TOMAN_TO_RIAL);

  return {
    "@context": "https://schema.org/",
    "@type": "Product",

    name: product.name,

    image: images,

    description: product.longDescription,

    sku: product.sku,

    mpn: product.sku,

    ...(product.brand && {
      brand: {
        "@type": "Brand",
        name: product.brand.title || product.brand.name,
      },
    }),

    category: product.category?.title || product.category?.name,

    ...(aggregateRating && { aggregateRating }),

    offers: {
      "@type": "Offer",

      url: `${SITE_URL}/products/${product.slug}`,

      priceCurrency: "IRR",

      price: priceInRial,

      availability: "https://schema.org/InStock",

      itemCondition:
        "https://schema.org/NewCondition",

      seller: {
        "@type": "Organization",
        name: "تنادور",
        url: SITE_URL,
      },
    },
  };
}
