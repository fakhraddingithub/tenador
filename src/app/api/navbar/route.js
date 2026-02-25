// app/api/navbar/route.js

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";

async function buildNavbarData() {
  await connectToDB();

  return Sport.aggregate([
    // 1️⃣ همه ورزش‌ها
    {
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        icon: 1,
      },
    },

    // 2️⃣ برای هر ورزش، دسته‌بندی‌های مرتبط از طریق Product بگیر
    {
      $lookup: {
        from: "products",
        let: { sportId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$sport", "$$sportId"] },
            },
          },
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

          // گروه‌بندی بر اساس category
          {
            $group: {
              _id: "$category._id",
              title: { $first: "$category.title" },
              slug: { $first: "$category.slug" },
              icon: { $first: "$category.icon" },
              brands: {
                $addToSet: {
                  _id: "$brand._id",
                  title: "$brand.title",
                  slug: "$brand.slug",
                  logo: "$brand.logo",
                },
              },
            },
          },
        ],
        as: "categories",
      },
    },

    // اگر محصولی نداشت، categories آرایه خالی باشه
    {
      $addFields: {
        categories: { $ifNull: ["$categories", []] },
      },
    },

    { $sort: { title: 1 } },
  ]);
}

const getCachedNavbar = unstable_cache(
  async () => buildNavbarData(),
  ["navbar-data"],
  {
    revalidate: 60 * 60,
    tags: ["navbar"],
  }
);

export async function GET() {
  const data = await getCachedNavbar();
  
  return Response.json(data);
}

export async function POST() {
  revalidateTag("navbar");
  return Response.json({ revalidated: true });
}