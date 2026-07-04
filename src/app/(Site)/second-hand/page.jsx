import connectToDB from "base/configs/db";
import UsedProduct from "base/models/UsedProduct";
import SiteSetting from "base/models/SiteSetting";
import SecondHandCategoryGrid from "@/components/features/secondHandCategoryGrid/SecondHandCategoryGrid";
import SportHero from "@/components/templates/sports/SportHero";

// تغییراتِ ادمین از طریقِ revalidatePath("/second-hand", "layout") باطل می‌شوند؛
// TTL زمان‌محور → ۱ساعت برای کاهشِ ISR Writes.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com";
const PAGE_TITLE = "بازار دست‌دوم | فروش تجهیزات ورزشی کارکرده";
const PAGE_DESC = "خرید و فروش تجهیزات ورزشی دست‌دوم با کارت سلامت معتبر";

export async function generateMetadata() {
  await connectToDB();
  const headerSetting = await SiteSetting.findOne({ key: "secondhand_header_image" }).lean();
  const rawImage = headerSetting?.value || null;
  const imageUrl = rawImage
    ? rawImage.startsWith("http") ? rawImage : `${SITE_URL}${rawImage}`
    : null;

  return {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: `${SITE_URL}/second-hand` },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESC,
      url: `${SITE_URL}/second-hand`,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: PAGE_TITLE }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: PAGE_TITLE,
      description: PAGE_DESC,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function UsedProductsPage() {
  await connectToDB();

  const rawProducts = await UsedProduct.find({ status: "available" })
    .populate({
      path: "baseProduct",
      select: "category",
      populate: {
        path: "category",
        select: "title slug icon image sport",
        populate: { path: "sport", select: "slug" },
      },
    })
    .lean();

  const categoryMap = new Map();
  for (const p of rawProducts) {
    const cat = p.baseProduct?.category;
    if (!cat?._id || !cat?.sport?.slug) continue;
    const key = cat._id.toString();
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        _id: key,
        id: key,
        name: cat.title,
        title: cat.title,
        slug: cat.slug,
        sportSlug: cat.sport.slug,
        icon: cat.icon || null,
        image: cat.image || null,
      });
    }
  }
  const categories = Array.from(categoryMap.values());

  const headerSetting = await SiteSetting.findOne({
    key: "secondhand_header_image",
  }).lean();
  const headerImage = headerSetting?.value || null;

  const itemListElement = categories.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "CollectionPage",
      name: `${c.title} دست‌دوم`,
      url: `${SITE_URL}/second-hand/${c.sportSlug}/${c.slug}`,
    },
  }));

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESC,
    url: `${SITE_URL}/second-hand`,
    inLanguage: "fa-IR",
    isPartOf: { "@type": "WebSite", name: "تنادور", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categories.length,
      itemListElement,
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "بازار دست‌دوم",
        item: `${SITE_URL}/second-hand`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <SportHero image={headerImage} title="بازار دست‌دوم" alt="بازار دست‌دوم" />
      <SecondHandCategoryGrid categories={categories} />
    </>
  );
}
