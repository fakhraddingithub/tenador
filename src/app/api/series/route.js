import { NextResponse } from "next/server";
import connectToDB from "base/configs/db"; // تابع اتصال به دیتابیس خودتان
import Serie from "base/models/Serie";    // مدل Mongoose مربوط به سری‌ها

export async function GET(req) {
  try {
    await connectToDB();

    // استخراج پارامترهای کوئری از URL
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brand");

    // فیلتر بر اساس برند (اگر brandId ارسال شده باشد)
    const filter = brandId ? { brand: brandId } : {};

    // واکشی سری‌ها (فقط فیلدهای مورد نیاز برای سبک شدن پاسخ)
    const series = await Serie.find(filter)
      .select("_id name title") 
      .sort({ createdAt: -1 });

    return NextResponse.json({ series }, { status: 200 });
  } catch (error) {
    console.error("Error fetching series:", error);
    return NextResponse.json(
      { error: "خطا در برقراری ارتباط با سرور" },
      { status: 500 }
    );
  }
}