// app/api/compare/best-in-category/route.js
import { NextResponse } from 'next/server';
import connectToDB from 'base/configs/db'; // مسیر اتصال به دیتابیس خود را تنظیم کنید
import Product from 'base/models/Product';  // مدل محصول شما
import Category from 'base/models/Category'; // مدل دسته بندی شما

export async function GET(request) {
  try {
    await connectToDB();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) return NextResponse.json({ bests: {} }, { status: 400 });

    const category = await Category.findById(categoryId).lean();
    if (!category || !category.technicalStats) return NextResponse.json({ bests: {} });

    const bests = {};

    // برای هر شاخص فنی، محصولی که بیشترین امتیاز را دارد پیدا می‌کنیم
    for (const stat of category.technicalStats) {
      const bestProduct = await Product.findOne({ category: categoryId })
        .sort({ [`technicalStats.${stat.name}`]: -1 }) // مرتب‌سازی نزولی بر اساس امتیاز شاخص
        .select('title name mainImage technicalStats')
        .populate('category', 'title technicalStats')
        .lean();

      if (bestProduct) {
        bests[stat.name] = {
          product: bestProduct,
          score: bestProduct.technicalStats?.[stat.name] || 0,
          label: stat.label
        };
      }
    }

    return NextResponse.json({ bests }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}