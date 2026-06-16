import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import connectToDB from "base/configs/db";
import Payment from "base/models/Payment";
import Order from "base/models/Order";
import { notifyNewPayment } from "base/services/notificationService";
import mongoose from "mongoose";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

export async function POST(req, { params }) {
  try {
    await connectToDB();

    const { id: paymentId } = await params;
    const body = await req.json();
    const { confirmedAmount } = body;

    // اعتبارسنجی مبلغ
    if (confirmedAmount === undefined || confirmedAmount === null) {
      return NextResponse.json(
        { message: "مبلغ تأیید‌شده الزامی است" },
        { status: 400 },
      );
    }

    const parsedAmount = Number(confirmedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { message: "مبلغ تأیید‌شده باید عددی مثبت باشد" },
        { status: 400 },
      );
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ message: "پرداخت یافت نشد" }, { status: 404 });
    }

    if (payment.method !== "BANK_RECEIPT") {
      return NextResponse.json(
        { message: "فقط پرداخت‌های رسید بانکی را می‌توان تأیید کرد" },
        { status: 400 },
      );
    }

    if (payment.status === "PAID") {
      return NextResponse.json(
        { message: "این پرداخت قبلاً تأیید شده است" },
        { status: 400 },
      );
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      return NextResponse.json(
        { message: "سفارش مرتبط یافت نشد" },
        { status: 404 },
      );
    }

    // محاسبه مجموع پرداخت‌های قبلی تأییدشده (به‌جز همین پرداخت)
    const previousApproved = await Payment.find({
      _id: { $in: order.payments, $ne: payment._id },
      status: "PAID",
    }).lean();
    const alreadyPaidTotal = previousApproved.reduce((s, p) => s + p.amount, 0);
    const newTotal = alreadyPaidTotal + parsedAmount;
    const isFullyPaid = newTotal >= order.totalPrice;

    const session = await mongoose.startSession();
    session.startTransaction();

    const admin = await getAdminUser();

    try {
      // بروزرسانی پرداخت با مبلغ تأیید‌شده
      payment.amount = parsedAmount;
      payment.status = "PAID";
      payment.bankReceipt.reviewStatus = "APPROVED";
      payment.bankReceipt.reviewedBy = admin.userId;
      payment.bankReceipt.reviewedAt = new Date();
      await payment.save({ session });

      // بروزرسانی سفارش
      order.paymentStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID";
      if (isFullyPaid) {
        order.fulfillmentStatus = "PROCESSING";
      }
      order.reviewedBy = admin.userId;
      order.reviewedAt = new Date();
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      // اعلان تأیید پرداخت برای پنل مدیریت (مسیر رسید بانکی).
      // webhook-success به‌دلیل PAID بودن سفارش زودتر return می‌کند و اعلان تکراری نمی‌سازد.
      if (isFullyPaid) {
        await notifyNewPayment(order);
      }

      // webhook کردیت مربی (پس از commit)
      if (isFullyPaid) {
        fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/orders/webhook-success`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": process.env.WEBHOOK_SECRET || "",
            },
            body: JSON.stringify({ orderId: order._id }),
          },
        ).catch((e) => console.error("[approve webhook]", e));
      }

      return NextResponse.json(
        {
          message: "پرداخت با موفقیت تأیید شد",
          confirmedAmount: parsedAmount,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          isFullyPaid,
          totalPaid: newTotal,
          orderTotal: order.totalPrice,
        },
        { status: 200 },
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/payments/approve]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
