import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Sport from "base/models/Sport";
import Brand from "base/models/Brand"; // مدل اسپانسر را وارد کنید
import { buildAthleteAiTemplate } from "@/lib/aiAthleteTemplate";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req) {
  const { denied } = await requireAdminPermission("ai.athletePrompt");
  if (denied) return denied;

  try {
    await connectToDB();
    const { rawContent } = await req.json();

    if (!rawContent) {
      return NextResponse.json({ error: "متن خام الزامی است" }, { status: 400 });
    }

    // ۱. دریافت همزمان لیست ورزش‌ها و اسپانسرها از دیتابیس
    // فقط فیلدهای مورد نیاز را می‌گیریم تا پرامپت خیلی سنگین نشود
    const [sports, Brands] = await Promise.all([
      Sport.find({}, "_id name"),
      Brand.find({}, "_id name brandEn") 
    ]);

    // ۲. ارسال هر دو لیست به تابع قالب‌ساز پرامپت
    const prompt = buildAthleteAiTemplate({ 
      sports, 
      sponsors:Brands, 
      rawContent 
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("AI Prompt Error:", error);
    return NextResponse.json({ error: "خطا در ایجاد پرامپت هوشمند" }, { status: 500 });
  }
}