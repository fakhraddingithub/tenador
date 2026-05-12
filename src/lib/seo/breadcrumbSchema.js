const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export function generateBreadcrumbSchema(product) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",

    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "خانه",
        item: SITE_URL,
      },

      {
        "@type": "ListItem",
        position: 2,
        name: product.category?.name,
        item: `${SITE_URL}/category/${product.category?.slug}`,
      },

      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${SITE_URL}/products/${product.slug}`,
      },
    ],
  };
}