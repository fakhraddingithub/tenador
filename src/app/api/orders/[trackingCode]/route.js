/**
 * src/app/api/orders/[trackingCode]/route.js
 *
 * دریافت و حذف سفارش با کد رهگیری — هماهنگ با ساختار نهایی مدل Order
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import Product from "base/models/Product"; 
import Variant from "base/models/Variant";
import Payment from "base/models/Payment";
import UsedProduct from "base/models/UsedProduct"; // اضافه شدن مدل محصول دست دوم
import { verifyToken } from "base/utils/auth";
import { cookies } from "next/headers";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

// ─── ۱. دریافت اطلاعات سفارش (GET) ───
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

    // پاپولیت دقیق فیلدها بر اساس مدل Order شما
    const order = await Order.findOne({ trackingCode })
      .populate("items.product", "name mainImage sku")
      .populate("items.variant", "sku attributes images")
      .populate("items.usedProduct", "name images status") // پاپولیت فیلدهای مورد نیاز محصول دست‌دوم
      .populate("items.flowSelections.selectedProduct", "name mainImage") // تصویر محصولات انتخابی فرایند
      .populate("payments", "method amount status createdAt")
      .lean();

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // جلوگیری از دسترسی به سفارش سایر کاربران
    if (order.user.toString() !== user.userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // غنی‌سازی و همسان‌سازی داده‌ها برای فرانت‌اندر
    if (order.items) {
      order.items = order.items.map((item) => {
        // اگر نوع آیتم طبق مدل شما "used_product" بود
        if (item.itemType === "used_product" && item.usedProduct) {
          return {
            ...item,
            // ساخت یک آبجکت کپی شده مجازی از product برای فرانت‌اندر تا نام دست‌دوم اعمال شود
            product: {
              _id: item.usedProduct._id,
              name: item.usedProduct.name, // قرار دادن نام اختصاصی محصول دست‌دوم
              mainImage: item.usedProduct.images?.[0] || null, // استفاده از اولین تصویر گالری دست‌دوم
              sku: item.usedProduct.assignedBarcode || "USED-ITEM",
              isUsed: true,
            },
          };
        }
        return item;
      });
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

// ─── ۲. لغو و حذف سفارش پرداخت نشده (DELETE) ───
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

    const order = await Order.findOne({ trackingCode });

    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    // فقط سفارش‌های لغو نشده و پرداخت‌نشده قابل حذف هستند
    if (order.paymentStatus !== "UNPAID") {
      return NextResponse.json(
        { message: "فقط سفارش‌های پرداخت‌نشده قابل حذف هستند" },
        { status: 400 }
      );
    }

    // بررسی مالکیت سفارش قبل از عملیات حذف
    if (order.user.toString() !== user.userId) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    // ─── بازگرداندن هوشمند موجودی انبار بر اساس ساختار مدل Order شما ───
    for (const item of order.items ?? []) {
      try {
        if (item.itemType === "used_product" && item.usedProduct) {
          // اگر آیتم دست‌دوم بود، وضعیت آن را دوباره به چرخه فروش باز می‌گردانیم
          await UsedProduct.findByIdAndUpdate(item.usedProduct, {
            status: "available",
            $unset: { order: "" }, // حذف رفرنس این سفارش از روی کالای دست‌دوم
          });
        } else if (item.variant) {
          // اگر واریانت محصول معمولی بود
          await Variant.findByIdAndUpdate(item.variant, {
            $inc: { stock: item.quantity },
          });
        } else if (item.product) {
          // اگر محصول معمولی بدون واریانت بود
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity },
          });
        }
      } catch (stockErr) {
        console.warn("خطا در بازگرداندن موجودی کالا:", stockErr);
      }
    }

    // حذف فیزیکی سفارش از دیتابیس
    await Order.findByIdAndDelete(order._id);

    return NextResponse.json(
      { message: "سفارش با موفقیت حذف شد و موجودی انبار بازگردانی گردید" },
      { status: 200 }
    );
  } catch (error) {
    console.error("خطا در حذف سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}