/**
 * src/app/api/cart/price/route.js
 *
 * محاسبه قیمت نهایی سبد خرید + اعمال کوپن
 *
 * POST body:
 *  { items: [{ productId, variantId?, quantity }], couponCode?: string }
 *
 * Response:
 *  { items, subtotalToman, discountToman, couponDiscountToman, finalTotalToman,
 *    coupon, couponError, rate }
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

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "سبد خرید خالی است" },
        { status: 400 }
      );
    }

    const user = await getUserFromToken();
    const result = await computeCartPrice(items, user, couponCode);

    return NextResponse.json(result);
  } catch (err) {
    console.error("خطا در محاسبه قیمت سبد:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
