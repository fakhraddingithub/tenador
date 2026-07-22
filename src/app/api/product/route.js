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
import requireAdmin from "@/lib/requireAdmin";

const ADMIN_LIST_FIELDS = "name slug sku mainImage basePrice isActive order brand sport category serie limitedEdition createdAt updatedAt";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  try {
    await connectToDB();

    // ۱. استخراج پارامترهای آدرس URL
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get("isAdmin") === "true";
    const categoryId = searchParams.get("category"); // فیلتر بر اساس دسته‌بندی
    const serieId = searchParams.get("serie"); // فیلتر بر اساس سری
    const limitedEditionId = searchParams.get("limitedEdition"); // فیلتر بر اساس لیمیتد ادیشن
    const withVariants = searchParams.get("withVariants") === "true"; // populate واریانت‌ها
    const search = String(searchParams.get("search") || "").trim();
    const returnAll = searchParams.get("all") === "true";
    const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);
    const requestedLimit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));

    if (isAdmin && !(await requireAdmin())) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
    }

    // ۲. شرط داینامیک دیتابیس:
    // اگر ادمین بود آبجکت خالی {} (یعنی همه محصولات) و اگر نبود فقط { isActive: true }
    const query = isAdmin ? {} : { isActive: true };
    if (categoryId) query.category = categoryId;
    if (serieId) query.serie = serieId;
    if (limitedEditionId) query.limitedEdition = limitedEditionId;
    if (search) query.name = { $regex: escapeRegExp(search), $options: "i" };

    let productsQuery = Product.find(query)
      .select(isAdmin ? ADMIN_LIST_FIELDS : undefined)
      .populate('brand', 'name title slug icon')
      .populate('sport', 'name title slug')
      .populate('athlete', 'name title slug')
      // با withVariants (انتخاب محصول در مودال فرایند سفارش) تعریف ویژگی‌های دسته هم
      // لازم است: برچسب واریانت‌ها (labelMap) و ساخت فیلترهای پویا از همین‌ها ساخته می‌شوند.
      .populate('category', withVariants ? 'name title slug attributes variantAttributes' : 'name title slug')
      .populate('serie', 'name title slug')
      .populate('limitedEdition', 'name title slug')
      .sort({ order: 1, createdAt: -1 });

    if (withVariants) productsQuery = productsQuery.populate('variants');

    const isPaginated = isAdmin && !returnAll;
    if (isPaginated) {
      productsQuery = productsQuery
        .skip((requestedPage - 1) * requestedLimit)
        .limit(requestedLimit);
    }

    const [products, total] = await Promise.all([
      productsQuery.lean(),
      isPaginated ? Product.countDocuments(query) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      products: products || [],
      ...(isPaginated && {
        pagination: {
          page: requestedPage,
          limit: requestedLimit,
          total,
          totalPages: Math.max(1, Math.ceil(total / requestedLimit)),
        },
      }),
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
