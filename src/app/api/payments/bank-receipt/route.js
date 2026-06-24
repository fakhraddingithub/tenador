/**
 * src/app/api/payments/bank-receipt/route.js
 *
 * ثبت پرداخت با رسید بانکی یا تعریف اقساط
 * + رزرو محصولات دست‌دوم پس از ثبت پرداخت
 * + پشتیبانی از چند تصویر رسید
 *
 * POST body:
 *  {
 *    orderId:           string,
 *    method:            "BANK_RECEIPT" | "INSTALLMENT",
 *    receiptImageUrls?: string[],  // آرایه‌ای از URLها (BANK_RECEIPT)
 *    installment?: {
 *      downPaymentAmount:          number,
 *      downPaymentReceiptUrls:     string[],  // آرایه‌ای از URLها
 *      numberOfChecks:             number,
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
import UsedProduct from "base/models/UsedProduct";
import User from "base/models/User";
import { sendOrderConfirmationEmail } from "@/lib/emailService";
import { INSTALLMENT_MONTHLY_INTEREST_RATE } from "@/lib/constants";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

/** آیتم‌های دست‌دوم یک سفارش را رزرو می‌کند */
async function reserveUsedProducts(order) {
  const usedItems = order.items.filter(
    (i) => i.itemType === "used_product" && i.usedProduct,
  );
  for (const item of usedItems) {
    await UsedProduct.findByIdAndUpdate(item.usedProduct, {
      status: "reserved",
      order:  order._id,
    });
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { orderId, method, receiptImageUrls, installment } = body;

    // ─── اعتبارسنجی پایه ───
    if (!orderId || !method) {
      return NextResponse.json(
        { message: "فیلدهای ضروری ناقص است" },
        { status: 400 },
      );
    }

    if (!["BANK_RECEIPT", "INSTALLMENT"].includes(method)) {
      return NextResponse.json(
        { message: "روش پرداخت معتبر نیست" },
        { status: 400 },
      );
    }

    // ─── یافتن سفارش ───
    const order = await Order.findOne({ _id: orderId, user: user.userId });
    if (!order) {
      return NextResponse.json(
        { message: "سفارش یافت نشد" },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { message: "این سفارش قبلاً پرداخت شده است" },
        { status: 400 },
      );
    }

    // ════════════════════════════════════════
    //  رسید بانکی
    // ════════════════════════════════════════
    if (method === "BANK_RECEIPT") {

      // پشتیبانی از آرایه یا رشته تکی (backward compatible)
      const imageUrls = Array.isArray(receiptImageUrls)
        ? receiptImageUrls.filter(Boolean)
        : receiptImageUrls
          ? [receiptImageUrls]
          : [];

      if (imageUrls.length === 0) {
        return NextResponse.json(
          { message: "حداقل یک تصویر رسید بانکی الزامی است" },
          { status: 400 },
        );
      }

      if (imageUrls.length > 5) {
        return NextResponse.json(
          { message: "حداکثر ۵ تصویر رسید مجاز است" },
          { status: 400 },
        );
      }
      const payment = await Payment.create({
        order:  order._id,
        method: "BANK_RECEIPT",
        amount: order.totalPrice,
        status: "PENDING",
        bankReceipt: {
          imageUrls,                    // ← آرایه URLها
          uploadedAt:   new Date(),
          reviewStatus: "PENDING",
        },
      });

      order.payments.push(payment._id);
      await order.save();

      // ─── رزرو محصولات دست‌دوم ───
      await reserveUsedProducts(order);

      // ─── ارسال ایمیل فاکتور ───
      try {
        const populatedOrder = await Order.findById(order._id)
          .populate("items.product", "_id name mainImage")
          .populate("items.variant", "_id attributes images sku")
          .populate("items.flowSelections.selectedProduct", "_id name mainImage")
          .lean();

        const userDoc = await User.findById(user.userId)
          .select("email")
          .lean();

        await sendOrderConfirmationEmail(
          populatedOrder,
          userDoc?.email ?? null,
        );
      } catch (emailErr) {
        console.error("خطا در ارسال ایمیل:", emailErr);
      }

      return NextResponse.json(
        {
          message: "رسید بانکی با موفقیت ثبت شد و در انتظار تأیید است",
          payment,
        },
        { status: 201 },
      );
    }

    // ════════════════════════════════════════
    //  پرداخت اقساطی
    // ════════════════════════════════════════
    if (method === "INSTALLMENT") {
      if (!installment) {
        return NextResponse.json(
          { message: "اطلاعات اقساط ناقص است" },
          { status: 400 },
        );
      }

      const {
        downPaymentAmount,
        downPaymentReceiptUrls,
        numberOfChecks,
        checks,
      } = installment;

      // ─── اعتبارسنجی پیش‌پرداخت ───
      if (!downPaymentAmount || downPaymentAmount <= 0) {
        return NextResponse.json(
          { message: "مبلغ پیش‌پرداخت معتبر نیست" },
          { status: 400 },
        );
      }

      if (downPaymentAmount > order.totalPrice) {
        return NextResponse.json(
          { message: "پیش‌پرداخت نمی‌تواند بیشتر از مبلغ کل سفارش باشد" },
          { status: 400 },
        );
      }

      // پشتیبانی از آرایه یا رشته تکی
      const downPaymentImages = Array.isArray(downPaymentReceiptUrls)
        ? downPaymentReceiptUrls.filter(Boolean)
        : downPaymentReceiptUrls
          ? [downPaymentReceiptUrls]
          : [];

      if (downPaymentImages.length === 0) {
        return NextResponse.json(
          { message: "حداقل یک تصویر رسید پیش‌پرداخت الزامی است" },
          { status: 400 },
        );
      }

      if (downPaymentImages.length > 5) {
        return NextResponse.json(
          { message: "حداکثر ۵ تصویر رسید مجاز است" },
          { status: 400 },
        );
      }

      // ─── اعتبارسنجی اقساط ───
      if (!numberOfChecks || numberOfChecks < 1 || numberOfChecks > 12) {
        return NextResponse.json(
          { message: "تعداد اقساط باید بین ۱ تا ۱۲ باشد" },
          { status: 400 },
        );
      }

      if (!Array.isArray(checks) || checks.length !== numberOfChecks) {
        return NextResponse.json(
          { message: "تعداد چک‌ها با numberOfChecks مطابقت ندارد" },
          { status: 400 },
        );
      }

      // مانده + سود ماهانه — همان فرمول ماشین‌حساب اقساط سمت کلاینت (تومان)
      const remaining = order.totalPrice - downPaymentAmount;
      const checksTotal = checks.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const expectedChecksTotal =
        remaining + remaining * INSTALLMENT_MONTHLY_INTEREST_RATE * numberOfChecks;

      if (Math.abs(checksTotal - expectedChecksTotal) > 100) {
        return NextResponse.json(
          {
            message: `مجموع مبلغ چک‌ها (${Math.round(checksTotal)}) باید برابر با مانده سفارش به‌همراه سود (${Math.round(expectedChecksTotal)}) باشد`,
          },
          { status: 400 },
        );
      }

      // ─── ایجاد پرداخت پیش‌پرداخت ───
      const downPayment = await Payment.create({
        order:  order._id,
        method: "BANK_RECEIPT",
        amount: downPaymentAmount,
        status: "PENDING",
        bankReceipt: {
          imageUrls:    downPaymentImages,    // ← آرایه URLها
          uploadedAt:   new Date(),
          reviewStatus: "PENDING",
        },
      });

      const installmentDoc = await Installment.create({
        order:          order._id,
        downPayment:    downPayment._id,
        totalAmount:    order.totalPrice,
        numberOfChecks,
        status:         "PENDING",
        checks: checks.map((c) => ({
          checkNumber:     c.checkNumber ?? null,
          amount:          Number(c.amount),
          dueDate:         new Date(c.dueDate),
          status:          "PENDING",
          receiptImageUrl: c.receiptImageUrl ?? null,
        })),
      });

      order.payments.push(downPayment._id);
      order.paymentStatus = "PARTIALLY_PAID";
      await order.save();

      // ─── رزرو محصولات دست‌دوم ───
      await reserveUsedProducts(order);

      // ─── ارسال ایمیل فاکتور ───
      try {
        const populatedOrder = await Order.findById(order._id)
          .populate("items.product", "_id name mainImage")
          .populate("items.variant", "_id attributes images sku")
          .populate("items.flowSelections.selectedProduct", "_id name mainImage")
          .lean();

        const userDoc = await User.findById(user.userId)
          .select("email")
          .lean();

        await sendOrderConfirmationEmail(
          populatedOrder,
          userDoc?.email ?? null,
          {
            checks,
            numberOfChecks,
            downPaymentAmount,
          },
        );
      } catch (emailErr) {
        console.error("خطا در ارسال ایمیل:", emailErr);
      }

      return NextResponse.json(
        {
          message:     "درخواست اقساط با موفقیت ثبت شد و در انتظار تأیید پیش‌پرداخت است",
          installment: installmentDoc,
          downPayment,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("خطا در ثبت پرداخت:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور" },
      { status: 500 },
    );
  }
}