import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Collaboration from "base/models/Collaboration";

// لیست همه همکاری‌ها — برای پنل ادمین و انتخابگر محصولات
export async function GET() {
  try {
    await connectToDB();

    const collaborations = await Collaboration.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ collaborations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching collaborations:", error);
    return NextResponse.json(
      { error: "خطا در برقراری ارتباط با سرور" },
      { status: 500 }
    );
  }
}
