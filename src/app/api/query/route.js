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
      serie: null, // ✨ اضافه شد
      product: null,
    };

    // ----------- ۱) پردازش Query Params (اولویت اول) -----------
    const { searchParams } = new URL(req.url);
    // ✨ "serie" به آرایه entities اضافه شد
    const entities = ["brand", "sport", "athlete", "category", "serie", "product"]; 
    const models = { 
      brand: Brand, 
      sport: Sport, 
      athlete: Athlete, 
      category: Category, 
      serie: Serie, // ✨ اضافه شد
      product: Product 
    };

    for (const entity of entities) {
      const querySlug = searchParams.get(entity);
      if (querySlug) {
        search[entity] = await models[entity].findOne({ slug: querySlug }).lean();
      }
    }

    // ----------- ۲) پردازش Slugs هوشمند (اولویت دوم) -----------
    // این بخش به ترتیب اسلاگ‌های آرایه را در مدل‌های مختلف جستجو می‌کند
    for (const slug of slugArray) {
      for (const entity of entities) {
        if (!search[entity]) {
          const doc = await models[entity].findOne({ slug }).lean();
          if (doc) {
            search[entity] = doc;
            break; // اگر در این مدل پیدا شد، برو سراغ اسلاگ بعدی در آرایه اصلی
          }
        }
      }
    }

    // ----------- ۳) محاسبات آماری پیشرفته (تعداد محصولات) -----------
    let brandStats = null;

    if (search.brand) {
      // الف) شمارش کل محصولات متعلق به این برند
      const totalBrandProducts = await Product.countDocuments({ brand: search.brand._id });

      // ب) دریافت تمام سری‌های این برند و شمارش محصولات هر کدام
      // ما برند را دوباره پیدا می‌کنیم تا سری‌های populate شده را بگیریم
      const fullBrand = await Brand.findById(search.brand._id)
        .populate("series")
        .lean();

      const seriesWithCounts = await Promise.all(
        (fullBrand.series || []).map(async (serie) => {
          const count = await Product.countDocuments({ serie: serie._id });
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
    const finalFilter = {};
    if (search.brand) finalFilter.brand = search.brand._id;
    if (search.sport) finalFilter.sport = search.sport._id;
    if (search.athlete) finalFilter.athlete = search.athlete._id;
    if (search.category) finalFilter.category = search.category._id;
    if (search.serie) finalFilter.serie = search.serie._id; // ✨ اضافه شد
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
        serie: search.serie, // ✨ اضافه شد
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