import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";

export async function GET(req) {
  await connectToDB();
  const categories = await Category.find({})
    .sort({ order: 1, createdAt: 1 })
    .populate('parent');
  return NextResponse.json({
    categories,
  });
}