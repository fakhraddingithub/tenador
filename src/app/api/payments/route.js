/**
 * src/app/api/payments/route.js
 *
 * GET → لیست همه‌ی پرداخت‌های کاربر (رسید بانکی + آنلاین)
 *
 * هر پرداخت با خلاصه‌ی سفارشِ مرتبط غنی‌سازی می‌شود (شماره پیگیری، مبلغ کل،
 * وضعیت سفارش، مبلغ پرداخت‌شده و مانده). مالکیت با محدودکردن پرداخت‌ها به
 * سفارش‌های همین کاربر تضمین می‌شود — هیچ پرداختِ سفارشِ کاربر دیگری برنمی‌گردد.
 *
 * مانده‌ی هر سفارش = مبلغ کل − مجموع پرداخت‌های تأییدشده (status === "PAID")
 * دقیقاً هم‌راستا با منطق مسیرهای تأیید/رد ادمین و ثبت رسید بانکی.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Order from "base/models/Order";
import Payment from "base/models/Payment";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET() {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    // ─── سفارش‌های کاربر (فقط فیلدهای موردنیاز برای خلاصه) ───
    const orders = await Order.find({ user: user.userId })
      .select(
        "trackingCode totalPrice paymentStatus fulfillmentStatus paymentMethod createdAt",
      )
      .lean();

    if (!orders.length) {
      return NextResponse.json({ payments: [] }, { status: 200 });
    }

    const orderIds = orders.map((o) => o._id);

    // ─── همه‌ی پرداخت‌های این سفارش‌ها ───
    // چون فقط پرداخت‌هایی که order آن‌ها در سفارش‌های کاربر است برمی‌گردد،
    // مالکیت به‌صورت خودکار اعمال می‌شود.
    const payments = await Payment.find({ order: { $in: orderIds } })
      .sort({ createdAt: -1 })
      .lean();

    // مجموع پرداخت‌های تأییدشده به تفکیک سفارش (برای محاسبه‌ی مانده)
    const paidByOrder = new Map();
    for (const p of payments) {
      if (p.status === "PAID") {
        const key = String(p.order);
        paidByOrder.set(key, (paidByOrder.get(key) || 0) + (Number(p.amount) || 0));
      }
    }

    const orderMap = new Map(orders.map((o) => [String(o._id), o]));

    const enriched = payments.map((p) => {
      const o = orderMap.get(String(p.order));
      const paidAmount = o ? paidByOrder.get(String(o._id)) || 0 : 0;
      const remaining = o ? Math.max(0, (o.totalPrice || 0) - paidAmount) : 0;

      return {
        ...p,
        order: o
          ? {
              _id: o._id,
              trackingCode: o.trackingCode,
              totalPrice: o.totalPrice,
              paymentStatus: o.paymentStatus,
              fulfillmentStatus: o.fulfillmentStatus,
              paymentMethod: o.paymentMethod,
              createdAt: o.createdAt,
              paidAmount,
              remaining,
            }
          : null,
      };
    });

    return NextResponse.json({ payments: enriched }, { status: 200 });
  } catch (error) {
    console.error("[GET Payments Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت پرداخت‌ها" },
      { status: 500 },
    );
  }
}
