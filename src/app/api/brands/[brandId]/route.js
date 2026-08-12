import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { NextResponse } from "next/server";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";
import requireAdmin from "@/lib/requireAdmin";

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
    brand.articleBlocks = brand.articleBlocks || [];

    return NextResponse.json({ brand });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت برند");
  }
}

export async function PUT(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("دسترسی مدیر لازم است", 401);
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
      monochromeLogo,
      image, 
      prompts,
      articleBlocks,
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
    if (monochromeLogo !== undefined) brand.monochromeLogo = monochromeLogo.trim();
    if (image !== undefined) brand.image = image.trim();

    if (articleBlocks !== undefined) {
      const blockErrors = {};
      const sanitizedArticleBlocks = sanitizeArticleBlocks(articleBlocks, blockErrors);
      if (Object.keys(blockErrors).length > 0) {
        return apiError("بلوک‌های مینی مقاله معتبر نیستند", 400, {
          fieldErrors: blockErrors,
        });
      }
      brand.articleBlocks = sanitizedArticleBlocks;
    }

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
    return handleApiError(error, "خطا در به‌روزرسانی برند");
  }
}

export async function DELETE(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("دسترسی مدیر لازم است", 401);
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
    return handleApiError(error, "خطا در حذف برند");
  }
}
