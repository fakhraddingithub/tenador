import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Athlete from "base/models/Athlete";
import Sport from "base/models/Sport"; 
import Brand from "base/models/Brand"; 

export const dynamic = 'force-dynamic'; // جلوگیری از کش شدن برای دریافت لیست رندوم

export async function GET() {
  try {
    await connectToDB();

    // دریافت ۵ مرد به صورت تصادفی
    const men = await Athlete.aggregate([
      { $match: { gender: "male" } },
      { $sample: { size: 5 } }
    ]);

    // دریافت ۵ زن به صورت تصادفی
    const women = await Athlete.aggregate([
      { $match: { gender: "female" } },
      { $sample: { size: 5 } }
    ]);

    // Populate کردن اطلاعات رشته ورزشی و حامیان مالی
    const populatedMen = await Athlete.populate(men, [
      { path: "sport", select: "name" },
      { path: "sponsors", select: "name logo" }
    ]);
    
    const populatedWomen = await Athlete.populate(women, [
      { path: "sport", select: "name" },
      { path: "sponsors", select: "name logo" }
    ]);

    return NextResponse.json({ men: populatedMen, women: populatedWomen });
  } catch (error) {
    console.error("Error fetching showcase athletes:", error);
    return NextResponse.json(
      { error: "خطا در دریافت لیست ورزشکاران" },
      { status: 500 }
    );
  }
}