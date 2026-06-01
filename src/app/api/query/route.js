import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";

// وارد کردن تمام مدل‌ها برای جلوگیری از MissingSchemaError
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Product from "base/models/Product";
import Category from "base/models/Category";
import Serie from "base/models/Serie";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const slugArray = body.slugs || [];

    // مخزن ذخیره موجودیت‌های یافت شده
    const search = {
      brand: null,
      sport: null,
      athlete: null,
      category: null,
      serie: null,
      product: null,
    };

    // ----------- ۱) پردازش Query Params (اولویت اول) -----------
    const { searchParams } = new URL(req.url);
    const entities = ["brand", "sport", "athlete", "category", "serie", "product"]; 
    const models = { 
      brand: Brand, 
      sport: Sport, 
      athlete: Athlete, 
      category: Category, 
      serie: Serie, 
      product: Product 
    };

    for (const entity of entities) {
      const querySlug = searchParams.get(entity);
      if (querySlug) {
        const conditions = { slug: querySlug };
        // ✨ اگر موجودیت درخواستی محصول بود، حتماً باید فعال باشد
        if (entity === "product") {
          conditions.isActive = true;
        }
        search[entity] = await models[entity].findOne(conditions).lean();
      }
    }

    // ----------- ۲) پردازش Slugs هوشمند (اولویت دوم) -----------
    for (const slug of slugArray) {
      for (const entity of entities) {
        if (!search[entity]) {
          const conditions = { slug };
          // ✨ در جستجوی هوشمند اسلاگ نیز فقط محصولات فعال بررسی شوند
          if (entity === "product") {
            conditions.isActive = true;
          }
          
          const doc = await models[entity].findOne(conditions).lean();
          if (doc) {
            search[entity] = doc;
            break; 
          }
        }
      }
    }

    // ----------- ۳) محاسبات آماری پیشرفته (تعداد محصولات) -----------
    let brandStats = null;

    if (search.brand) {
      // الف) شمارش کل محصولات متعلق به این برند
      // ✨ شرط isActive: true اضافه شد تا محصولات غیرفعال شمرده نشوند
      const totalBrandProducts = await Product.countDocuments({ 
        brand: search.brand._id, 
        isActive: true 
      });

      // ب) دریافت تمام سری‌های این برند و شمارش محصولات هر کدام
      const fullBrand = await Brand.findById(search.brand._id)
        .populate("series")
        .lean();

      const seriesWithCounts = await Promise.all(
        (fullBrand.series || []).map(async (serie) => {
          // ✨ شرط isActive: true برای شمارش دقیق محصولات فعال هر سری اضافه شد
          const count = await Product.countDocuments({ 
            serie: serie._id, 
            isActive: true 
          });
          return {
            ...serie,
            productCount: count
          };
        })
      );

      brandStats = {
        ...search.brand,
        totalProductCount: totalBrandProducts,
        series: seriesWithCounts
      };
    }

    // ----------- ۴) ساخت فیلتر نهایی برای کوئری محصولات -----------
    const finalFilter = {
      isActive: true // ✨ فیلتر اصلی همیشه روی محصولات فعال (true) قفل شد
    };
    
    if (search.brand) finalFilter.brand = search.brand._id;
    if (search.sport) finalFilter.sport = search.sport._id;
    if (search.athlete) finalFilter.athlete = search.athlete._id;
    if (search.category) finalFilter.category = search.category._id;
    if (search.serie) finalFilter.serie = search.serie._id; 
    if (search.product) finalFilter._id = search.product._id;

    // ----------- ۵) اجرای کوئری نهایی محصولات -----------
    const products = await Product.find(finalFilter)
      .populate("brand sport athlete category serie")
      .sort({ createdAt: -1 }) // جدیدترین‌ها اول
      .lean();

    // ----------- ۶) پاسخ نهایی -----------
    return NextResponse.json({
      filters: {
        brand: brandStats || search.brand,
        sport: search.sport,
        athlete: search.athlete,
        category: search.category,
        serie: search.serie, 
        product: search.product,
      },
      results: products,
      totalResults: products.length
    }, { status: 200 });

  } catch (error) {
    console.error("❌ API ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}