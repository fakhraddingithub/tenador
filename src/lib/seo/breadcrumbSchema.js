import { buildTaxonomyBreadcrumbs } from "./taxonomySeo.js";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export function generateBreadcrumbSchema(product) {
  const items = buildTaxonomyBreadcrumbs({ sport: product.sport, category: product.category, brand: product.brand, serie: product.serie });
  items.push({ name: product.name, url: `${SITE_URL}/products/${product.slug}` });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })) };
}
