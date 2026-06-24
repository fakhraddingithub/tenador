/**
 * POST /api/admin/installments/[id]/confirm-order
 *
 * دروازه‌ی تأیید صریحِ سفارشِ اقساطی توسط ادمین.
 *
 * سفارش اقساطی پس از ثبت در وضعیت WAITING می‌ماند و وارد مرحله‌ی پردازش/ارسال
 * نمی‌شود تا ادمین چک‌ها و پیش‌پرداخت را بازبینی و این endpoint را صدا بزند.
 *
 * پیش‌شرط: پیش‌پرداخت باید تأیید (PAID) شده باشد.
 * اثر: order.fulfillmentStatus → PROCESSING و ثبت orderConfirmedAt/By روی اقساط.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin from "@/lib/requireAdmin";
import Installment from "base/models/Installment";
import Payment from "base/models/Payment";
import Order from "base/models/Order";

export async function POST(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    await connectToDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "شناسه نامعتبر است" }, { status: 400 });
    }

    const installment = await Installment.findById(id);
    if (!installment) {
      return NextResponse.json({ message: "طرح اقساط یافت نشد" }, { status: 404 });
    }

    const order = await Order.findById(installment.order);
    if (!order) {
      return NextResponse.json({ message: "سفارش مرتبط یافت نشد" }, { status: 404 });
    }

    if (order.fulfillmentStatus === "CANCELED") {
      return NextResponse.json(
        { message: "سفارش لغو شده را نمی‌توان تأیید کرد" },
        { status: 400 }
      );
    }

    // پیش‌شرط: پیش‌پرداخت تأیید شده باشد
    const downPayment = await Payment.findById(installment.downPayment).lean();
    if (!downPayment || downPayment.status !== "PAID") {
      return NextResponse.json(
        { message: "ابتدا باید رسید پیش‌پرداخت را تأیید کنید" },
        { status: 400 }
      );
    }

    // ثبت تأیید روی اقساط
    installment.orderConfirmedAt = new Date();
    installment.orderConfirmedBy = admin._id;
    await installment.save();

    // ورود سفارش به مرحله‌ی پردازش (فقط اگر هنوز در مراحل ابتدایی است)
    if (["WAITING", "NEEDS_PURCHASE"].includes(order.fulfillmentStatus)) {
      order.fulfillmentStatus = "PROCESSING";
      order.reviewedBy = admin._id;
      order.reviewedAt = new Date();
      await order.save();
    }

    return NextResponse.json(
      {
        message: "سفارش اقساطی تأیید شد و وارد مرحله‌ی پردازش شد",
        fulfillmentStatus: order.fulfillmentStatus,
        orderConfirmedAt: installment.orderConfirmedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/installments/:id/confirm-order]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
