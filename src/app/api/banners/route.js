import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Banner from "base/models/Banner";

// GET - دریافت همه بنرها (فقط فعال‌ها برای فرانت‌اند)
export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const adminMode = searchParams.get("admin") === "true";

    const filter = adminMode ? {} : { isActive: true };
    const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });

    return NextResponse.json({ success: true, banners });
  } catch (error) {
    console.error("GET BANNERS ERROR:", error);
    return NextResponse.json(
      { success: false, error: "خطا در دریافت بنرها" },
      { status: 500 }
    );
  }
}

// POST - ساخت بنر جدید
export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();

    const {
      position,
      template,
      title,
      subtitle,
      badge,
      ctaText,
      link,
      imageUrl,
      imagePublicId,
      colors,
      isActive,
      order,
    } = body;

    if (!position || !template) {
      return NextResponse.json(
        { success: false, error: "موقعیت و تمپلیت الزامی است" },
        { status: 400 }
      );
    }

    const banner = await Banner.create({
      position,
      template,
      title: title || "",
      subtitle: subtitle || "",
      badge: badge || "",
      ctaText: ctaText || "",
      link: link || "/",
      imageUrl: imageUrl || "",
      imagePublicId: imagePublicId || "",
      colors: colors || {},
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
    });

    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error) {
    console.error("CREATE BANNER ERROR:", error);
    return NextResponse.json(
      { success: false, error: "خطا در ساخت بنر" },
      { status: 500 }
    );
  }
}
