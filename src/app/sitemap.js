import Product from "base/models/Product";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Serie from "base/models/Serie";
import LimitedEdition from "base/models/LimitedEdition";
import Event from "base/models/Event";
import UsedProduct from "base/models/UsedProduct";

import connectToDB from "base/configs/db";
import { getPublicArticleSitemap } from "base/services/publicArticle.service";
import { isReservedArticleRoot } from "base/utils/articleRoutes";
import { buildArticlePath } from "base/utils/articleSlug";
import {
  getCategorySportIds,
  isSharedCategory,
} from "base/utils/categorySportVisibility";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export const revalidate = 86400;

const id = (value) => (value ? String(value) : "");
const hasSlug = (item) => Boolean(item?.slug);

function latestDate(items) {
  const timestamps = items
    .map((item) => item?.updatedAt && new Date(item.updatedAt).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)) : undefined;
}

function entry(url, lastModified, changeFrequency = "weekly", priority = 0.7) {
  return {
    url: `${SITE_URL}${url}`,
    ...(lastModified && { lastModified }),
    changeFrequency,
    priority,
  };
}

export default async function sitemap() {
  await connectToDB();

  // Sitemap روزی یک‌بار بازتولید می‌شود. همه کوئری‌ها lean و select شده‌اند و
  // فقط فیلدهای لازم برای اعتبارسنجی قرارداد URL را می‌خوانند.
  const [
    products,
    sports,
    categories,
    brands,
    series,
    limitedEditions,
    events,
    usedProducts,
    articleContent,
  ] = await Promise.all([
    Product.find({ isActive: true, slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt sport category brand serie limitedEdition")
      .lean(),
    Sport.find({ slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .lean(),
    Category.find({ slug: { $exists: true, $ne: "" }, sport: { $ne: null } })
      .select("slug updatedAt sport additionalSports")
      .lean(),
    Brand.find({ slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .lean(),
    Serie.find({ slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt brand parentSerie")
      .lean(),
    LimitedEdition.find({ slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt brand")
      .lean(),
    Event.find({ status: "active", slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt")
      .lean(),
    UsedProduct.find({ status: "available", slug: { $exists: true, $ne: "" } })
      .select("slug updatedAt baseProduct")
      .populate({ path: "baseProduct", select: "sport category" })
      .lean(),
    getPublicArticleSitemap(),
  ]);

  const sportById = new Map(sports.map((item) => [id(item._id), item]));
  const categoryById = new Map(categories.map((item) => [id(item._id), item]));
  const brandById = new Map(brands.map((item) => [id(item._id), item]));
  const serieById = new Map(series.map((item) => [id(item._id), item]));
  const limitedEditionById = new Map(
    limitedEditions.map((item) => [id(item._id), item]),
  );

  const activeSportIds = new Set();
  const activeCategoryKeys = new Set();
  const activeBrandIds = new Set();
  const sportBrandKeys = new Set();
  const sportCategoryBrandKeys = new Set();
  const sportBrandSerieKeys = new Set();
  const brandLimitedEditionKeys = new Set();

  for (const product of products) {
    const primarySportId = id(product.sport);
    const categoryId = id(product.category);
    const brandId = id(product.brand);
    const category = categoryById.get(categoryId);
    const sharedSportIds = isSharedCategory(category)
      ? getCategorySportIds(category)
      : [];
    const visibleSportIds = new Set(
      [primarySportId, ...sharedSportIds].filter(Boolean),
    );
    const categorySportIds = isSharedCategory(category)
      ? sharedSportIds
      : primarySportId && primarySportId === id(category?.sport)
        ? [primarySportId]
        : [];

    if (brandId) activeBrandIds.add(brandId);

    for (const sportId of visibleSportIds) {
      activeSportIds.add(sportId);
      if (brandId) sportBrandKeys.add(`${sportId}:${brandId}`);

      let serieId = id(product.serie);
      const visited = new Set();
      while (brandId && serieId && !visited.has(serieId)) {
        visited.add(serieId);
        const serie = serieById.get(serieId);
        if (!serie || id(serie.brand) !== brandId) break;
        sportBrandSerieKeys.add(`${sportId}:${brandId}:${serieId}`);
        serieId = id(serie.parentSerie);
      }
    }

    for (const sportId of categorySportIds) {
      if (!categoryId) continue;
      activeCategoryKeys.add(`${sportId}:${categoryId}`);
      if (brandId) {
        sportCategoryBrandKeys.add(`${sportId}:${categoryId}:${brandId}`);
      }
    }

    const limitedEditionId = id(product.limitedEdition);
    const limitedEdition = limitedEditionById.get(limitedEditionId);
    if (
      brandId &&
      limitedEdition &&
      id(limitedEdition.brand) === brandId
    ) {
      brandLimitedEditionKeys.add(`${brandId}:${limitedEditionId}`);
    }
  }

  const staticUrls = [
    entry("", latestDate(products), "daily", 1),
    entry("/products", latestDate(products), "daily", 0.9),
    entry("/about", undefined, "monthly", 0.5),
    entry("/contact", undefined, "monthly", 0.5),
    entry("/faq", undefined, "monthly", 0.6),
    entry("/how-to-order", undefined, "monthly", 0.6),
    entry("/shipping", undefined, "monthly", 0.5),
    entry("/returns", undefined, "monthly", 0.5),
    entry("/payment", undefined, "monthly", 0.5),
    entry("/terms", undefined, "yearly", 0.3),
    entry("/content", undefined, "daily", 0.8),
    entry("/collection", latestDate(events), "daily", 0.7),
    entry("/second-hand", latestDate(usedProducts), "daily", 0.8),
    entry("/match", undefined, "monthly", 0.7),
    entry("/compare", undefined, "monthly", 0.7),
  ];

  const sportUrls = [...activeSportIds]
    .map((sportId) => sportById.get(sportId))
    .filter(hasSlug)
    .map((sport) => entry(`/${sport.slug}`, sport.updatedAt, "weekly", 0.8));

  const categoryUrls = [...activeCategoryKeys].flatMap((key) => {
    const [sportId, categoryId] = key.split(":");
    const sport = sportById.get(sportId);
    const category = categoryById.get(categoryId);
    return hasSlug(category) && hasSlug(sport)
      ? [
          entry(
            `/${sport.slug}/${category.slug}`,
            category.updatedAt,
            "weekly",
            0.8,
          ),
        ]
      : [];
  });

  const brandUrls = [...activeBrandIds]
    .map((brandId) => brandById.get(brandId))
    .filter(hasSlug)
    .map((brand) => entry(`/${brand.slug}`, brand.updatedAt, "weekly", 0.7));

  const sportBrandUrls = [...sportBrandKeys].flatMap((key) => {
    const [sportId, brandId] = key.split(":");
    const sport = sportById.get(sportId);
    const brand = brandById.get(brandId);
    return hasSlug(sport) && hasSlug(brand)
      ? [entry(`/${sport.slug}/${brand.slug}`, latestDate([sport, brand]))]
      : [];
  });

  const categoryBrandUrls = [...sportCategoryBrandKeys].flatMap((key) => {
    const [sportId, categoryId, brandId] = key.split(":");
    const sport = sportById.get(sportId);
    const category = categoryById.get(categoryId);
    const brand = brandById.get(brandId);
    return hasSlug(sport) && hasSlug(category) && hasSlug(brand)
      ? [
          entry(
            `/${sport.slug}/${category.slug}/${brand.slug}`,
            latestDate([category, brand]),
          ),
        ]
      : [];
  });

  const serieUrls = [...sportBrandSerieKeys].flatMap((key) => {
    const [sportId, brandId, serieId] = key.split(":");
    const sport = sportById.get(sportId);
    const brand = brandById.get(brandId);
    const serie = serieById.get(serieId);
    return hasSlug(sport) && hasSlug(brand) && hasSlug(serie)
      ? [
          entry(
            `/${sport.slug}/${brand.slug}/${serie.slug}`,
            latestDate([serie, brand]),
            "weekly",
            0.8,
          ),
        ]
      : [];
  });

  const limitedEditionUrls = [...brandLimitedEditionKeys].flatMap((key) => {
    const [brandId, limitedEditionId] = key.split(":");
    const brand = brandById.get(brandId);
    const limitedEdition = limitedEditionById.get(limitedEditionId);
    return hasSlug(brand) && hasSlug(limitedEdition)
      ? [
          entry(
            `/${brand.slug}/${limitedEdition.slug}`,
            latestDate([limitedEdition, brand]),
            "weekly",
            0.8,
          ),
        ]
      : [];
  });

  const productUrls = products.map((product) =>
    entry(`/products/${product.slug}`, product.updatedAt, "weekly", 0.9),
  );

  const collectionUrls = events.map((event) =>
    entry(`/collection/${event.slug}`, event.updatedAt, "weekly", 0.7),
  );

  const usedProductUrls = usedProducts.map((product) =>
    entry(`/second-hand/${product.slug}`, product.updatedAt, "weekly", 0.7),
  );

  const usedCategoryKeys = new Map();
  for (const usedProduct of usedProducts) {
    const primarySportId = id(usedProduct.baseProduct?.sport);
    const categoryId = id(usedProduct.baseProduct?.category);
    const category = categoryById.get(categoryId);
    const sportIds = isSharedCategory(category)
      ? getCategorySportIds(category)
      : primarySportId && primarySportId === id(category?.sport)
        ? [primarySportId]
        : [];
    for (const sportId of sportIds) {
      usedCategoryKeys.set(`${sportId}:${categoryId}`, usedProduct.updatedAt);
    }
  }

  const usedCategoryUrls = [...usedCategoryKeys].flatMap(
    ([key, lastModified]) => {
      const [sportId, categoryId] = key.split(":");
      const sport = sportById.get(sportId);
      const category = categoryById.get(categoryId);
      return hasSlug(sport) && hasSlug(category)
        ? [
            entry(
              `/second-hand/${sport.slug}/${category.slug}`,
              lastModified,
              "daily",
              0.7,
            ),
          ]
        : [];
    },
  );

  const occupiedRootSlugs = new Set(
    [...sports, ...brands].map((item) => item.slug).filter(Boolean),
  );

  const articleCategoryUrls = articleContent.categories
    .filter(
      (category) =>
        category.slug &&
        !occupiedRootSlugs.has(category.slug) &&
        !isReservedArticleRoot(category.slug),
    )
    .map((category) =>
      entry(`/${category.slug}`, category.updatedAt, "weekly", 0.7),
    );

  const articleUrls = articleContent.articles
    .filter(
      (article) =>
        article.slug &&
        article.category?.slug &&
        !occupiedRootSlugs.has(article.category.slug) &&
        !isReservedArticleRoot(article.category.slug),
    )
    .map((article) =>
      entry(
        buildArticlePath(article.category.slug, article.slug),
        article.updatedAt || article.publishedAt,
        "monthly",
        0.7,
      ),
    );

  return [
    ...staticUrls,
    ...sportUrls,
    ...categoryUrls,
    ...brandUrls,
    ...sportBrandUrls,
    ...categoryBrandUrls,
    ...serieUrls,
    ...limitedEditionUrls,
    ...productUrls,
    ...collectionUrls,
    ...usedProductUrls,
    ...usedCategoryUrls,
    ...articleCategoryUrls,
    ...articleUrls,
  ];
}
