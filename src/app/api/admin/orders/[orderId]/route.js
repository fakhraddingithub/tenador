/**
 * src/app/api/admin/orders/[orderId]/route.js
 *
 * GET   → جزئیات کامل یک سفارش (ادمین)
 *         وقتی ادمین صفحه سفارش رو باز می‌کنه، reviewedAt ست می‌شود
 * PATCH → بروزرسانی وضعیت سفارش (paymentStatus / fulfillmentStatus)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Variant from "base/models/Variant";
import Product from "base/models/Product";
import User from "base/models/User";

import mongoose from "mongoose";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

/* ─── GET: جزئیات سفارش ─────────────────────────────────────────────── */
export async function GET(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();

    const { orderId } = await params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    // اگه reviewedAt نداشت، الان که ادمین باز می‌کنه ست کن
    // (فقط اگه قبلاً ست نشده — برای جلوگیری از overwrite تاریخ اول)
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        reviewedAt: { $exists: false },
      },
      {
        $set: {
          reviewedAt: new Date(),
          reviewedBy: new mongoose.Types.ObjectId(admin.userId),
        },
      },
      { new: false } // برمی‌گردونه نسخه قبل از آپدیت (مهم نیست چون بعداً re-query می‌کنیم)
    ).lean();

    // حالا query کامل با populate
    const fullOrder = await Order.findById(orderId)
      .populate("user", "name phone email")
      .populate({
        path: "payments",
        select: "method amount status bankReceipt onlinePayment createdAt meta",
      })
      .populate("items.product", "name mainImage sku")
      .populate("items.variant", "sku attributes images")
      .lean();

    if (!fullOrder) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ order: fullOrder }, { status: 200 });
  } catch (error) {
    console.error("[admin/orders/:id GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── PATCH: بروزرسانی وضعیت ────────────────────────────────────────── */
export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();

    const { orderId } = await params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { paymentStatus, fulfillmentStatus } = body;

    const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"];
    const VALID_FULFILLMENT_STATUSES = ["WAITING", "PROCESSING", "SENT", "DELIVERED", "CANCELED"];

    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ message: "وضعیت پرداخت نامعتبر است" }, { status: 400 });
    }
    if (fulfillmentStatus && !VALID_FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
      return NextResponse.json({ message: "وضعیت ارسال نامعتبر است" }, { status: 400 });
    }

    const update = {
      reviewedBy: new mongoose.Types.ObjectId(admin.userId),
      reviewedAt: new Date(),
    };
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (fulfillmentStatus) update.fulfillmentStatus = fulfillmentStatus;

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $set: update },
      { new: true }
    )
      .populate("user", "name phone email")
      .populate("payments", "method amount status bankReceipt onlinePayment createdAt")
      .lean();

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "وضعیت سفارش با موفقیت بروزرسانی شد", order },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
