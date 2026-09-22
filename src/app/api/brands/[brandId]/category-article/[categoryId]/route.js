import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Category from "base/models/Category";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { purgeSportPagesCdn, revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import { sanitizeArticleBlocks } from "@/lib/articleValidation";
import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * مینی‌مقاله‌ی «برند در یک دسته» روی صفحه‌ی خودش.
 *
 * داده همان `Brand.categoryArticles[]` است و *دسته، هویتِ ورودی است* — پس این
 * مسیر فقط ورودیِ همان دسته را می‌خواند و می‌نویسد و به بقیه‌ی ورودی‌ها دست
 * نمی‌زند. آرایه‌ی خالی یعنی «این مینی‌مقاله را بردار»، که همان قاعده‌ی
 * sanitizeBrandCategoryArticles است (ورودیِ بی‌بلوک نگه داشته نمی‌شود).
 */
const sameCategory = (entry, categoryId) => String(entry?.category) === String(categoryId);

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("brands.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { brandId, categoryId } = await params;
    if (!mongoose.isValidObjectId(categoryId)) return apiError("شناسه دسته معتبر نیست", 400);

    const [brand, category] = await Promise.all([
      Brand.findById(brandId).select("+categoryArticles name title slug").lean(),
      Category.findById(categoryId).select("name title slug sport").populate("sport", "slug name title").lean(),
    ]);
    if (!brand) return apiError("برند پیدا نشد", 404);
    if (!category) return apiError("دسته‌بندی پیدا نشد", 404);

    const entry = (brand.categoryArticles || []).find((item) => sameCategory(item, categoryId));
    return NextResponse.json({
      brand: { _id: brand._id, name: brand.name, title: brand.title, slug: brand.slug },
      category: { _id: category._id, name: category.name, title: category.title, slug: category.slug, sport: category.sport },
      blocks: entry?.blocks || [],
    });
  } catch (error) {
    return handleApiError(error, "خطا در دریافت مینی‌مقاله دسته");
  }
}

export async function PUT(req, { params }) {
  const { denied } = await requireAdminPermission("brands.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const { brandId, categoryId } = await params;
    if (!mongoose.isValidObjectId(categoryId)) return apiError("شناسه دسته معتبر نیست", 400);

    const brand = await Brand.findById(brandId).select("+categoryArticles");
    if (!brand) return apiError("برند پیدا نشد", 404);
    if (!(await Category.exists({ _id: categoryId }))) return apiError("دسته‌بندی پیدا نشد", 404);

    const body = await req.json();
    if (body?.blocks === undefined) return apiError("بلوکی ارسال نشده است", 400);

    const errors = {};
    const blocks = sanitizeArticleBlocks(body.blocks, errors);
    if (Object.keys(errors).length > 0) return apiError("محتوای مینی‌مقاله معتبر نیست", 400, { fieldErrors: errors });

    const others = (brand.categoryArticles || []).filter((item) => !sameCategory(item, categoryId));
    // ورودیِ بدونِ بلوک اصلاً نگه داشته نمی‌شود — همان قاعده‌ی فرمِ برند.
    brand.categoryArticles = blocks.length ? [...others, { category: categoryId, blocks }] : others;
    await brand.save();

    revalidateContent(["navbar", "brands", "products", "categories"]);
    // صفحه‌ی برند+دسته زیرِ مسیرهای ورزشی است و یک ساعت روی CDN کش می‌شود.
    await purgeSportPagesCdn();

    return NextResponse.json({ message: "مینی‌مقاله دسته ذخیره شد", blocks });
  } catch (error) {
    return handleApiError(error, "خطا در ذخیره مینی‌مقاله دسته");
  }
}
