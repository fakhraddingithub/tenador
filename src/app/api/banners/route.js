import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Banner from "base/models/Banner";
import { revalidateContent } from "@/lib/revalidate";

export async function GET(req) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const adminMode = searchParams.get("admin") === "true";
    const filter = adminMode ? {} : { isActive: true };
    const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
    return NextResponse.json({ success: true, banners });
  } catch (error) {
    return NextResponse.json({ success: false, error: "خطا در دریافت بنرها" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();
    const { position, template, title, subtitle, badge, ctaText, link,
            images, imagePids, colors, isActive, order } = body;

    if (!position || !template) {
      return NextResponse.json({ success: false, error: "موقعیت و تمپلیت الزامی است" }, { status: 400 });
    }

    const banner = await Banner.create({
      position, template,
      title: title || "", subtitle: subtitle || "",
      badge: badge || "", ctaText: ctaText || "",
      link: link || "/",
      images:    images    || {},
      imagePids: imagePids || {},
      colors:    colors    || {},
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
    });

    revalidateContent(["banners"]);

    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error) {
    console.error("CREATE BANNER ERROR:", error);
    return NextResponse.json({ success: false, error: "خطا در ساخت بنر" }, { status: 500 });
  }
}
