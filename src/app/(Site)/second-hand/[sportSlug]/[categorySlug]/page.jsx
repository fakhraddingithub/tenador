import { notFound } from "next/navigation";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import UsedProduct from "base/models/UsedProduct";
import Category from "base/models/Category";
import Product from "base/models/Product";
import HealthCard from "base/models/HealthCard";
import SiteSetting from "base/models/SiteSetting";
import UsedProductsPageClient from "@/components/templates/secondHands/UsedProductsPageClient";
import { getFilterableAttributes } from "base/services/product.service";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

async function resolveCategory(sportSlug, categorySlug) {
  await connectToDB();

  const sport = await Sport.findOne({ slug: sportSlug }).select("_id slug title").lean();
  if (!sport) return null;

  const category = await Category.findOne({ sport: sport._id, slug: categorySlug })
    .select("_id title slug image icon")
    .lean();
  if (!category) return null;

  return { sport, category };
}

export async function generateMetadata({ params }) {
  const { sportSlug, categorySlug } = await params;
  const resolved = await resolveCategory(sportSlug, categorySlug);
  if (!resolved) return { title: "صفحه پیدا نشد" };

  const { category } = resolved;

  const categoryProducts = await Product.find({ category: category._id }).select("_id").lean();
  const idList = categoryProducts.map((p) => p._id);

  const [productCount, sampleUsedProducts] = await Promise.all([
    UsedProduct.countDocuments({ status: "available", baseProduct: { $in: idList } }),
    UsedProduct.find({ status: "available", baseProduct: { $in: idList } })
      .select("images")
      .populate({
        path: "baseProduct",
        select: "mainImage brand",
        populate: { path: "brand", select: "title" },
      })
      .limit(12)
      .lean(),
  ]);

  const brandNames = [
    ...new Set(sampleUsedProducts.map((p) => p.baseProduct?.brand?.title).filter(Boolean)),
  ];

  const pageUrl = `${SITE_URL}/second-hand/${sportSlug}/${categorySlug}`;
  const title = `${category.title} دست‌دوم | خرید و فروش ${category.title} کارکرده`;
  const description =
    productCount > 0
      ? `خرید ${category.title} دست‌دوم با کارت سلامت معتبر — ${productCount} کالای موجود${
          brandNames.length ? ` از برندهایی مثل ${brandNames.slice(0, 3).join("، ")}` : ""
        }. تجهیزات ورزشی کارکرده با ضمانت کیفیت از تنادور.`
      : `خرید ${category.title} دست‌دوم با کارت سلامت معتبر — تجهیزات ورزشی کارکرده با ضمانت کیفیت از تنادور.`;
  const keywords = [
    `${category.title} دست‌دوم`,
    `${category.title} کارکرده`,
    "تجهیزات ورزشی دست‌دوم",
    "بازار دست‌دوم تنادور",
    ...brandNames.map((b) => `${category.title} ${b} دست‌دوم`),
  ].join(", ");

  const rawImage =
    category.image ||
    sampleUsedProducts[0]?.images?.[0] ||
    sampleUsedProducts[0]?.baseProduct?.mainImage ||
    null;
  const imageUrl = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${SITE_URL}${rawImage}`
    : null;

  return {
    title,
    description,
    keywords,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: pageUrl },
    robots: {
      index: productCount > 0,
      follow: true,
      googleBot: {
        index: productCount > 0,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "website",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    category: category.title,
  };
}

export default async function UsedProductsByCategoryPage({ params }) {
  const { sportSlug, categorySlug } = await params;
  const resolved = await resolveCategory(sportSlug, categorySlug);
  if (!resolved) notFound();

  const { category } = resolved;
  const categoryId = category._id;

  // محصولاتِ اصلیِ همین دسته‌بندی، برای فیلترِ محصولاتِ دست‌دوم بر اساسِ آن‌ها
  const categoryProductIds = await Product.find({ category: categoryId }).select("_id").lean();
  const idList = categoryProductIds.map((p) => p._id);

  const rawProducts = await UsedProduct.find({
    status: "available",
    baseProduct: { $in: idList },
  })
    .populate({
      path: "baseProduct",
      select: "name mainImage shortDescription basePrice brand category sku attributes color",
      populate: [
        { path: "brand", select: "title slug logo icon" },
        { path: "category", select: "title slug" },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const rate = await getCachedRate();
  const headerSetting = await SiteSetting.findOne({
    key: "secondhand_header_image",
  }).lean();
  const headerImage = headerSetting?.value || null;
  const allHealthCards = await HealthCard.find().lean();
  const cardFieldMap = {};
  const cardOrderByCat = {};
  allHealthCards.forEach((card) => {
    const catId = card.category?.toString();
    card.fields.forEach((field, i) => {
      cardFieldMap[field.key] = field.label;
      if (catId) {
        (cardOrderByCat[catId] ||= {})[field.key] = i;
      }
    });
  });

  const products = rawProducts
    .filter((p) => p.baseProduct)
    .map((p) => {
      const currentHealthScores = p.healthScores || [];
      const orderMap = cardOrderByCat[p.baseProduct.category?._id?.toString()] || {};
      const orderOf = (key) => (key in orderMap ? orderMap[key] : Infinity);

      return {
        _id: p._id.toString(),
        slug: p.slug || null,
        tested: !!p.tested,
        overallScore: p.overallScore,
        healthScores: currentHealthScores
          .map((s) => ({
            key: s.key,
            label: cardFieldMap[s.key] || s.key,
            rating: s.rating,
            note: s.note || "",
          }))
          .sort((a, b) => orderOf(a.key) - orderOf(b.key)),
        price: eurToToman(p.price, rate),
        name: p.name,
        description: p.description.trim()
          ? p.description
          : p.baseProduct.shortDescription,
        images: p.images || [],
        status: p.status,
        createdAt: p.createdAt?.toISOString(),
        baseProduct: {
          _id: p.baseProduct._id.toString(),
          name: p.baseProduct.name,
          mainImage: p.baseProduct.mainImage,
          basePrice: p.baseProduct.basePrice,
          sku: p.baseProduct.sku,
          attributes: p.baseProduct.attributes || {},
          color: p.baseProduct.color || null,
          brand: p.baseProduct.brand
            ? {
                _id: p.baseProduct.brand._id.toString(),
                title: p.baseProduct.brand.title,
                slug: p.baseProduct.brand.slug,
                logo: p.baseProduct.brand.logo,
                icon: p.baseProduct.brand.icon,
              }
            : null,
          category: p.baseProduct.category
            ? {
                _id: p.baseProduct.category._id.toString(),
                title: p.baseProduct.category.title,
                slug: p.baseProduct.category.slug,
              }
            : null,
        },
      };
    });

  const filterableAttributes = await getFilterableAttributes();

  const absUrl = (u) =>
    u ? (u.startsWith("http") ? u : `${SITE_URL}${u}`) : null;
  const pageUrl = `${SITE_URL}/second-hand/${sportSlug}/${categorySlug}`;
  const pageTitle = `${category.title} دست‌دوم`;

  const itemListElement = products.slice(0, 30).map((p, i) => {
    const img = absUrl(p.images?.[0] || p.baseProduct?.mainImage);
    const productUrl = p.slug ? `${SITE_URL}/second-hand/${p.slug}` : undefined;

    return {
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        ...(img && { image: [img] }),
        ...(productUrl && { url: productUrl }),
        ...(p.baseProduct?.sku && { sku: p.baseProduct.sku }),
        ...(p.baseProduct?.brand?.title && {
          brand: { "@type": "Brand", name: p.baseProduct.brand.title },
        }),
        ...(p.baseProduct?.category?.title && {
          category: p.baseProduct.category.title,
        }),
        offers: {
          "@type": "Offer",
          priceCurrency: "IRR",
          price: String(Math.round(p.price || 0) * 10),
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/UsedCondition",
          ...(productUrl && { url: productUrl }),
        },
      },
    };
  });

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: `محصولات دست‌دوم دسته‌بندی ${category.title}`,
    url: pageUrl,
    inLanguage: "fa-IR",
    isPartOf: { "@type": "WebSite", name: "تنادور", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
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
      { "@type": "ListItem", position: 3, name: pageTitle, item: pageUrl },
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
      <UsedProductsPageClient
        products={products}
        headerImage={headerImage}
        filterableAttributes={filterableAttributes}
        heroEyebrow="بازار"
        heroTitle={pageTitle}
        heroSubtitle={`محصولات دست‌دوم ${category.title} با کارت سلامت معتبر — با اطمینان بخر`}
      />
    </>
  );
}

