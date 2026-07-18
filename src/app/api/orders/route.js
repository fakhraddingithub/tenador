/**
 * src/app/api/orders/route.js
 *
 * GET → لیست سفارش‌های کاربر
 *
 * POST حذف شده است: سفارش فقط هم‌زمان با ثبت موفق پرداخت/اقساط در
 * POST /api/checkout ساخته می‌شود تا هیچ سفارش بدون پرداختی ایجاد نشود.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import User from "base/models/User";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded || null;
}

export async function POST() {
  // مسیر قدیمی ساخت سفارش — سفارش‌ها اکنون فقط از طریق /api/checkout و
  // هم‌زمان با ثبت پرداخت ساخته می‌شوند
  return NextResponse.json(
    {
      message:
        "ثبت سفارش از این مسیر غیرفعال شده است؛ سفارش هنگام تکمیل پرداخت ثبت می‌شود",
    },
    { status: 410 },
  );
}

/* ─────────────────────────────────────────────
   GET → لیست سفارش‌های کاربر
───────────────────────────────────────────── */
export async function GET() {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    // نقش کاربر — برای نمایش بخش یورو فقط به کاربران «فروشگاه» (store).
    // مستقیم از دیتابیس خوانده می‌شود تا معتبر باشد (نه از روی توکن قدیمی).
    const dbUser = await User.findById(user.userId).select("role").lean();
    const role = dbUser?.role || "user";

    const orders = await Order.find({ user: user.userId })
      .populate({
        path:   "items.product",
        model:  "Product",
        select: "name mainImage sku",
      })
      .populate({
        path:   "items.variant",
        model:  "Variant",
        select: "sku attributes images",
      })
      .populate({
        path:   "items.usedProduct",
        model:  "UsedProduct",
        select: "name images price priceToman status",
      })
      .populate({
        path:   "items.flowSelections.selectedProduct",
        model:  "Product",
        select: "name mainImage",
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalizedOrders = orders.map((order) => {
      const normalizedItems = order.items.map((item) => {
        if (item.itemType === "used_product") {
          return {
            ...item,
            product: {
              _id:       item.usedProduct?._id  || item._id,
              name:      item.usedProduct?.name || "محصول دست‌دوم",
              mainImage: item.usedProduct?.images?.[0] || null,
              sku:       "USED-ITEM",
            },
          };
        }
        return item;
      });
      return { ...order, items: normalizedItems };
    });

    return NextResponse.json({ orders: normalizedOrders, role }, { status: 200 });
  } catch (error) {
    console.error("[GET Orders Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت سفارشات" },
      { status: 500 },
    );
  }
}