/**
 * ساختِ متادیتای صفحه از روی محتوای CMS (برای generateMetadata صفحات اطلاع‌رسانی).
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";

export function buildPageMetadata(content, slug) {
  if (!content) return { title: "صفحه پیدا نشد" };

  const title = content.seo?.title || content.title;
  const description = content.seo?.description || "";
  const ogImage = content.seo?.ogImage || "";
  const url = `${SITE_URL}/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}
