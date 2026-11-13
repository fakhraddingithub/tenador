/**
 * src/app/api/checkout/route.js
 *
 * ثبت نهایی سفارش همراه با پرداخت — سفارش فقط زمانی ساخته می‌شود که
 * پرداخت (رسید بانکی) یا درخواست اقساط به‌طور کامل ثبت شده باشد.
 *
 * این روت فقط خریدار را از کوکی می‌شناسد؛ خودِ ساختِ سفارش در
 * services/placeOrder.js است (شکلِ بدنه همان‌جا مستند شده) تا «ایجاد سفارش»
 * پنل ادمین هم از همان مسیر بگذرد.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "base/utils/auth";
import { placeOrder } from "base/services/placeOrder";

export async function POST(req) {
  try {
    const token = (await cookies()).get("accessToken")?.value;
    const user = token ? verifyToken(token) || null : null;
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }
    return await placeOrder(user, await req.json());
  } catch (error) {
    console.error("خطا در ثبت نهایی سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
