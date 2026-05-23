/**
 * POST /api/payments/online/callback
 *
 * Callback از درگاه پرداخت آنلاین (مثلاً زرین‌پال).
 * وظایف:
 *  1. verify پرداخت با درگاه (با Authority)
 *  2. آپدیت Order → PAID
 *  3. صدا زدن webhook-success برای کردیت مربی
 *
 * امنیت:
 *  - مبلغ از سفارش خوانده می‌شود — هیچ‌وقت از callback parameter
 *  - هر authority فقط یک بار verify می‌شود
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Payment from "base/models/Payment.js";
import Order from "base/models/Order.js";
import mongoose from "mongoose";

/* ─────────────────────────────────────────────────────────────
   Helper: verify با زرین‌پال
   در production مقادیر واقعی را از env بخوانید
───────────────────────────────────────────────────────────── */
async function verifyZarinpal(authority, expectedAmountToman) {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    // اگر کانفیگ نبود — فقط در dev mode قبول کن
    if (process.env.NODE_ENV === "development") {
      return { success: true, refId: `DEV-${Date.now()}` };
    }
    throw new Error("ZARINPAL_MERCHANT_ID تنظیم نشده است");
  }

  const res = await fetch("https://api.zarinpal.com/pg/v4/payment/verify.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: merchantId,
      amount: expectedAmountToman * 10, // تبدیل تومان → ریال
      authority,
    }),
  });

  const data = await res.json();

  if (data.data?.code === 100 || data.data?.code === 101) {
    return { success: true, refId: String(data.data.ref_id) };
  }

  return { success: false, refId: null, error: data.errors?.message || "تأیید ناموفق" };
}

export async function POST(req) {
  try {
    await connectToDB();

    const body = await req.json();
    const { authority, status, orderId } = body;

    /* اگر کاربر کنسل کرد */
    if (status === "NOK" || status === "CANCEL") {
      return NextResponse.json(
        { message: "پرداخت توسط کاربر لغو شد", success: false },
        { status: 200 }
      );
    }

    if (!authority || !orderId) {
      return NextResponse.json(
        { message: "Authority و شناسه سفارش الزامی است" },
        { status: 400 }
      );
    }

    /* ── یافتن سفارش ── */
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    if (order.paymentMethod !== "ONLINE") {
      return NextResponse.json(
        { message: "روش پرداخت سفارش آنلاین نیست" },
        { status: 400 }
      );
    }

    /* ── جلوگیری از double-payment ── */
    if (order.paymentStatus === "PAID") {
      return NextResponse.json(
        { message: "این سفارش قبلاً پرداخت شده است", success: true },
        { status: 200 }
      );
    }

    /* ── بررسی authority تکراری ── */
    const existingPayment = await Payment.findOne({
      "onlinePayment.authority": authority,
    });
    if (existingPayment) {
      return NextResponse.json(
        { message: "این تراکنش قبلاً پردازش شده است" },
        { status: 400 }
      );
    }

    /* ── محاسبه مبلغ قابل دریافت از سفارش ── */
    const alreadyPaid = order.payments?.length
      ? (
          await Payment.find({
            _id: { $in: order.payments },
            status: "PAID",
          }).lean()
        ).reduce((s, p) => s + p.amount, 0)
      : 0;
    const expectedAmount = order.totalPrice - alreadyPaid;

    /* ── verify با درگاه ── */
    const verifyResult = await verifyZarinpal(authority, expectedAmount);

    if (!verifyResult.success) {
      /* ثبت پرداخت ناموفق */
      await Payment.create({
        order: order._id,
        method: "ONLINE",
        amount: expectedAmount,
        status: "FAILED",
        onlinePayment: {
          authority,
          gateway: "zarinpal",
        },
      });

      return NextResponse.json(
        { message: "پرداخت تأیید نشد", success: false },
        { status: 200 }
      );
    }

    /* ── ثبت پرداخت موفق ── */
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    try {
      const [payment] = await Payment.create(
        [
          {
            order: order._id,
            method: "ONLINE",
            amount: expectedAmount,
            status: "PAID",
            onlinePayment: {
              authority,
              refId: verifyResult.refId,
              gateway: "zarinpal",
              paidAt: new Date(),
            },
          },
        ],
        { session: dbSession }
      );

      order.payments.push(payment._id);
      order.paymentStatus = "PAID";
      order.fulfillmentStatus = "PROCESSING";
      await order.save({ session: dbSession });

      await dbSession.commitTransaction();
      dbSession.endSession();

      /* ── صدا زدن webhook کردیت مربی (fire-and-forget) ── */
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/orders/webhook-success`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET || "",
        },
        body: JSON.stringify({ orderId: order._id }),
      }).catch((e) => console.error("[webhook-success fire]", e));

      return NextResponse.json(
        {
          message: "پرداخت با موفقیت انجام شد",
          success: true,
          refId: verifyResult.refId,
          trackingCode: order.trackingCode,
        },
        { status: 200 }
      );
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[payments/online/callback]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
