// app/api/compare/search/route.js
import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db'; // مسیر اتصال به دیتابیس خود را تنظیم کنید
import Product from 'base/models/Product';  // مدل محصول شما
import Category from 'base/models/Category'; // مدل دسته بندی شما

export async function GET(request) {
  try {
    await connectToDB();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const categoryId = searchParams.get('categoryId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (!q || q.length < 2) {
      return NextResponse.json({ products: [] }, { status: 200 });
    }

    // ساخت کوئری جستجو (برای سرعت بالا فقط 5 نتیجه اول برمیگردد)
    // محصولات غیرفعال (isActive: false) نباید در نتایج جستجو ظاهر شوند.
    const query = { name: { $regex: q, $options: 'i' } };
    if (!includeInactive) {
      query.isActive = true;
    }
    
    // محدود کردن جستجو به دسته بندی محصول اول
    if (categoryId) query.category = categoryId;

    // واکشی سریع محصولات به همراه اطلاعات دسته بندی (برای ساختار شاخص ها)
    const products = await Product.find(query)
      .select('slug mainImage category technicalStats name color') // فقط فیلدهای مورد نیاز
      .populate({
        path: 'category',
        select: 'title technicalStats',
      })
      .limit(5)
      .lean(); // lean برای سرعت بالا (خروجی json خالص)


      const sanitizedProducts = products.map(p => ({
        ...p,
        technicalStats: p.technicalStats ? p.technicalStats : []
      }));
      
      return NextResponse.json({ products: sanitizedProducts });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}