/**
 * POST /api/payments/bank-receipt
 *
 * ثبت پرداخت با رسید بانکی (نقدی یا قسطی).
 * امنیت:
 *  - مبلغ از سفارش خوانده می‌شود، نه از کلاینت
 *  - سفارش باید متعلق به کاربر فعلی باشد
 *  - وضعیت سفارش باید UNPAID یا PARTIALLY_PAID باشد
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Installment from "base/models/Installment";
import mongoose from "mongoose";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return decoded;
}

export async function POST(req) {
  try {
    await connectToDB();

    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      orderId,
      receiptImageUrl,
      // برای اقساط:
      isInstallment = false,
      downPaymentAmount, // مبلغ پیش‌پرداخت (تومان) — فقط برای اقساط
      numberOfChecks,    // تعداد چک
      checks,            // [{ amount, dueDate }]
    } = body;

    /* ── اعتبارسنجی پایه ── */
    if (!orderId) {
      return NextResponse.json({ message: "شناسه سفارش الزامی است" }, { status: 400 });
    }
    if (!receiptImageUrl) {
      return NextResponse.json({ message: "تصویر رسید الزامی است" }, { status: 400 });
    }

    /* ── یافتن سفارش ── */
    const order = await Order.findOne({
      _id: orderId,
      user: auth.userId,
    });

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    if (!["UNPAID", "PARTIALLY_PAID"].includes(order.paymentStatus)) {
      return NextResponse.json(
        { message: "این سفارش قابل پرداخت نیست" },
        { status: 400 }
      );
    }

    /* ── محاسبه مبلغی که باید پرداخت شود ── */
    const alreadyPaid = order.payments?.length
      ? (
          await Payment.find({
            _id: { $in: order.payments },
            status: "PAID",
          }).lean()
        ).reduce((s, p) => s + p.amount, 0)
      : 0;

    const remainingAmount = order.totalPrice - alreadyPaid;

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { message: "مبلغ سفارش قبلاً پرداخت شده است" },
        { status: 400 }
      );
    }

    /* ── پرداخت اقساطی ── */
    if (isInstallment || order.paymentMethod === "INSTALLMENT") {
      if (!downPaymentAmount || !numberOfChecks || !checks?.length) {
        return NextResponse.json(
          { message: "اطلاعات اقساط ناقص است (پیش‌پرداخت، تعداد و اطلاعات چک‌ها)" },
          { status: 400 }
        );
      }

      if (downPaymentAmount > remainingAmount) {
        return NextResponse.json(
          { message: "مبلغ پیش‌پرداخت بیشتر از مانده سفارش است" },
          { status: 400 }
        );
      }

      /* بررسی جمع چک‌ها + پیش‌پرداخت = مانده */
      const checksTotal = checks.reduce((s, c) => s + (c.amount || 0), 0);
      const expectedTotal = Math.round(downPaymentAmount + checksTotal);
      if (Math.abs(expectedTotal - remainingAmount) > 10) {
        // تلرانس ۱۰ تومان برای گرد کردن
        return NextResponse.json(
          {
            message: `جمع پیش‌پرداخت و چک‌ها (${expectedTotal.toLocaleString("fa-IR")} تومان) با مانده سفارش (${remainingAmount.toLocaleString("fa-IR")} تومان) مطابقت ندارد`,
          },
          { status: 400 }
        );
      }

      if (numberOfChecks !== checks.length) {
        return NextResponse.json(
          { message: "تعداد چک‌ها با اطلاعات ارسالی مطابقت ندارد" },
          { status: 400 }
        );
      }

      /* ── شروع تراکنش ── */
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        /* پرداخت پیش‌پرداخت */
        const [downPayment] = await Payment.create(
          [
            {
              order: order._id,
              method: "BANK_RECEIPT",
              amount: downPaymentAmount,
              status: "PENDING",
              bankReceipt: {
                imageUrl: receiptImageUrl,
                uploadedAt: new Date(),
                reviewStatus: "PENDING",
              },
            },
          ],
          { session }
        );

        /* ایجاد رکورد Installment */
        await Installment.create(
          [
            {
              order: order._id,
              downPayment: downPayment._id,
              totalAmount: remainingAmount,
              numberOfChecks,
              status: "PENDING",
              checks: checks.map((c) => ({
                amount: c.amount,
                dueDate: new Date(c.dueDate),
                status: "PENDING",
              })),
            },
          ],
          { session }
        );

        /* آپدیت سفارش */
        order.payments.push(downPayment._id);
        order.paymentStatus = "PARTIALLY_PAID";
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        return NextResponse.json(
          {
            message: "اقساط با موفقیت ثبت شد",
            paymentId: downPayment._id,
          },
          { status: 201 }
        );
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }

    /* ── پرداخت نقدی کامل ── */
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [payment] = await Payment.create(
        [
          {
            order: order._id,
            method: "BANK_RECEIPT",
            amount: remainingAmount,
            status: "PENDING",
            bankReceipt: {
              imageUrl: receiptImageUrl,
              uploadedAt: new Date(),
              reviewStatus: "PENDING",
            },
          },
        ],
        { session }
      );

      order.payments.push(payment._id);
      // وضعیت PAID تنها زمانی تغییر می‌کند که ادمین رسید را تأیید کند
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        {
          message: "رسید بانکی با موفقیت ثبت شد و در انتظار تأیید است",
          paymentId: payment._id,
        },
        { status: 201 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[payments/bank-receipt]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
