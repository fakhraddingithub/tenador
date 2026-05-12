import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

import Sport from "base/models/Sport";

export async function GET(req) {
  await connectToDB();
  const sports = await Sport.find().sort({ order: 1 });
  return NextResponse.json({
    sports,
  });
}
