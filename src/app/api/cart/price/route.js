/**
 * POST /api/cart/price
 *
 * دریافت لیست آیتم‌های سبد + کوپن (اختیاری) و برگرداندن قیمت نهایی تومانی.
 * قیمت همیشه سرور-ساید محاسبه می‌شود — هیچ‌وقت به قیمت ارسالی از کلاینت اعتماد نکنید.
 *
 * Request Body:
 * {
 *   items: [{ productId: string, variantId?: string, quantity: number }],
 *   couponCode?: string
 * }
 *
 * Response:
 * {
 *   items: [...],
 *   grandTotalToman: number,
 *   couponError: string | null,
 *   rate: number
 * }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import User from "base/models/User";
import Order from "base/models/Order";
import { verifyToken } from "base/utils/auth";
import { calculateCartTotal, getExchangeRate } from "base/services/pricingService";

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { items = [], couponCode = null } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "سبد خرید خالی است" }, { status: 400 });
    }

    // ─── احراز هویت (اختیاری — برای تخفیف‌های role/level) ───
    let user = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("accessToken")?.value;
      if (token) {
        const decoded = verifyToken(token);
        if (decoded?.userId) {
          user = await User.findById(decoded.userId).lean();
        }
      }
    } catch (_) {
      // کاربر لاگین نیست — ادامه بدون تخفیف شخصی
    }

    // بررسی اولین سفارش
    let isFirstOrder = false;
    if (user) {
      const prevOrders = await Order.countDocuments({ user: user._id });
      isFirstOrder = prevOrders === 0;
    }

    // ─── بارگذاری محصولات و واریانت‌ها ───
    const productIds = items.map((i) => i.productId);
    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

    const [products, variants] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).lean(),
      variantIds.length > 0 ? Variant.find({ _id: { $in: variantIds } }).lean() : [],
    ]);

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

    // ─── آماده‌سازی آیتم‌ها ───
    const cartItems = [];
    const missingProducts = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        missingProducts.push(item.productId);
        continue;
      }

      // بررسی موجودی
      const variant = item.variantId ? variantMap.get(item.variantId) : null;
      const availableStock = variant ? variant.stock : product.stock;
      const quantity = Math.min(item.quantity || 1, availableStock);

      if (quantity <= 0) continue; // ناموجود

      cartItems.push({ product, variant, quantity });
    }

    // if (cartItems.length === 0) {
    //   return NextResponse.json(
    //     { error: "هیچ محصول موجودی در سبد خرید یافت نشد" },
    //     { status: 400 }
    //   );
    // }

    // ─── محاسبه قیمت ───
    const { items: pricedItems, grandTotalToman, couponError } = await calculateCartTotal({
      cartItems,
      user,
      couponCode,
      isFirstOrder,
    });

    const rate = await getExchangeRate();

    return NextResponse.json({
      items: pricedItems,
      grandTotalToman,
      couponError,
      rate,
      missingProducts: missingProducts.length > 0 ? missingProducts : undefined,
    });
  } catch (err) {
    console.error("[cart/price]", err);
    return NextResponse.json({ error: err.message || "خطای سرور" }, { status: 500 });
  }
}
