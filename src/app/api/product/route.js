import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import "base/models/Brand";
import "base/models/Sport";
import "base/models/Athlete";
import "base/models/Category";
import "base/models/Variant";
import Serie from "base/models/Serie";
import "base/models/LimitedEdition";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { buildTargetAudienceMatch } from "base/utils/targetAudience";
import { rankProducts, withProductSearch } from "@/lib/productSearch";

const ADMIN_LIST_FIELDS = "name slug sku mainImage basePrice isActive order brand sport category serie limitedEdition targetAudience tag color createdAt updatedAt";

// وقتی کوئریِ جستجو هست، صفحه‌بندی روی نتایجِ *رتبه‌بندی‌شده* انجام می‌شود، پس
// باید کلِ استخرِ تطابق‌ها یک‌جا خوانده شود. سقف می‌گذاریم تا کوئریِ خیلی عام
// (مثل «a») حافظه را نبلعد.
// ponytail: سقفِ ۵۰۰؛ اگر کاتالوگ خیلی بزرگ شد، رتبه‌بندی باید به aggregation
// pipeline یا Atlas Search منتقل شود — امضای همین دو تابع تغییری نمی‌کند.
const SEARCH_CANDIDATE_LIMIT = 500;

export async function GET(req) {
  try {
    await connectToDB();

    // ۱. استخراج پارامترهای آدرس URL
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get("isAdmin") === "true";
    const categoryId = searchParams.get("category"); // فیلتر بر اساس دسته‌بندی
    const sportId = searchParams.get("sport"); // فیلتر بر اساس ورزش
    const brandId = searchParams.get("brand"); // فیلتر بر اساس برند
    const serieId = searchParams.get("serie"); // فیلتر بر اساس سری
    // شامل‌کردن محصولات کل زیردرختِ سری (زیرسری‌ها در هر عمق) — opt-in تا
    // رفتار سایر مصرف‌کننده‌های پارامتر serie تغییری نکند
    const includeDescendants = searchParams.get("includeDescendants") === "true";
    const limitedEditionId = searchParams.get("limitedEdition"); // فیلتر بر اساس لیمیتد ادیشن
    const targetAudience = searchParams.get("targetAudience"); // فیلتر بر اساس مخاطب هدف
    const withVariants = searchParams.get("withVariants") === "true"; // populate واریانت‌ها
    const search = String(searchParams.get("search") || "").trim();
    const returnAll = searchParams.get("all") === "true";
    const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);
    const requestedLimit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));

    // GET عمومی است، ولی `?isAdmin=true` فیلترِ isActive را برمی‌دارد و
    // محصولات منتشرنشده را هم برمی‌گرداند — آن حالت کلیدِ دسترسی می‌خواهد.
    if (isAdmin) {
      const { denied } = await requireAdminPermission("products.view");
      if (denied) return denied;
    }

    // ۲. شرط داینامیک دیتابیس:
    // اگر ادمین بود آبجکت خالی {} (یعنی همه محصولات) و اگر نبود فقط { isActive: true }
    const query = isAdmin ? {} : { isActive: true };
    if (categoryId) query.category = categoryId;
    if (sportId) query.sport = sportId;
    if (brandId) query.brand = brandId;
    if (serieId) {
      if (includeDescendants) {
        // BFS روی parentSerie: سری داده‌شده + همه‌ی زیرسری‌ها در هر عمق
        const allSeries = await Serie.find({}).select("_id parentSerie").lean();
        const childrenByParent = new Map();
        for (const s of allSeries) {
          const p = s.parentSerie ? s.parentSerie.toString() : null;
          if (!p) continue;
          if (!childrenByParent.has(p)) childrenByParent.set(p, []);
          childrenByParent.get(p).push(s._id);
        }
        const ids = [serieId];
        const seen = new Set([String(serieId)]);
        const queue = [String(serieId)];
        while (queue.length > 0) {
          const cur = queue.shift();
          for (const childId of childrenByParent.get(cur) || []) {
            const key = childId.toString();
            if (seen.has(key)) continue;
            seen.add(key);
            ids.push(childId);
            queue.push(key);
          }
        }
        query.serie = { $in: ids };
      } else {
        query.serie = serieId;
      }
    }
    if (limitedEditionId) query.limitedEdition = limitedEditionId;
    if (targetAudience) {
      const audienceMatch = buildTargetAudienceMatch(targetAudience);
      if (!audienceMatch) {
        return NextResponse.json({ error: "مخاطب هدف نامعتبر است" }, { status: 400 });
      }
      query.targetAudience = audienceMatch;
    }
    // جستجوی توکنی و مستقل از ترتیبِ کلمات (فیلترهای بالا دست‌نخورده می‌مانند)
    const finalQuery = search ? await withProductSearch(query, search) : query;

    let productsQuery = Product.find(finalQuery)
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
    // با جستجو، skip/limit به دیتابیس داده نمی‌شود: اول رتبه‌بندی، بعد برش.
    // بدون جستجو دقیقاً همان مسیرِ قبلی (skip/limit در دیتابیس) اجرا می‌شود.
    if (isPaginated && !search) {
      productsQuery = productsQuery
        .skip((requestedPage - 1) * requestedLimit)
        .limit(requestedLimit);
    } else if (search) {
      productsQuery = productsQuery.limit(SEARCH_CANDIDATE_LIMIT);
    }

    const [matched, countedTotal] = await Promise.all([
      productsQuery.lean(),
      isPaginated && !search ? Product.countDocuments(finalQuery) : Promise.resolve(null),
    ]);

    const ranked = search ? rankProducts(search, matched || []) : matched || [];
    const total = search ? ranked.length : countedTotal;
    const products =
      isPaginated && search
        ? ranked.slice((requestedPage - 1) * requestedLimit, requestedPage * requestedLimit)
        : ranked;

    return NextResponse.json({
      products,
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
