/**
 * src/app/api/cart/products/route.js
 *
 * یک endpoint واحد که همه داده‌های لازم CartDrawer را برمی‌گرداند:
 *  - اطلاعات نمایشی (نام، تصویر، واریانت، موجودی)
 *  - قیمت‌گذاری کامل سمت سرور (تبدیل EUR→تومان + تخفیف‌ها)
 *
 * POST body: { items: [{ productId, variantId?, quantity }] }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { getRate, computeProductPrice } from "base/services/priceEngine";
import { eurToToman } from "@/lib/Exchangerate";
import { calculateDiscount } from "base/utils/discountCalculator";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(request) {
  try {
    await connectToDB();

    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "آیتم‌های سبد خرید معتبر نیست" },
        { status: 400 },
      );
    }

    const user = await getUserFromToken();
    const rate = await getRate();

    // بارگذاری محصولات و واریانت‌ها
    const productIds = [...new Set(items.map((i) => i.productId))];
    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

    const [products, variants] = await Promise.all([
      Product.find({ _id: { $in: productIds } })
        .populate("brand", "_id name")
        .populate("category", "_id name")
        .populate("serie", "_id name")
        .lean(),
      variantIds.length
        ? Variant.find({ _id: { $in: variantIds } }).lean()
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

    // محاسبه subtotal اولیه برای قوانین cartValue
    let subtotalToman = 0;
    for (const ci of items) {
      const p = productMap.get(ci.productId);
      if (!p) continue;
      const v = ci.variantId ? variantMap.get(ci.variantId) : null;
      subtotalToman +=
        eurToToman(v?.price ?? p.basePrice ?? 0, rate) * (ci.quantity || 1);
    }

    let grandTotalToman = 0;
    let grandDiscountToman = 0;

    const enrichedItems = await Promise.all(
      items.map(async (ci) => {
        const p = productMap.get(ci.productId);
        if (!p) return null;

        const v = ci.variantId ? variantMap.get(ci.variantId) : null;
        const qty = Math.max(1, Math.floor(ci.quantity || 1));
        const eurPrice = v?.price ?? p.basePrice ?? 0;
        const basePriceToman = eurToToman(eurPrice, rate);

        // قیمت‌گذاری با تخفیف
        const priceResult = await computeProductPrice(
          p,
          rate,
          user,
          subtotalToman,
        );

        let unitFinalPrice = priceResult.finalPriceToman;
        let unitDiscount = priceResult.discountAmount;

        // اگر واریانت قیمت جداگانه دارد، درصد تخفیف را روی آن اعمال کن
        // جدید:
        if (v?.price != null) {
          const variantBase = eurToToman(v.price, rate);

          // تخفیف محصول (درصدی که priceEngine حساب کرده)
          const productDiscount = Math.floor(
            variantBase * (priceResult.discountPercent / 100),
          );

          // تخفیف اختصاصی واریانت از DiscountRule
          const { discountAmount: variantDiscount } = await calculateDiscount({
            product: {
              _id: p._id,
              category: p.category?._id ?? p.category,
              brand: p.brand?._id ?? p.brand,
              serie: p.serie?._id ?? p.serie ?? null,
              variantId: v._id,
              basePrice: eurPrice,
            },
            user,
            cartTotal: subtotalToman,
          });

          // بیشترین تخفیف برنده می‌شه
          unitDiscount = Math.min(
            Math.max(productDiscount, eurToToman(variantDiscount, rate)),
            variantBase,
          );
          unitFinalPrice = variantBase - unitDiscount;
        }

        const lineTotalToman = unitFinalPrice * qty;
        const lineDiscountToman = unitDiscount * qty;

        grandTotalToman += lineTotalToman;
        grandDiscountToman += lineDiscountToman;

        // موجودی
        const stock = v?.stock ?? p.stock ?? 0;
        const inStock = stock > 0;

        // ساختار واریانت برای نمایش
        const variantDisplay = v
          ? {
              _id: v._id,
              sku: v.sku,
              attributes:
                v.attributes instanceof Map
                  ? Object.fromEntries(v.attributes)
                  : v.attributes || {},
              images: v.images || [],
              stock: v.stock ?? 0,
            }
          : null;

        return {
          // کلیدهای شناسایی
          productId: p._id.toString(),
          variantId: v?._id?.toString() ?? null,
          quantity: qty,

          // داده‌های نمایشی محصول
          product: {
            _id: p._id.toString(),
            name: p.name,
            mainImage: p.mainImage,
            sku: p.sku,
            brand: p.brand?.name ?? null,
          },

          // داده‌های نمایشی واریانت
          variant: variantDisplay,

          // موجودی
          inStock,
          stock,

          // قیمت‌گذاری (همه به تومان)
          basePriceToman,
          unitPriceToman: unitFinalPrice, // نام سازگار با CartDrawer
          discountToman: unitDiscount,
          itemFinalToman: lineTotalToman,
          appliedRules: priceResult.appliedRules,
          hasDiscount: unitDiscount > 0,
        };
      }),
    );

    const validItems = enrichedItems.filter(Boolean);

    return NextResponse.json({
      items: validItems,
      grandTotalToman, // مجموع نهایی
      grandDiscountToman,
      rate,
    });
  } catch (error) {
    console.error("خطا در دریافت محصولات سبد خرید:", error);
    return NextResponse.json(
      { error: "خطا در دریافت اطلاعات قیمت" },
      { status: 500 },
    );
  }
}
