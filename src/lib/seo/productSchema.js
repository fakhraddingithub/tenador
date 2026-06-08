const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export function generateProductSchema(product) {
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
      ratingValue: product.score || 5,
      reviewCount: 1,
    },

    offers: {
      "@type": "Offer",

      url: `${SITE_URL}/products/${product.slug}`,

      priceCurrency: "IRR",

      price: product.basePrice,

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