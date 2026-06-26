import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";

export async function GET(req) {
  await connectToDB();

  // فیلتر اختیاری بر اساس ورزش: GET /api/categories?sportId=...
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId");

  const filter = {};
  if (sportId) filter.sport = sportId;

  const categories = await Category.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .populate('parent')
    .populate('sport', 'title name slug');

  return NextResponse.json({
    categories,
  });
}