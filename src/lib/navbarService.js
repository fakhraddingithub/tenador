import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import Product from "base/models/Product";
import Serie from "base/models/Serie";

// ترتیب دستی ادمین؛ آیتم‌های بدون order در انتها قرار می‌گیرند
const byOrder = (a, b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);

const VALID_GENDERS = ["men", "women", "kids"];

async function buildNavbarData() {
  await connectToDB();

  // ───────────────────────────────────────────────────────────────────────
  // ۱) ورزش‌ها + دسته‌بندی‌ها (به همراه برندهای هر دسته برای منوی موبایل) +
  //    فیلدِ parent برای ساختِ درختِ والد/فرزندِ ستونِ دوم.
  // ───────────────────────────────────────────────────────────────────────
  const sports = await Sport.aggregate([
    {
      $project: { _id: 1, title: 1, slug: 1, icon: 1, order: 1 },
    },
    {
      $lookup: {
        from: "products",
        let: { sportId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$sport", "$$sportId"] } } },
          {
            $lookup: {
              from: "categories",
              localField: "category",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: "$category" },
          {
            $lookup: {
              from: "brands",
              localField: "brand",
              foreignField: "_id",
              as: "brand",
            },
          },
          { $unwind: "$brand" },
          {
            $group: {
              _id: "$category._id",
              title: { $first: "$category.title" },
              slug: { $first: "$category.slug" },
              icon: { $first: "$category.icon" },
              order: { $first: "$category.order" },
              parent: { $first: "$category.parent" }, // برای درختِ والد/فرزند
              brands: {
                $addToSet: {
                  _id: "$brand._id",
                  title: "$brand.title",
                  slug: "$brand.slug",
                  icon: "$brand.icon",
                  order: "$brand.order",
                },
              },
            },
          },
        ],
        as: "categories",
      },
    },
    { $addFields: { categories: { $ifNull: ["$categories", []] } } },
    { $sort: { order: 1 } },
  ]);

  // ───────────────────────────────────────────────────────────────────────
  // ۲) برندهای سطحِ ورزش (ستون‌های ۳ و ۴) با availableGenders و شناسه‌ی سری‌ها.
  //    یک aggregation — بدونِ N+1.
  // ───────────────────────────────────────────────────────────────────────
  const brandAgg = await Product.aggregate([
    { $match: { isActive: true, sport: { $ne: null }, brand: { $ne: null } } },
    {
      $group: {
        _id: { sport: "$sport", brand: "$brand" },
        genders: { $addToSet: "$gender" },
        serieIds: { $addToSet: "$serie" },
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "_id.brand",
        foreignField: "_id",
        as: "brand",
      },
    },
    { $unwind: "$brand" },
    {
      $group: {
        _id: "$_id.sport",
        brands: {
          $push: {
            _id: "$brand._id",
            title: "$brand.title",
            slug: "$brand.slug",
            icon: "$brand.icon",
            order: "$brand.order",
            genders: "$genders",
            serieIds: "$serieIds",
          },
        },
      },
    },
  ]);

  const brandsBySport = new Map(
    brandAgg.map((row) => [row._id.toString(), row.brands]),
  );

  // ───────────────────────────────────────────────────────────────────────
  // ۳) همه‌ی سری‌ها یک‌بار بارگذاری می‌شوند؛ نگاشتِ «هر سری → سری ریشه (level 0)»
  //    در حافظه ساخته می‌شود (rollup) تا برای هر برند فقط سری‌های ریشه نمایش یابند.
  // ───────────────────────────────────────────────────────────────────────
  const allSeries = await Serie.find({})
    .select("_id title name slug parentSerie level order brand")
    .lean();

  const serieById = new Map(allSeries.map((s) => [s._id.toString(), s]));
  const rootCache = new Map();
  const rootIdFor = (id) => {
    const key = id?.toString();
    if (!key) return null;
    if (rootCache.has(key)) return rootCache.get(key);
    let cur = serieById.get(key);
    const seen = new Set();
    while (cur && cur.parentSerie && !seen.has(cur._id.toString())) {
      seen.add(cur._id.toString());
      const parent = serieById.get(cur.parentSerie.toString());
      if (!parent) break;
      cur = parent;
    }
    const rid = cur ? cur._id.toString() : null;
    rootCache.set(key, rid);
    return rid;
  };

  // ───────────────────────────────────────────────────────────────────────
  // ۴) پاک‌سازیِ genders، استخراجِ سری‌های ریشه‌ی هر برند، و چسباندن به هر ورزش.
  // ───────────────────────────────────────────────────────────────────────
  for (const sport of sports) {
    sport.categories.sort(byOrder);
    for (const category of sport.categories) {
      category.brands?.sort(byOrder);
    }

    const brands = brandsBySport.get(sport._id.toString()) || [];
    for (const brand of brands) {
      brand.availableGenders = (brand.genders || []).filter((g) =>
        VALID_GENDERS.includes(g),
      );
      delete brand.genders;

      // فقط سری‌های ریشه (level 0) متعلق به همین برند که محصول دارند
      const roots = new Map();
      for (const sid of brand.serieIds || []) {
        if (!sid) continue;
        const rid = rootIdFor(sid.toString());
        if (!rid) continue;
        const root = serieById.get(rid);
        if (
          root &&
          String(root.brand) === String(brand._id) &&
          !roots.has(rid)
        ) {
          roots.set(rid, {
            _id: root._id,
            title: root.title || root.name || "",
            slug: root.slug || null,
            order: root.order ?? 0,
          });
        }
      }
      brand.series = Array.from(roots.values()).sort(byOrder);
      delete brand.serieIds;
    }
    brands.sort(byOrder);
    sport.brands = brands;
  }

  return sports;
}

export const getCachedNavbar = unstable_cache(
  async () => {
    const data = await buildNavbarData();
    return JSON.parse(JSON.stringify(data));
  },
  ["navbar-data"],
  { revalidate: 600, tags: ["navbar"] },
);
