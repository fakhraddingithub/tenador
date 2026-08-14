import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import Product from "base/models/Product";
import { buildCategorySportMatch } from "base/utils/categorySportVisibility";

export async function GET(req) {
  await connectToDB();

  // فیلتر اختیاری بر اساس ورزش: GET /api/categories?sportId=...
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId");

  if (sportId && !mongoose.isValidObjectId(sportId)) {
    return NextResponse.json({ error: "شناسه ورزش نامعتبر است" }, { status: 400 });
  }

  const sportOid = sportId ? new mongoose.Types.ObjectId(sportId) : null;
  const filter = sportOid ? buildCategorySportMatch(sportOid) : {};

  const categoriesQuery = Category.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .populate('parent')
    .populate('sport', 'title name slug')
    .populate('additionalSports', 'title name slug')
    .lean();

  const categories = await categoriesQuery;
  let counts = [];
  if (sportOid) {
    const sharedIds = [];
    const legacyIds = [];
    for (const category of categories) {
      const target = category.additionalSports?.length ? sharedIds : legacyIds;
      target.push(category._id);
    }

    const [legacyCounts, sharedCounts] = await Promise.all([
      legacyIds.length
        ? Product.aggregate([
            {
              $match: {
                sport: sportOid,
                category: { $in: legacyIds },
                isActive: true,
              },
            },
            { $group: { _id: "$category", count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      sharedIds.length
        ? Product.aggregate([
            { $match: { category: { $in: sharedIds }, isActive: true } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
    ]);
    counts = [...legacyCounts, ...sharedCounts];
  }
  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
  const categoriesWithCounts = categories.map((category) => ({
    ...category,
    productCount: countMap.get(String(category._id)) || 0,
  }));

  return NextResponse.json({
    categories: categoriesWithCounts,
  });
}
