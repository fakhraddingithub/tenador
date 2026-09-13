/**
 * src/app/api/orders/webhook-success/route.js
 *
 * وب‌هوک تأیید پرداخت موفق
 *  - آپدیت وضعیت سفارش
 *  - محاسبه و واریز کردیت مربی بر اساس مدل CoachCredit
 *  - ارسال ایمیل فاکتور به مشتری و ادمین
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
import { grantAutomaticCoachCredit } from "base/services/coachWallet.service";
import { runWithOptionalTransaction } from "base/utils/mongoTransactions";

import { notifyNewPayment } from "base/services/notificationService";
import { sendOrderConfirmationEmail } from "@/lib/emailService";
import { markOrderUsedProductsSold } from "@/lib/usedProductOrderStatus";

export async function POST(req) {
  try {
    await connectToDB();

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ message: "orderId الزامی است" }, { status: 400 });
    }

    const order = await Order.findById(orderId)
      .populate("items.product", "_id name mainImage category brand serie")
      .populate("items.variant", "_id attributes images sku")
      .populate("items.flowSelections.selectedProduct", "_id name mainImage")
      .populate("user", "_id coach walletBalance email phone")
      .lean();

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    if (order.fulfillmentStatus === "CANCELED") return NextResponse.json({ message: "سفارش لغو شده است" }, { status: 409 });
    if (order.paymentStatus === "PAID") {
      await markOrderUsedProductsSold(order);
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
    await runWithOptionalTransaction(async session => {
      const fresh = await Order.findById(orderId).session(session);
      if (!fresh || fresh.fulfillmentStatus === "CANCELED") throw new Error("Order no longer payable");
      if (fresh.paymentStatus === "PAID") return;
      const paid = await Payment.find({ order: fresh._id, status: "PAID" }).session(session).lean();
      if (paid.reduce((sum, p) => sum + p.amount, 0) < fresh.totalPrice) throw new Error("Insufficient confirmed payments");
      fresh.paymentStatus = "PAID";
      fresh.fulfillmentStatus = "PROCESSING";
      fresh.coachCreditEligible = true;
      await grantAutomaticCoachCredit(fresh, session);
      await fresh.save({ session });
    });
    await markOrderUsedProductsSold(order);

    // ─── اعلان تأیید پرداخت برای پنل مدیریت (غیرمسدودکننده) ───
    // چون این endpoint در صورت PAID بودن زودتر return می‌کند، اعلان تکراری ساخته نمی‌شود.
    await notifyNewPayment(order);

    // ─── ارسال ایمیل فاکتور ───
    try {
      const customerEmail = order.user?.email ?? null;
      await sendOrderConfirmationEmail(order, customerEmail);
    } catch (emailErr) {
      // خطای ایمیل نباید روند اصلی را متوقف کند
      console.error("خطا در ارسال ایمیل:", emailErr);
    }

    return NextResponse.json(
      {
        message:   "پرداخت تأیید و سفارش پردازش شد",
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
