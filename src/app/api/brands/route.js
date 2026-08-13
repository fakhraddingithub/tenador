import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Brand from "base/models/Brand";

export async function GET(req) {
  await connectToDB();
  const { searchParams } = new URL(req.url);

  // انتخابگرهای سبک پنل فقط هویت برند را لازم دارند. جلوگیری از populate شدن
  // تمام سری‌ها، payload و زمان بازشدن فرم Limited Edition را پایین نگه می‌دارد.
  if (searchParams.get("compact") === "1") {
    const brands = await Brand.find({})
      .select("_id name title slug logo order")
      .sort({ order: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({ brands });
  }

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
