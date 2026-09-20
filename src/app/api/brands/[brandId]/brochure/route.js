import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { NextResponse } from "next/server";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeBrandBrochure } from "@/lib/brandBrochure";
import requireAdminPermission from "@/lib/requireAdminPermission";

/** بروشورِ برند برای ویرایشگر — شاملِ پیش‌نویس، پس پشتِ همان گیتِ ویرایشِ برند است. */
export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("brands.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { brandId } = await params;
    const brand = await Brand.findById(brandId).select("+brochure name title slug").lean();
    if (!brand) return apiError("برند پیدا نشد", 404);
    return NextResponse.json({
      brand: { _id: brand._id, name: brand.name, title: brand.title, slug: brand.slug },
      brochure: brand.brochure || { status: "draft", blocks: [] },
    });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت بروشور برند");
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("brands.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { brandId } = await params;
    const brand = await Brand.findById(brandId).select("+brochure");
    if (!brand) return apiError("برند پیدا نشد", 404);

    const errors = {};
    const brochure = sanitizeBrandBrochure(await req.json(), errors);
    if (Object.keys(errors).length > 0) {
      return apiError("محتوای بروشور معتبر نیست", 400, { fieldErrors: errors });
    }
    brand.brochure = brochure;
    await brand.save();

    revalidateContent(["navbar", "brands"]);
    // صفحه‌ی ریشه‌ی برند روی CDN کش نمی‌شود، ولی اگر بروشور روی مسیرهای ورزشی هم
    // دیده شود این پاک‌سازی لازم است؛ خارج از Vercel بی‌اثر است.
    await purgeSportPagesCdn();

    return NextResponse.json({ message: "بروشور برند ذخیره شد", brochure: brand.brochure });
  } catch (error) {
    return handleApiError(error, "خطا در ذخیره بروشور برند");
  }
}
