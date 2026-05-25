const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";

export function generateProductMetadata(product) {
  const title = product.name;

  const description =
    product.shortDescription ||
    `خرید ${product.name} با ضمانت اصالت و ارسال سریع از تنادور`;

  const keywords = [
    product.name,
    product.brand?.name,
    product.category?.name,
    ...(product.tag || []),
  ]
    .filter(Boolean)
    .join(", ");

  const images = [product.mainImage, ...(product.gallery || [])].filter(
    Boolean,
  );

  const imageUrls = images.map((img) =>
    img.startsWith("http") ? img : `${SITE_URL}${img}`,
  );

  const canonicalUrl = `${SITE_URL}/products/${product.slug}`;

  return {
    title,
    description,
    keywords,

    metadataBase: new URL(SITE_URL),

    alternates: {
      canonical: canonicalUrl,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",

      images: imageUrls.map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: product.name,
      })),
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrls,
    },

    category: product.category?.name,
  };
}
