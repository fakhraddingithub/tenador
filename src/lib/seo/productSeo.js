import sanitizeHtml from "sanitize-html";

export function productMetaText(value) {
  const spaced = String(value || "").replace(
    /<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, " ",
  );
  // Remove markup without joining adjacent paragraphs. React escapes the
  // resulting plain text when it writes the metadata attribute.
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export function generateProductMetadata(product) {
  const title = product.name;

  const description =
    productMetaText(product.shortDescription) ||
    `خرید ${product.name} با ضمانت اصالت و ارسال سریع از تنادور`;

  const keywords = [
    product.name,
    product.brand?.name,
    product.category?.name,
    ...(product.tag || []),
  ]
    .filter(Boolean)
    .join(", ");

  const rawMainImage = product.mainImage || null;
  const mainImageUrl = rawMainImage
    ? rawMainImage.startsWith("http")
      ? rawMainImage
      : `${SITE_URL}${rawMainImage}`
    : null;

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
      ...(mainImageUrl && {
        images: [{ url: mainImageUrl, width: 1200, height: 630, alt: product.name }],
      }),
    },

    twitter: {
      card: mainImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(mainImageUrl && { images: [mainImageUrl] }),
    },

    category: product.category?.name,
  };
}
