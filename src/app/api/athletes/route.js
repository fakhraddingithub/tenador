import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Athlete from "base/models/Athlete";

export async function GET(req) {
  await connectToDB();
  // lean(): مدل Athlete هیچ virtual ندارد — خروجیِ JSON بدون تغییر می‌ماند.
  const athletes = await Athlete.find({}).populate('sport').lean();
  return NextResponse.json({
    athletes,
  });
}