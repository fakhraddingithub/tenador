import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Sport from "base/models/Sport";

export async function GET(req) {
  await connectToDB();
  // lean(): بدون hydrate کردنِ سندهای Mongoose — این اندپوینت فقط برای خواندن
  // (دراپ‌داون‌ها و کارت‌های پنل) استفاده می‌شود و مدل Sport هیچ virtual ندارد.
  const sports = await Sport.find().sort({ order: 1 }).lean();
  return NextResponse.json({
    sports,
  });
}
