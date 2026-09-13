import { grantAutomaticCoachCredit } from "base/services/coachWallet.service";
import "base/models/registerModels";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Payment from "base/models/Payment";
import Order from "base/models/Order";
import { notifyNewPayment } from "base/services/notificationService";
import mongoose from "mongoose";
import { markOrderUsedProductsSold } from "@/lib/usedProductOrderStatus";

import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req, { params }) {
  // `actor` همان شکلِ خروجیِ گیتِ قدیمی را دارد، پس ردپای ممیزی دست‌نخورده
  // می‌ماند و یک کوئریِ اضافیِ هر-درخواست هم حذف می‌شود.
  const { actor: admin, denied } = await requireAdminPermission("payments.approve");
  if (denied) return denied;

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

    let payment = await Payment.findById(paymentId);
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
      const processedOrder = await Order.findById(payment.order);
      if (processedOrder?.paymentStatus === "PAID") {
        await markOrderUsedProductsSold(processedOrder);
      }
      return NextResponse.json(
        { message: "این پرداخت قبلاً تأیید شده است" },
        { status: 400 },
      );
    }

    let order = await Order.findById(payment.order);
    if (!order) {
      return NextResponse.json(
        { message: "سفارش مرتبط یافت نشد" },
        { status: 404 },
      );
    }

    if (order.fulfillmentStatus === "CANCELED") return NextResponse.json({ message: "سفارش لغو شده قابل تأیید پرداخت نیست" }, { status: 409 });
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Read inside the write transaction so concurrent refunds/approvals conflict.
      payment = await Payment.findById(paymentId).session(session);
      order = payment && await Order.findById(payment.order).session(session);
      if (!order || payment.status === "PAID" || order.fulfillmentStatus === "CANCELED") {
        await session.abortTransaction();
        await session.endSession();
        return NextResponse.json({ message: "وضعیت سفارش یا پرداخت تغییر کرده است؛ صفحه را تازه کنید" }, { status: 409 });
      }

      const previousApproved = await Payment.find({ order: order._id, _id: { $ne: payment._id }, status: "PAID" }).session(session).lean();
      const newTotal = previousApproved.reduce((sum, p) => sum + p.amount, 0) + parsedAmount;
      const isFullyPaid = newTotal >= order.totalPrice;

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
      order.coachCreditEligible = true;
      await grantAutomaticCoachCredit(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      if (isFullyPaid) {
        await markOrderUsedProductsSold(order);
      }

      // برای پرداخت‌های قدیمی که پیش از ایجاد اعلان ثبت شده‌اند fallback است؛
      // پرداخت‌های جدید به‌کمک payment id اعلان تکراری نمی‌سازند.
      await notifyNewPayment(order, payment, { confirmed: true });

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
