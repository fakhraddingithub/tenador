/**
 * src/app/api/admin/payments/[id]/reject/route.js
 *
 * POST /api/admin/payments/[id]/reject
 *
 * ادمین رسید بانکی را رد می‌کند.
 *
 * Body:
 *  {
 *    rejectReason?: string   // دلیل رد (اختیاری)
 *  }
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Payment from "base/models/Payment";
import Order from "base/models/Order";
import mongoose from "mongoose";

import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req, { params }) {
  const { actor: admin, denied } = await requireAdminPermission("payments.reject");
  if (denied) return denied;

  try {
    await connectToDB();

    const { id: paymentId } = await params;
    const body = await req.json().catch(() => ({}));
    const rejectReason = body?.rejectReason?.trim() || "";

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ message: "پرداخت یافت نشد" }, { status: 404 });
    }

    if (payment.method !== "BANK_RECEIPT") {
      return NextResponse.json(
        { message: "فقط رسیدهای بانکی قابل رد شدن هستند" },
        { status: 400 }
      );
    }

    if (payment.status === "REJECTED") {
      return NextResponse.json(
        { message: "این پرداخت قبلاً رد شده است" },
        { status: 400 }
      );
    }

    if (payment.status === "PAID") {
      return NextResponse.json(
        { message: "پرداخت تأیید شده را نمی‌توان رد کرد" },
        { status: 400 }
      );
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      return NextResponse.json({ message: "سفارش مرتبط یافت نشد" }, { status: 404 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      payment.status = "REJECTED";
      payment.bankReceipt.reviewStatus = "REJECTED";
      payment.bankReceipt.reviewedBy = admin.userId;
      payment.bankReceipt.reviewedAt = new Date();
      payment.bankReceipt.rejectReason = rejectReason;
      await payment.save({ session });

      // بررسی آیا پرداخت تأییدشده دیگری وجود دارد
      const approvedPayments = await Payment.find({
        _id: { $in: order.payments, $ne: payment._id },
        status: "PAID",
      }).lean();

      const totalPaid = approvedPayments.reduce((s, p) => s + p.amount, 0);

      if (totalPaid >= order.totalPrice) {
        order.paymentStatus = "PAID";
      } else if (totalPaid > 0) {
        order.paymentStatus = "PARTIALLY_PAID";
      } else {
        order.paymentStatus = "UNPAID";
      }

      order.reviewedBy = admin.userId;
      order.reviewedAt = new Date();
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        {
          message: "رسید با موفقیت رد شد",
          paymentStatus: order.paymentStatus,
        },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/payments/reject]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
