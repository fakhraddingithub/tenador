import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Brand from "base/models/Brand";

export async function GET(req) {
  await connectToDB();
  const brands = await Brand.find({})
    .sort({ order: 1, createdAt: 1 })
    .populate("series");
  return NextResponse.json({
    brands,
  });
}
