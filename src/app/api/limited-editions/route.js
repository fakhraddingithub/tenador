import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import LimitedEdition from "base/models/LimitedEdition";

// لیست لیمیتد ادیشن‌ها — برای پنل ادمین و انتخابگر محصولات.
// با ?brand=<brandId> فقط لیمیتد ادیشن‌های همان برند برگردانده می‌شوند.
export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");

    const query = brand ? { brand } : {};

    const limitedEditions = await LimitedEdition.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ limitedEditions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching limited editions:", error);
    return NextResponse.json(
      { error: "خطا در برقراری ارتباط با سرور" },
      { status: 500 }
    );
  }
}
