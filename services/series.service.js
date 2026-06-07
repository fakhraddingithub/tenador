import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Sport from "base/models/Sport";

/**
 * دریافت سری‌های مرتبط با یک ورزش
 * فقط سری‌هایی که حداقل یک محصول دارند
 */
async function _getSeriesBySport(sportSlug) {
  await connectToDB();

  const sport = await Sport.findOne({
    slug: sportSlug,
  })
    .select("_id")
    .lean();

  if (!sport) return [];

  const results = await Product.aggregate([
    // ─────────────────────────────────────────
    // فقط محصولات این ورزش که سری دارند
    // ─────────────────────────────────────────
    {
      $match: {
        sport: sport._id,
        serie: {
          $exists: true,
          $ne: null,
        },
      },
    },

    // ─────────────────────────────────────────
    // join serie
    // ─────────────────────────────────────────
    {
      $lookup: {
        from: "series",
        localField: "serie",
        foreignField: "_id",
        as: "serieDoc",
      },
    },

    {
      $unwind: "$serieDoc",
    },

    // ─────────────────────────────────────────
    // فقط level 1
    // ─────────────────────────────────────────
    {
      $match: {
        "serieDoc.level": 1,
      },
    },

    // ─────────────────────────────────────────
    // join brand
    // ─────────────────────────────────────────
    {
      $lookup: {
        from: "brands",
        localField: "serieDoc.brand",
        foreignField: "_id",
        as: "brandDoc",
      },
    },

    {
      $unwind: {
        path: "$brandDoc",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ─────────────────────────────────────────
    // join parent serie
    // ─────────────────────────────────────────
    {
      $lookup: {
        from: "series",
        localField: "serieDoc.parentSerie",
        foreignField: "_id",
        as: "parentSerieDoc",
      },
    },

    {
      $unwind: {
        path: "$parentSerieDoc",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ─────────────────────────────────────────
    // group
    // ─────────────────────────────────────────
    {
      $group: {
        _id: "$serieDoc._id",

        // serie
        name: { $first: "$serieDoc.name" },
        title: { $first: "$serieDoc.title" },
        description: { $first: "$serieDoc.description" },

        slug: { $first: "$serieDoc.slug" },

        image: { $first: "$serieDoc.image" },
        headImage: { $first: "$serieDoc.headImage" },

        logo: { $first: "$serieDoc.logo" },

        colors: { $first: "$serieDoc.colors" },

        level: { $first: "$serieDoc.level" },

        isLimitedEdition: {
          $first: "$serieDoc.isLimitedEdition",
        },

        createdAt: { $first: "$serieDoc.createdAt" },
        updatedAt: { $first: "$serieDoc.updatedAt" },

        // parent serie
        parentSerie: {
          $first: {
            _id: "$parentSerieDoc._id",
            title: "$parentSerieDoc.title",
            slug: "$parentSerieDoc.slug",
            image: "$parentSerieDoc.image",
          },
        },

        // brand
        brand: {
          $first: {
            _id: "$brandDoc._id",
            title: "$brandDoc.title",
            slug: "$brandDoc.slug",
            logo: "$brandDoc.logo",
            image: "$brandDoc.image",
          },
        },

        // stats
        productCount: {
          $sum: 1,
        },
      },
    },

    // ─────────────────────────────────────────
    // sort
    // ─────────────────────────────────────────
    {
      $sort: {
        productCount: -1,
      },
    },
  ]);

  return results.map((serie) => ({
    _id: serie._id.toString(),

    name: serie.name || "",
    title: serie.title || "",
    description: serie.description || "",

    slug: serie.slug || "",

    image: serie.image || "",
    headImage: serie.headImage || "",

    logo: serie.logo || "",

    colors: serie.colors || {
      primary: "",
      secondary: "",
    },

    level: serie.level || 0,

    isLimitedEdition:
      serie.isLimitedEdition || false,

    productCount: serie.productCount || 0,

    createdAt: serie.createdAt || null,
    updatedAt: serie.updatedAt || null,

    parentSerie: serie.parentSerie?._id
      ? {
          _id: serie.parentSerie._id.toString(),
          title: serie.parentSerie.title || "",
          slug: serie.parentSerie.slug || "",
          image: serie.parentSerie.image || "",
        }
      : null,

    brand: serie.brand?._id
      ? {
          _id: serie.brand._id.toString(),
          title: serie.brand.title || "",
          slug: serie.brand.slug || "",
          logo: serie.brand.logo || "",
          image: serie.brand.image || "",
        }
      : null,
  }));
}

export const getSeriesBySport = unstable_cache(
  _getSeriesBySport,
  ["series-by-sport"],
  { revalidate: 300, tags: ["products", "series", "sports"] }
);