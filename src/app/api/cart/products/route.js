import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getCachedRate, eurToToman } from "@/lib/Exchangerate";

export async function POST(request) {
  try {
    await connectToDB();

    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "آیتم‌های سبد خرید معتبر نیست" },
        { status: 400 }
      );
    }

    // دریافت نرخ تبدیل
    const rate = await getCachedRate();

    // دریافت اطلاعات محصولات
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate("brand")
      .populate("category")
      .lean();

    // دریافت اطلاعات واریانت‌ها
    const variantIds = items
      .filter((item) => item.variantId)
      .map((item) => item.variantId);
    
    const variants = variantIds.length > 0
      ? await Variant.find({ _id: { $in: variantIds } }).lean()
      : [];

    // ترکیب اطلاعات
    const enrichedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId);
      
      if (!product) return null;

      let variant = null;
      let price = eurToToman(product.basePrice, rate);

      if (item.variantId) {
        variant = variants.find((v) => v._id.toString() === item.variantId);
        if (variant) {
          price = eurToToman(variant.price, rate);
        }
      }

      return {
        ...item,
        product: {
          ...product,
          basePrice: eurToToman(product.basePrice, rate),
        },
        variant: variant ? {
          ...variant,
          price: eurToToman(variant.price, rate),
        } : null,
        currentPrice: price,
      };
    }).filter(Boolean);

    return NextResponse.json({ items: enrichedItems });
  } catch (error) {
    console.error("خطا در دریافت محصولات سبد خرید:", error);
    return NextResponse.json(
      { error: "خطا در دریافت اطلاعات" },
      { status: 500 }
    );
  }
}