/**
 * POST /api/admin/payments/[id]/approve
 *
 * ادمین رسید بانکی را تأیید می‌کند.
 * بعد از تأیید:
 *  1. Payment → PAID
 *  2. Order → PAID (اگر کل مبلغ پرداخت شده باشد)
 *  3. webhook کردیت مربی
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import connectToDB from "base/configs/db";
import Payment from "base/models/Payment";
import Order from "base/models/Order";
import mongoose from "mongoose";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return decoded;
}

export async function POST(req, { params }) {
  try {
    await connectToDB();

    const auth = await getAuthUser();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: paymentId } = params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ message: "پرداخت یافت نشد" }, { status: 404 });
    }

    if (payment.method !== "BANK_RECEIPT") {
      return NextResponse.json(
        { message: "فقط پرداخت‌های رسید بانکی را می‌توان تأیید کرد" },
        { status: 400 }
      );
    }

    if (payment.status === "PAID") {
      return NextResponse.json(
        { message: "این پرداخت قبلاً تأیید شده است" },
        { status: 400 }
      );
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    /* محاسبه مجموع پرداختی‌های تأیید شده */
    const approvedPayments = await Payment.find({
      _id: { $in: order.payments },
      status: "PAID",
    }).lean();
    const alreadyPaid = approvedPayments.reduce((s, p) => s + p.amount, 0);
    const newTotal = alreadyPaid + payment.amount;

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    try {
      payment.status = "PAID";
      payment.bankReceipt.reviewStatus = "APPROVED";
      payment.bankReceipt.reviewedBy = auth.userId;
      payment.bankReceipt.reviewedAt = new Date();
      await payment.save({ session: dbSession });

      const isFullyPaid = newTotal >= order.totalPrice;

      if (isFullyPaid) {
        order.paymentStatus = "PAID";
        order.fulfillmentStatus = "PROCESSING";
        order.reviewedBy = auth.userId;
        order.reviewedAt = new Date();
      } else {
        order.paymentStatus = "PARTIALLY_PAID";
      }

      await order.save({ session: dbSession });

      await dbSession.commitTransaction();
      dbSession.endSession();

      /* webhook کردیت مربی */
      if (isFullyPaid) {
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/orders/webhook-success`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": process.env.WEBHOOK_SECRET || "",
          },
          body: JSON.stringify({ orderId: order._id }),
        }).catch((e) => console.error("[approve webhook]", e));
      }

      return NextResponse.json(
        {
          message: "پرداخت با موفقیت تأیید شد",
          paymentStatus: order.paymentStatus,
        },
        { status: 200 }
      );
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/payments/approve]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
