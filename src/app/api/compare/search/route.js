// app/api/compare/search/route.js
import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db'; // مسیر اتصال به دیتابیس خود را تنظیم کنید
import Product from 'base/models/Product';  // مدل محصول شما
import Category from 'base/models/Category'; // مدل دسته بندی شما
import { rankProducts, withProductSearch } from '@/lib/productSearch';

// چند برابرِ سقفِ نمایش واکشی می‌شود تا رتبه‌بندی روی یک استخرِ معنادار انجام
// شود، نه روی ۵ تای اولِ تصادفیِ دیتابیس.
const RESULT_LIMIT = 5;
const CANDIDATE_LIMIT = 60;

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

    // محصولات غیرفعال (isActive: false) نباید در نتایج جستجو ظاهر شوند.
    const base = {};
    if (!includeInactive) {
      base.isActive = true;
    }

    // محدود کردن جستجو به دسته بندی محصول اول
    if (categoryId) base.category = categoryId;

    // جستجوی توکنی: ترتیبِ کلمات و نقطه‌گذاری مهم نیست، برند هم حساب می‌شود
    const query = await withProductSearch(base, q);

    // واکشی سریع محصولات به همراه اطلاعات دسته بندی (برای ساختار شاخص ها)
    const products = await Product.find(query)
      .select('slug mainImage category technicalStats name color sku tag brand serie')
      .populate({
        path: 'category',
        select: 'title technicalStats',
      })
      .populate('brand', 'title name')
      .populate('serie', 'title name')
      .limit(CANDIDATE_LIMIT)
      .lean(); // lean برای سرعت بالا (خروجی json خالص)

      const sanitizedProducts = rankProducts(q, products)
        .slice(0, RESULT_LIMIT)
        .map(p => ({
          ...p,
          technicalStats: p.technicalStats ? p.technicalStats : []
        }));

      return NextResponse.json({ products: sanitizedProducts });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
  }
}