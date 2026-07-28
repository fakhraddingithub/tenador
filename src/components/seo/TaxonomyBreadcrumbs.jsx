import Link from "next/link";
import { buildTaxonomyBreadcrumbs } from "@/lib/seo/taxonomySeo";

export default function TaxonomyBreadcrumbs({
  filters,
  items: providedItems,
  includeStructuredData = true,
}) {
  const items = providedItems || buildTaxonomyBreadcrumbs(filters);
  if (items.length < 2) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      {includeStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <nav
        aria-label="مسیر صفحه"
        className="mx-auto w-full max-w-[1440px] px-4 py-4 text-sm text-neutral-500 lg:px-8 md:text-base"
      >
        <ol className="flex flex-wrap items-center gap-2.5">
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;
            return (
              <li
                key={`${item.href || item.url || item.name}-${index}`}
                className="flex items-center gap-2.5"
              >
                {index > 0 && <span aria-hidden="true">/</span>}
                {isCurrent ? (
                  <span
                    aria-current="page"
                    className="font-bold text-neutral-700"
                  >
                    {item.name}
                  </span>
                ) : item.href ? (
                  <Link href={item.href} className="hover:text-[var(--color-primary)]">
                    {item.name}
                  </Link>
                ) : (
                  <span className="text-neutral-600">{item.name}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
