import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { NextResponse } from "next/server";
import { revalidateContent } from "@/lib/revalidate";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { brandId } = await params;
    
    const brand = await Brand.findById(brandId).populate({
      path: "series",
      options: { sort: { order: 1, createdAt: -1 } },
    });
    
    if (!brand) {
      return NextResponse.json(
        { error: "برند پیدا نشد" },
        { status: 404 }
      );
    }

    brand.series = brand.series || [];
    brand.prompts = brand.prompts || [];

    return NextResponse.json({ brand });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { brandId } = await params;
    const body = await req.json();
   const { 
      name, 
      title, 
      country, 
      foundedYear, 
      description, 
      logo, 
      icon, 
      image, 
      prompts 
    } = body;

    const brand = await Brand.findById(brandId);
    if (!brand) {
      return NextResponse.json(
        { error: "برند پیدا نشد" },
        { status: 404 }
      );
    }

    if (name !== undefined) brand.name = name.trim();
    if (title !== undefined) brand.title = title.trim();
    if (country !== undefined) brand.country = country || null;
    if (description !== undefined) brand.description = description.trim();
    if (logo !== undefined) brand.logo = logo.trim();
    if (icon !== undefined) brand.icon = icon.trim();
    if (image !== undefined) brand.image = image.trim();

    if (prompts !== undefined && Array.isArray(prompts)) {
      brand.prompts = prompts
        .filter(p => p.field && p.context) // حذف موارد ناقص
        .map(p => ({
          field: p.field.trim(),
          context: p.context.trim()
        }));
    }

    await brand.save();

    revalidateContent(["navbar", "brands"]);

    return NextResponse.json({
      message: "برند با موفقیت به‌روزرسانی شد",
      brand,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { brandId } = await params;
    
    const brand = await Brand.findByIdAndDelete(brandId);
    if (!brand) {
      return NextResponse.json(
        { error: "برند پیدا نشد" },
        { status: 404 }
      );
    }

    revalidateContent(["navbar", "brands"]);

    return NextResponse.json({
      message: "برند با موفقیت حذف شد",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}