/**
 * src/app/api/payments/online/callback/route.js
 *
 * کال‌بک پرداخت آنلاین از درگاه بانکی
 *
 * POST body (از درگاه بانکی):
 *  { orderId, authority, status }
 *
 * جریان:
 *  1. یافتن سفارش و تأیید مالکیت
 *  2. تأیید پرداخت با درگاه (ZarinPal / سایر)
 *  3. ذخیره رکورد Payment
 *  4. فراخوانی webhook-success برای آپدیت سفارش و کردیت مربی
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import Payment from "base/models/Payment";

/**
 * تأیید پرداخت با درگاه ZarinPal
 * TODO: این تابع را با SDK درگاه واقعی خود جایگزین کنید
 */
async function verifyWithGateway(authority, amount) {
  // نمونه برای ZarinPal:
  // const axios = await import("axios");
  // const { data } = await axios.post("https://api.zarinpal.com/pg/v4/payment/verify.json", {
  //   merchant_id: process.env.ZARINPAL_MERCHANT_ID,
  //   amount,      // به ریال
  //   authority,
  // });
  // return { verified: data.data?.code === 100, refId: data.data?.ref_id };

  // در محیط توسعه (mock):
  if (process.env.NODE_ENV === "development") {
    return { verified: true, refId: `DEV-${Date.now()}` };
  }

  throw new Error("درگاه پرداخت هنوز تنظیم نشده است");
}

export async function GET(req) {
  // بعضی درگاه‌ها از GET استفاده می‌کنند
  return handleCallback(req);
}

export async function POST(req) {
  return handleCallback(req);
}

async function handleCallback(req) {
  try {
    await connectToDB();

    // پارامترها ممکن است از query string (GET) یا body (POST) باشند
    let orderId, authority, status;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      ({ orderId, authority, status } = body);
    } else {
      const { searchParams } = new URL(req.url);
      orderId   = searchParams.get("orderId");
      authority = searchParams.get("Authority");
      status    = searchParams.get("Status");
    }

    if (!orderId || !authority) {
      return NextResponse.json({ message: "پارامترهای ناقص" }, { status: 400 });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    // جلوگیری از پردازش مجدد
    if (order.paymentStatus === "PAID") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/p-user/orders?status=already_paid`
      );
    }

    // پرداخت ناموفق از طرف درگاه
    if (status === "NOK" || status === "failed") {
      await Payment.create({
        order:  order._id,
        method: "ONLINE",
        amount: order.totalPrice,
        status: "FAILED",
        onlinePayment: { authority, gateway: "zarinpal" },
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/p-user/orders?status=failed&tracking=${order.trackingCode}`
      );
    }

    // تأیید با درگاه
    const { verified, refId } = await verifyWithGateway(authority, order.totalPrice * 10); // تومان → ریال

    if (!verified) {
      await Payment.create({
        order:  order._id,
        method: "ONLINE",
        amount: order.totalPrice,
        status: "FAILED",
        onlinePayment: { authority, gateway: "zarinpal" },
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/p-user/orders?status=failed&tracking=${order.trackingCode}`
      );
    }

    // ─── ثبت پرداخت موفق ───
    const payment = await Payment.create({
      order:  order._id,
      method: "ONLINE",
      amount: order.totalPrice,
      status: "PAID",
      onlinePayment: {
        authority,
        refId,
        gateway: "zarinpal",
        paidAt:  new Date(),
      },
    });

    order.payments.push(payment._id);
    await order.save();

    // ─── فراخوانی webhook برای آپدیت نهایی و کردیت مربی ───
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/orders/webhook-success`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId: order._id }),
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/p-user/payments/${order.trackingCode}?status=success`
    );
  } catch (error) {
    console.error("خطا در کال‌بک پرداخت:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
