/**
 * src/app/api/cart/price/route.js
 *
 * محاسبه قیمت نهایی سبد خرید — با پشتیبانی از محصولات دست‌دوم
 *
 * POST body:
 *  {
 *    items: [
 *      { productId, variantId?, quantity }
 *      { usedProductId, quantity: 1, itemType: "used_product" }
 *    ],
 *    couponCode?
 *  }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import { computeCartPrice } from "base/services/priceEngine";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const items      = body.items      || [];
    const couponCode = body.couponCode || body.coupon || null;

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "سبد خرید خالی است" }, { status: 400 });

    // normalize
    const normalizedItems = items.map((i) => {
      if (i.itemType === "used_product" || i.usedProductId) {
        return { usedProductId: String(i.usedProductId), quantity: 1, itemType: "used" };
      }
      return {
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity:  Math.max(1, Math.floor(i.quantity || 1)),
        ...(Array.isArray(i.flowSelections) && i.flowSelections.length > 0
          ? { flowSelections: i.flowSelections }
          : {}),
      };
    });

    const user = await getUserFromToken();

    let result;
    try {
      result = await computeCartPrice(normalizedItems, user, couponCode);
    } catch (err) {
      return NextResponse.json({ error: err.message || "خطا در محاسبه قیمت" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("خطا در محاسبه قیمت سبد:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}