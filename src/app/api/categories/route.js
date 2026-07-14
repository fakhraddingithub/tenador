import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import Product from "base/models/Product";

export async function GET(req) {
  await connectToDB();

  // فیلتر اختیاری بر اساس ورزش: GET /api/categories?sportId=...
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId");

  const filter = {};
  if (sportId) filter.sport = sportId;

  const categoriesQuery = Category.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .populate('parent')
    .populate('sport', 'title name slug')
    .lean();

  const [categories, counts] = await Promise.all([
    categoriesQuery,
    sportId && mongoose.isValidObjectId(sportId)
      ? Product.aggregate([
          { $match: { sport: new mongoose.Types.ObjectId(sportId), isActive: true } },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
  const categoriesWithCounts = categories.map((category) => ({
    ...category,
    productCount: countMap.get(String(category._id)) || 0,
  }));

  return NextResponse.json({
    categories: categoriesWithCounts,
  });
}
