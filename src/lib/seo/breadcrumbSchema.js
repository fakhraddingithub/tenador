const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

// مسیرِ نان‌خرده‌ها (breadcrumb) ساختارِ تو-در-توی جدید را منعکس می‌کند:
// خانه ← ورزش (/[sportSlug]) ← دسته (/[sportSlug]/[categorySlug]) ← محصول.
export function generateBreadcrumbSchema(product) {
  const sport = product.sport;
  const category = product.category;

  const itemListElement = [
    {
      "@type": "ListItem",
      position: 1,
      name: "خانه",
      item: SITE_URL,
    },
  ];

  let position = 2;

  if (sport?.slug) {
    itemListElement.push({
      "@type": "ListItem",
      position: position++,
      name: sport.title || sport.name,
      item: `${SITE_URL}/${sport.slug}`,
    });
  }

  // دسته فقط در صورت وجودِ ورزش، تو-در-تو آدرس‌دهی می‌شود؛ در غیر این صورت
  // مسیر معتبری برای دسته وجود ندارد و از زنجیره حذف می‌شود.
  if (sport?.slug && category?.slug) {
    itemListElement.push({
      "@type": "ListItem",
      position: position++,
      name: category.name,
      item: `${SITE_URL}/${sport.slug}/${category.slug}`,
    });
  }

  itemListElement.push({
    "@type": "ListItem",
    position: position++,
    name: product.name,
    item: `${SITE_URL}/products/${product.slug}`,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}