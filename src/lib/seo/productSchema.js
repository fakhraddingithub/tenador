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

  // امتیاز واقعی از نظرهای تأییدشده؛ در نبودِ نظرِ امتیازدار به ۵/۱ برمی‌گردد
  // تا اسنیپت ستاره‌ها در نتایج گوگل حفظ شود.
  const ratedCount = reviewStats?.ratedCount || 0;
  const average = reviewStats?.average || 0;
  const aggregateRating =
    ratedCount > 0 && average > 0
      ? { ratingValue: average, reviewCount: ratedCount }
      : { ratingValue: 5, reviewCount: 1 };

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

    brand: {
      "@type": "Brand",
      name: product.brand?.name || "",
    },

    category: product.category?.name,

    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue,
      reviewCount: aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },

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
        name: "فروشگاه ورزشی",
      },
    },
  };
}