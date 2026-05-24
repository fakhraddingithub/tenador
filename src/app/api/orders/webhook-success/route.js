/**
 * src/app/api/orders/webhook-success/route.js
 *
 * وب‌هوک تأیید پرداخت موفق
 *  - آپدیت وضعیت سفارش
 *  - محاسبه و واریز کردیت مربی بر اساس مدل CoachCredit
 *  - این endpoint باید پس از تأیید نهایی پرداخت توسط درگاه صدا زده شود
 *
 * POST body (internal/از callback درگاه):
 *  { orderId: string }
 *
 * ⚠️  این endpoint باید با یک secret header محافظت شود در محیط production
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import User from "base/models/User";
import { computeCoachCredit } from "base/services/priceEngine";

export async function POST(req) {
  try {
    await connectToDB();

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ message: "orderId الزامی است" }, { status: 400 });
    }

    const order = await Order.findById(orderId)
      .populate("items.product", "_id category brand serie")
      .populate("user", "_id coach walletBalance")
      .lean();

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ message: "سفارش قبلاً پردازش شده است" }, { status: 200 });
    }

    // ─── بررسی واقعی مجموع پرداخت‌های تأییدشده ───
    const payments = await Payment.find({
      order:  order._id,
      status: "PAID",
    }).lean();

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    if (totalPaid < order.totalPrice) {
      return NextResponse.json(
        { message: `مبلغ پرداختی (${totalPaid}) کمتر از مبلغ سفارش (${order.totalPrice}) است` },
        { status: 400 }
      );
    }

    // ─── آپدیت وضعیت سفارش ───
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus:     "PAID",
      fulfillmentStatus: "PROCESSING",
    });

    // ─── محاسبه کردیت مربی ───
    const buyer = order.user;
    if (buyer?.coach) {
      const creditItems = order.items.map((item) => ({
        productId:  item.product?._id?.toString() ?? item.product?.toString(),
        categoryId: item.product?.category?.toString(),
        serieId:    item.product?.serie?.toString(),
        lineTotalToman: item.unitPrice * item.quantity,
      }));

      const creditAmount = await computeCoachCredit(
        buyer.coach.toString(),
        creditItems
      );

      if (creditAmount > 0) {
        await User.findByIdAndUpdate(buyer.coach, {
          $inc: { walletBalance: creditAmount },
        });

        console.log(
          `کردیت مربی ${buyer.coach} — مبلغ: ${creditAmount} تومان — سفارش: ${orderId}`
        );
      }
    }

    return NextResponse.json(
      {
        message:       "پرداخت تأیید و سفارش پردازش شد",
        orderId,
        totalPaid,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("خطا در webhook-success:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
