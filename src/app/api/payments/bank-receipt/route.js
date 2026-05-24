/**
 * src/app/api/payments/bank-receipt/route.js
 *
 * ثبت پرداخت با رسید بانکی یا تعریف اقساط
 *
 * POST body:
 *  {
 *    orderId:          string,
 *    method:           "BANK_RECEIPT" | "INSTALLMENT",
 *    receiptImageUrl?: string,   // برای BANK_RECEIPT
 *    installment?: {             // برای INSTALLMENT
 *      downPaymentAmount:   number,  // پیش‌پرداخت به تومان
 *      downPaymentReceipt:  string,  // تصویر رسید پیش‌پرداخت
 *      numberOfChecks:      number,  // تعداد چک
 *      checks: [{ amount, dueDate, checkNumber? }]
 *    }
 *  }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Installment from "base/models/Installment";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, method, receiptImageUrl, installment } = body;

    // ─── اعتبارسنجی ───
    if (!orderId || !method) {
      return NextResponse.json({ message: "فیلدهای ضروری ناقص است" }, { status: 400 });
    }

    if (!["BANK_RECEIPT", "INSTALLMENT"].includes(method)) {
      return NextResponse.json({ message: "روش پرداخت معتبر نیست" }, { status: 400 });
    }

    // ─── یافتن سفارش متعلق به این کاربر ───
    const order = await Order.findOne({ _id: orderId, user: user.userId });
    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ message: "این سفارش قبلاً پرداخت شده است" }, { status: 400 });
    }

    // ─── رسید بانکی ───
    if (method === "BANK_RECEIPT") {
      if (!receiptImageUrl) {
        return NextResponse.json({ message: "تصویر رسید بانکی الزامی است" }, { status: 400 });
      }

      const payment = await Payment.create({
        order:  order._id,
        method: "BANK_RECEIPT",
        amount: order.totalPrice,
        status: "PENDING",
        bankReceipt: {
          imageUrl:     receiptImageUrl,
          uploadedAt:   new Date(),
          reviewStatus: "PENDING",
        },
      });

      order.payments.push(payment._id);
      await order.save();

      return NextResponse.json(
        { message: "رسید بانکی با موفقیت ثبت شد و در انتظار تأیید است", payment },
        { status: 201 }
      );
    }

    // ─── پرداخت اقساطی ───
    if (method === "INSTALLMENT") {
      if (!installment) {
        return NextResponse.json({ message: "اطلاعات اقساط ناقص است" }, { status: 400 });
      }

      const {
        downPaymentAmount,
        downPaymentReceipt,
        numberOfChecks,
        checks,
      } = installment;

      // اعتبارسنجی پیش‌پرداخت
      if (!downPaymentAmount || downPaymentAmount <= 0) {
        return NextResponse.json({ message: "مبلغ پیش‌پرداخت معتبر نیست" }, { status: 400 });
      }

      if (downPaymentAmount > order.totalPrice) {
        return NextResponse.json(
          { message: "پیش‌پرداخت نمی‌تواند بیشتر از مبلغ کل سفارش باشد" },
          { status: 400 }
        );
      }

      if (!downPaymentReceipt) {
        return NextResponse.json({ message: "رسید پیش‌پرداخت الزامی است" }, { status: 400 });
      }

      if (!numberOfChecks || numberOfChecks < 1 || numberOfChecks > 12) {
        return NextResponse.json(
          { message: "تعداد اقساط باید بین ۱ تا ۱۲ باشد" },
          { status: 400 }
        );
      }

      if (!Array.isArray(checks) || checks.length !== numberOfChecks) {
        return NextResponse.json(
          { message: "تعداد چک‌ها با numberOfChecks مطابقت ندارد" },
          { status: 400 }
        );
      }

      // بررسی مجموع چک‌ها
      const checksTotal = checks.reduce((s, c) => s + (c.amount || 0), 0);
      const expectedChecksTotal = order.totalPrice - downPaymentAmount;

      if (Math.abs(checksTotal - expectedChecksTotal) > 100) {
        return NextResponse.json(
          {
            message: `مجموع مبلغ چک‌ها (${checksTotal}) باید برابر با مانده سفارش (${expectedChecksTotal}) باشد`,
          },
          { status: 400 }
        );
      }

      // ثبت پرداخت پیش‌پرداخت
      const downPayment = await Payment.create({
        order:  order._id,
        method: "BANK_RECEIPT",
        amount: downPaymentAmount,
        status: "PENDING",
        bankReceipt: {
          imageUrl:     downPaymentReceipt,
          uploadedAt:   new Date(),
          reviewStatus: "PENDING",
        },
      });

      // ثبت رکورد اقساط
      const installmentDoc = await Installment.create({
        order:          order._id,
        downPayment:    downPayment._id,
        totalAmount:    order.totalPrice,
        numberOfChecks,
        status:         "PENDING",
        checks: checks.map((c) => ({
          checkNumber: c.checkNumber ?? null,
          amount:      c.amount,
          dueDate:     new Date(c.dueDate),
          status:      "PENDING",
        })),
      });

      order.payments.push(downPayment._id);
      order.paymentStatus = "PARTIALLY_PAID";
      await order.save();

      return NextResponse.json(
        {
          message:     "درخواست اقساط با موفقیت ثبت شد و در انتظار تأیید پیش‌پرداخت است",
          installment: installmentDoc,
          downPayment,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("خطا در ثبت پرداخت:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
