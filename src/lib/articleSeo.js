import { countArticleWords } from "@/lib/articleContent";
import { buildArticlePath } from "base/utils/articleSlug";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export function absoluteArticleUrl(value = "") {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}/${String(value).replace(/^\/+/, "")}`;
}

function imageUrl(article) {
  return article?.seo?.ogImage || article?.cover?.url || article?.category?.cover?.url || "/images/og-cover.jpg";
}

export function articleMetadata(article) {
  const title = article.seo?.title || article.title;
  const description = article.seo?.description || article.excerpt || article.category?.description || "";
  const canonical = absoluteArticleUrl(buildArticlePath(article.category.slug, article.slug));
  const image = absoluteArticleUrl(imageUrl(article));
  const author = [article.author?.name, article.author?.lastName].filter(Boolean).join(" ") || "تنادور";
  return {
    title,
    description,
    keywords: article.seo?.keywords || [],
    alternates: { canonical },
    robots: { index: !article.seo?.noIndex, follow: !article.seo?.noIndex },
    authors: [{ name: author }],
    openGraph: {
      type: "article", locale: "fa_IR", siteName: "تنادور", url: canonical,
      title: article.seo?.ogTitle || title,
      description: article.seo?.ogDescription || description,
      images: [{ url: image, width: article.cover?.width || 1200, height: article.cover?.height || 630, alt: article.cover?.alt || title }],
      publishedTime: article.publishedAt || undefined,
      modifiedTime: article.updatedAt || undefined,
      authors: [author],
      tags: (article.tags || []).map((tag) => tag.name),
    },
    twitter: {
      card: "summary_large_image",
      title: article.seo?.ogTitle || title,
      description: article.seo?.ogDescription || description,
      images: [image],
    },
  };
}

export function articleCategoryMetadata(category) {
  const title = category.seo?.title || category.name;
  const description = category.seo?.description || category.description || `مقالات ${category.name} تنادور`;
  const canonical = absoluteArticleUrl(category.seo?.canonicalUrl || category.slug);
  const image = absoluteArticleUrl(category.seo?.ogImage || category.cover?.url || "/images/og-cover.jpg");
  return {
    title, description, keywords: category.seo?.keywords || [], alternates: { canonical },
    robots: { index: !category.seo?.noIndex, follow: !category.seo?.noIndex },
    openGraph: { type: "website", locale: "fa_IR", siteName: "تنادور", url: canonical, title: category.seo?.ogTitle || title, description: category.seo?.ogDescription || description, images: [{ url: image, width: 1200, height: 630, alt: category.cover?.alt || title }] },
    twitter: { card: "summary_large_image", title: category.seo?.ogTitle || title, description: category.seo?.ogDescription || description, images: [image] },
  };
}

export function articleSchemas(article, products = []) {
  const url = absoluteArticleUrl(buildArticlePath(article.category.slug, article.slug));
  const image = absoluteArticleUrl(imageUrl(article));
  const authorName = [article.author?.name, article.author?.lastName].filter(Boolean).join(" ") || "تنادور";
  const faqItems = (article.blocks || []).filter((block) => block.type === "faq").flatMap((block) => block.data?.items || []).filter((item) => item.question && item.answer);
  const schemas = [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "خانه", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: article.category.name, item: absoluteArticleUrl(article.category.slug) },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "Article", "@id": `${url}#article`,
      headline: article.title, description: article.excerpt, image: [image], mainEntityOfPage: url,
      datePublished: article.publishedAt, dateModified: article.updatedAt,
      author: { "@type": "Person", name: authorName },
      publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "تنادور", logo: { "@type": "ImageObject", url: absoluteArticleUrl(process.env.NEXT_PUBLIC_LOGO_URL || "/images/logo.png") } },
      articleSection: article.category.name,
      keywords: (article.tags || []).map((tag) => tag.name).join(", "),
      wordCount: countArticleWords(article.blocks || []),
    },
  ];
  if (faqItems.length) schemas.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) });
  for (const product of products) {
    schemas.push({
      "@context": "https://schema.org", "@type": "Product", name: product.name,
      image: product.mainImage ? [absoluteArticleUrl(product.mainImage)] : undefined,
      description: product.longDescription || undefined, sku: product.sku || undefined,
      brand: product.brand ? { "@type": "Brand", name: product.brand.title || product.brand.name } : undefined,
      offers: { "@type": "Offer", url: absoluteArticleUrl(`products/${product.slug}`), priceCurrency: "IRR", price: String(Math.round(Number(product.finalPriceToman ?? product.basePriceToman ?? product.basePrice ?? 0) * 10)), availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" },
    });
  }
  return schemas;
}

