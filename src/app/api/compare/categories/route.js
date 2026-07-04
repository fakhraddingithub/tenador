import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";

export async function GET() {
  try {
    await connectToDB();
    const categories = await Category.find({ "technicalStats.0": { $exists: true } })
      .select("title slug icon image technicalStats")
      .sort({ order: 1 })
      .lean();

    const sanitized = categories.map((c) => ({
      _id: c._id.toString(),
      title: c.title,
      slug: c.slug,
      icon: c.icon || null,
      image: c.image || null,
      technicalStats: c.technicalStats || [],
    }));

    return NextResponse.json({ categories: sanitized });
  } catch (error) {
    console.error("Compare categories API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
