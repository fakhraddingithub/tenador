import { getPublicArticleFeed } from "base/services/publicArticle.service";
import { buildArticlePath } from "base/utils/articleSlug";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

function escapeXml(value = "") {
  return String(value).replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]);
}

export async function GET() {
  const articles = await getPublicArticleFeed();
  const items = articles.map((article) => {
    const url = `${SITE_URL}${buildArticlePath(article.category.slug, article.slug)}`;
    const author = [article.author?.name, article.author?.lastName].filter(Boolean).join(" ") || "تنادور";
    return `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><description>${escapeXml(article.excerpt)}</description><category>${escapeXml(article.category.name)}</category><author>${escapeXml(author)}</author><pubDate>${new Date(article.publishedAt || article.updatedAt).toUTCString()}</pubDate>${article.cover?.url ? `<enclosure url="${escapeXml(article.cover.url)}" type="image/jpeg" />` : ""}</item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>مجله تنادور</title><link>${SITE_URL}</link><description>تازه‌ترین مقالات و راهنماهای تنادور</description><language>fa-IR</language><atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } });
}
