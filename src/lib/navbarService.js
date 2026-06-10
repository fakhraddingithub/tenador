import { unstable_cache } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";

// ترتیب دستی ادمین؛ آیتم‌های بدون order در انتها قرار می‌گیرند
const byOrder = (a, b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);

async function buildNavbarData() {
  await connectToDB();

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

  // اعمال ترتیب دستی ادمین روی دسته‌ها و برندهای هر ورزش
  // ($group و $addToSet ترتیب مشخصی برنمی‌گردانند)
  for (const sport of sports) {
    sport.categories.sort(byOrder);

    for (const category of sport.categories) {
      category.brands?.sort(byOrder);
    }
  }

  return sports;
}

export const getCachedNavbar = unstable_cache(
  async () => {
    const data = await buildNavbarData();
    return JSON.parse(JSON.stringify(data));
  },
  ["navbar-data"],
  { revalidate: 600, tags: ["navbar"] }
);
