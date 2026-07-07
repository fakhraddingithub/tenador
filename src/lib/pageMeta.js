/**
 * ساختِ متادیتای صفحه — به‌صورت خودکار از روی محتوای واقعیِ صفحه استخراج می‌شود
 * (بدون ورودی دستیِ سئو):
 *   - عنوان: عنوانِ هیرو/سرتیترِ اصلیِ صفحه
 *   - توضیحات: اولین متنِ معنادار (زیرعنوانِ هیرو / متن / مقدمه)، کوتاه‌شده تا ~۱۶۰ نویسه
 *   - og:image: اولین تصویرِ موجود در بلوک‌های صفحه
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

function deriveTitle(sections, fallback) {
  const hero = sections.find((b) => b?.type === "hero" && b.title);
  if (hero) return hero.title;
  const anyTitled = sections.find((b) => b?.title);
  return anyTitled?.title || fallback;
}

function deriveDescription(sections) {
  for (const b of sections) {
    if (!b) continue;
    if (b.type === "hero" && b.subtitle) return b.subtitle;
    if (b.type === "richtext" && b.body) return b.body;
    if (b.subtitle) return b.subtitle;
    if (b.body) return b.body;
    if (b.intro) return b.intro;
    if (b.text) return b.text;
  }
  return "";
}

function deriveImage(sections) {
  for (const b of sections) {
    if (!b) continue;
    if (b.image) return b.image;
    if (Array.isArray(b.items)) {
      const withImg = b.items.find((it) => it && it.image);
      if (withImg) return withImg.image;
    }
  }
  return "";
}

function truncate(text, max = 160) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function buildPageMetadata(content, slug) {
  if (!content) return { title: "صفحه پیدا نشد" };

  const sections = content.sections || [];
  const title = deriveTitle(sections, content.title);
  const description = truncate(deriveDescription(sections), 160);
  const ogImage = deriveImage(sections);
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
