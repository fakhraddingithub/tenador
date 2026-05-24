/**
 * POST /api/cart/products
 *
 * اطلاعات کامل محصولات سبد خرید را با قیمت تومانی به‌روز برمی‌گرداند.
 * این endpoint فقط اطلاعات نمایشی است — قیمت نهایی معتبر از /api/cart/price می‌آید.
 *
 * Request Body:
 * {
 *   items: [{ productId: string, variantId?: string, quantity: number }]
 * }
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getExchangeRate, eurToToman } from "base/services/pricingService";

export async function POST(request) {
  try {
    await connectToDB();

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "آیتم‌های سبد خرید معتبر نیست" },
        { status: 400 }
      );
    }

    // دریافت نرخ تبدیل از سرویس مرکزی
    const rate = await getExchangeRate();

    const productIds = items.map((item) => item.productId).filter(Boolean);
    const variantIds = items.filter((item) => item.variantId).map((item) => item.variantId);

    const [products, variants] = await Promise.all([
      Product.find({ _id: { $in: productIds } })
        .populate("brand", "name logo")
        .populate("category", "name")
        .lean(),
      variantIds.length > 0
        ? Variant.find({ _id: { $in: variantIds } }).lean()
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

    const enrichedItems = items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;

        const variant = item.variantId ? variantMap.get(item.variantId) : null;

        // قیمت پایه تومانی
        const basePriceToman = eurToToman(product.basePrice || 0, rate);
        // قیمت واریانت (اگر وجود دارد)
        const variantPriceToman = variant ? eurToToman(variant.price || 0, rate) : null;
        // قیمت نمایشی (بدون تخفیف — فقط برای نمایش اولیه)
        const displayPriceToman = variantPriceToman ?? basePriceToman;

        // موجودی واقعی
        const stock = variant ? variant.stock : product.stock;

        return {
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: Math.min(item.quantity || 1, Math.max(stock, 0)),
          product: {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            mainImage: product.mainImage,
            label: product.label,
            brand: product.brand,
            category: product.category,
            stock: product.stock,
            basePriceToman, // قیمت یورو تبدیل‌شده
          },
          variant: variant
            ? {
                _id: variant._id,
                sku: variant.sku,
                attributes: variant.attributes || [],
                priceToman: variantPriceToman,
                stock: variant.stock,
              }
            : null,
          displayPriceToman,
          inStock: stock > 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: enrichedItems, rate });
  } catch (error) {
    console.error("[cart/products]", error);
    return NextResponse.json(
      { error: "خطا در دریافت اطلاعات محصولات" },
      { status: 500 }
    );
  }
}
