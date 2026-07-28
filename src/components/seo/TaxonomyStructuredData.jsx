import { buildTaxonomyMetadata } from "@/lib/seo/taxonomySeo";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

function normaliseProducts(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.sections)) {
    return value.sections.flatMap((section) => section?.products || []);
  }
  return [];
}

export default function TaxonomyStructuredData({
  filters,
  products,
  canonical,
}) {
  const { title, description } = buildTaxonomyMetadata(filters);
  const uniqueProducts = [];
  const seen = new Set();

  for (const product of normaliseProducts(products)) {
    if (!product?.slug || seen.has(product.slug)) continue;
    seen.add(product.slug);
    uniqueProducts.push(product);
    if (uniqueProducts.length === 24) break;
  }

  const itemList = uniqueProducts.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `${SITE_URL}/products/${product.slug}`,
    name: product.name || product.title,
    ...(product.mainImage && {
      image: product.mainImage.startsWith("http")
        ? product.mainImage
        : `${SITE_URL}${product.mainImage}`,
    }),
  }));

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#collection`,
    url: canonical,
    name: title,
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "تنادور",
      url: SITE_URL,
    },
    ...(itemList.length > 0 && {
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: itemList.length,
        itemListElement: itemList,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
