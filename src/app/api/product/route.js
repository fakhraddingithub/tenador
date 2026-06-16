import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import "base/models/Brand";
import "base/models/Sport";
import "base/models/Athlete";
import "base/models/Category";
import "base/models/Variant";
import "base/models/Serie";
import "base/models/LimitedEdition";

export async function GET(req) {
  try {
    await connectToDB();

    // ۱. استخراج پارامترهای آدرس URL
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get("isAdmin") === "true";
    const categoryId = searchParams.get("category"); // فیلتر بر اساس دسته‌بندی
    const limitedEditionId = searchParams.get("limitedEdition"); // فیلتر بر اساس لیمیتد ادیشن
    const withVariants = searchParams.get("withVariants") === "true"; // populate واریانت‌ها

    // ۲. شرط داینامیک دیتابیس:
    // اگر ادمین بود آبجکت خالی {} (یعنی همه محصولات) و اگر نبود فقط { isActive: true }
    const query = isAdmin ? {} : { isActive: true };
    if (categoryId) query.category = categoryId;
    if (limitedEditionId) query.limitedEdition = limitedEditionId;

    let productsQuery = Product.find(query)
      .populate('brand')
      .populate('sport')
      .populate('athlete')
      .populate('category')
      .populate('serie')
      .populate('limitedEdition');

    if (withVariants) productsQuery = productsQuery.populate('variants');

    const products = await productsQuery.lean();

    return NextResponse.json({
      products: products || [],
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        error: 'خطا در دریافت محصولات',
        detail: error.message,
        products: [],
      },
      { status: 500 }
    );
  }
}