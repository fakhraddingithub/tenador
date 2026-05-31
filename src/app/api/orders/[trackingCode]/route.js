/**
 * src/app/api/orders/[trackingCode]/route.js
 *
 * دریافت سفارش با کد رهگیری
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import { verifyToken } from "base/utils/auth";
import { cookies } from "next/headers";
import Product from "base/models/Product"; 
import Variant from "base/models/Variant";
import Payment from "base/models/Payment";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { trackingCode } = await params;

    if (!trackingCode) {
      return NextResponse.json(
        { message: "Tracking code is required" },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ trackingCode })
      .populate("items.product", "name mainImage sku")
      .populate("items.variant", "sku attributes images")
      .populate("payments", "method amount status createdAt")
      .lean();

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // جلوگیری از دسترسی به سفارش دیگران
    if (order.user.toString() !== user.userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Error fetching order by tracking code:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * src/app/api/orders/[orderId]/route.js
 *
 * DELETE → حذف سفارش (فقط سفارش‌های UNPAID)
 *
 * قوانین:
 *  - سفارش باید متعلق به کاربر جاری باشد
 *  - وضعیت پرداخت باید UNPAID باشد
 *  - موجودی کالاها برگردانده می‌شود
 */

export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { trackingCode } = await params;

    if (!trackingCode) {
      return NextResponse.json(
        { message: "Tracking code is required" },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ trackingCode })

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    // فقط سفارش‌های پرداخت نشده قابل حذف هستند
    if (order.paymentStatus !== "UNPAID") {
      return NextResponse.json(
        { message: "فقط سفارش‌های پرداخت‌نشده قابل حذف هستند" },
        { status: 400 }
      );
    }

    // ─── بازگرداندن موجودی ───
    for (const item of order.items ?? []) {
      try {
        if (item.variant) {
          await Variant.findByIdAndUpdate(item.variant, {
            $inc: { stock: item.quantity },
          });
        } else {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity },
          });
        }
      } catch (stockErr) {
        console.warn("خطا در بازگرداندن موجودی:", stockErr);
      }
    }

    await Order.findByIdAndDelete(order._id);

    return NextResponse.json(
      { message: "سفارش با موفقیت حذف شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("خطا در حذف سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}