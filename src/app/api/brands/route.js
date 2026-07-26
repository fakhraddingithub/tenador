import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Brand from "base/models/Brand";

export async function GET(req) {
  await connectToDB();
  // lean(): مدل‌های Brand و Serie هیچ virtual ندارند، پس خروجیِ JSON یکسان است
  // و هزینه‌ی hydrate کردنِ سندها حذف می‌شود.
  const brands = await Brand.find({})
    .sort({ order: 1, createdAt: 1 })
    .populate({ path: "series", options: { sort: { order: 1, createdAt: -1 } } })
    .lean();
  return NextResponse.json({
    brands,
  });
}
