/**
 * src/app/api/admin/orders/[orderId]/tracking/route.js
 *
 * GET  → لیست tracking items مرتبط با این سفارش
 * POST → اسکن/ثبت بارکد برای یک آیتم سفارش
 *        body: { barcode, orderItemIndex, procurementStatus }
 *              barcode: کد بارکد یا tracking ID
 *              orderItemIndex: ایندکس آیتم در سفارش (برای دانستن کدام محصول)
 *              procurementStatus: "IN_STOCK" یا "TO_PURCHASE" یا "PURCHASED"
 *
 * DELETE → حذف یک tracking item از سفارش
 *          body: { trackingItemId }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import {
  connectWarehouseDB,
  getItemTrackingModel,
  getWarehouseModel,
} from "@/lib/warehouseDb";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

/* ─── GET: لیست tracking items مرتبط با سفارش ──────────────────── */
export async function GET(req, { params }) {
  try {
    const admin = await getAdminUser();
    
    await connectToDB();
    const { orderId } = await params;

    const order = await Order.findById(orderId)
      .populate("items.product", "name mainImage sku")
      .populate("items.variant", "sku attributes")
      .lean();

    if (!order)
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });

    // گرفتن tracking items از warehouse DB
    const warehouseConn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(warehouseConn);
    const Warehouse = getWarehouseModel(warehouseConn);

    const trackingItems = await ItemTracking.find({
      tenadorOrderId: orderId.toString(),
    })
      .populate({ path: "currentWarehouse", model: Warehouse })
      .lean();

    // ساختار خروجی: برای هر آیتم سفارش، tracking items مرتبط
    const itemsWithTracking = order.items.map((item, index) => {
      // tracking items مرتبط با این آیتم (بر اساس productRef)
      const related = trackingItems.filter(
        (t) =>
          t.productRef?.toString() === item.product?._id?.toString() &&
          (item.variant
            ? t.variantRef?.toString() === item.variant?._id?.toString()
            : true)
      );

      return {
        index,
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        scannedCount: related.length,
        remainingCount: item.quantity - related.length,
        trackingItems: related,
      };
    });

    return NextResponse.json(
      {
        order: {
          _id: order._id,
          trackingCode: order.trackingCode,
          fulfillmentStatus: order.fulfillmentStatus,
          paymentStatus: order.paymentStatus,
        },
        itemsWithTracking,
        totalScanned: trackingItems.length,
        totalRequired: order.items.reduce((s, i) => s + i.quantity, 0),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── POST: ثبت بارکد برای آیتم سفارش ──────────────────────────── */
export async function POST(req, { params }) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });

    await connectToDB();
    const { orderId } = await params;
    const body = await req.json();
    const { barcode, orderItemIndex, procurementStatus } = body;

    if (!barcode?.trim())
      return NextResponse.json(
        { message: "بارکد یا کد رهگیری الزامی است" },
        { status: 400 }
      );

    const order = await Order.findById(orderId)
      .populate("items.product", "name mainImage sku _id")
      .populate("items.variant", "sku attributes _id")
      .lean();

    if (!order)
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });

    if (
      orderItemIndex === undefined ||
      orderItemIndex < 0 ||
      orderItemIndex >= order.items.length
    )
      return NextResponse.json(
        { message: "ایندکس آیتم سفارش نامعتبر است" },
        { status: 400 }
      );

    const targetItem = order.items[orderItemIndex];

    // اتصال به warehouse DB
    const warehouseConn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(warehouseConn);

    // پیدا کردن tracking item با بارکد
    const trackingItem = await ItemTracking.findOne({
      $or: [
        { barcode: barcode.trim() },
        { trackingId: barcode.trim() },
      ],
    });

    if (!trackingItem) {
      return NextResponse.json(
        {
          message: "آیتمی با این بارکد یافت نشد",
          found: false,
        },
        { status: 404 }
      );
    }

    // بررسی که این بارکد قبلاً به سفارش دیگری اختصاص نیافته باشد
    if (
      trackingItem.tenadorOrderId &&
      trackingItem.tenadorOrderId !== orderId.toString()
    ) {
      return NextResponse.json(
        {
          message: `این آیتم قبلاً به سفارش ${trackingItem.tenadorOrderId} اختصاص داده شده`,
          alreadyAssigned: true,
        },
        { status: 409 }
      );
    }

    // بررسی که محصول این بارکد با آیتم سفارش مطابقت داشته باشد
    const productIdMatch =
      trackingItem.productRef?.toString() ===
      targetItem.product?._id?.toString();

    if (!productIdMatch) {
      return NextResponse.json(
        {
          message: "این بارکد متعلق به محصول دیگری است",
          mismatch: true,
          trackingProductId: trackingItem.productRef?.toString(),
          expectedProductId: targetItem.product?._id?.toString(),
        },
        { status: 400 }
      );
    }

    // بررسی تعداد: چقدر از این محصول اسکن شده
    const alreadyScanned = await ItemTracking.countDocuments({
      tenadorOrderId: orderId.toString(),
      productRef: targetItem.product?._id,
      ...(targetItem.variant
        ? { variantRef: targetItem.variant?._id }
        : {}),
    });

    if (alreadyScanned >= targetItem.quantity) {
      return NextResponse.json(
        {
          message: `تعداد مجاز برای این محصول (${targetItem.quantity} عدد) تکمیل شده`,
          quotaFull: true,
        },
        { status: 400 }
      );
    }

    // اختصاص دادن بارکد به سفارش
    trackingItem.tenadorOrderId = orderId.toString();
    trackingItem.relatedOrder = order._id;
    if (procurementStatus) {
      trackingItem.procurementStatus = procurementStatus;
    }

    // اضافه کردن به تاریخچه
    trackingItem.history.push({
      status: trackingItem.status,
      locationName: "سفارش پنل ادمین تنادور",
      note: `اختصاص به سفارش ${order.trackingCode} | ${
        procurementStatus === "TO_PURCHASE"
          ? "باید خریداری شود"
          : procurementStatus === "PURCHASED"
          ? "خریداری شد"
          : "موجود در انبار"
      }`,
      addedByName: "ادمین تنادور",
      addedById: admin.userId,
    });

    await trackingItem.save();

    return NextResponse.json(
      {
        message: "بارکد با موفقیت به سفارش اختصاص داده شد",
        trackingItem: {
          _id: trackingItem._id,
          trackingId: trackingItem.trackingId,
          barcode: trackingItem.barcode,
          status: trackingItem.status,
          procurementStatus: trackingItem.procurementStatus,
        },
        scannedCount: alreadyScanned + 1,
        remainingCount: targetItem.quantity - alreadyScanned - 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── DELETE: حذف tracking item از سفارش ───────────────────────── */
export async function DELETE(req, { params }) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });

    await connectToDB();
    const { orderId } = await params;
    const body = await req.json();
    const { trackingItemId } = body;

    if (!trackingItemId)
      return NextResponse.json(
        { message: "شناسه آیتم الزامی است" },
        { status: 400 }
      );

    const warehouseConn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(warehouseConn);

    const item = await ItemTracking.findById(trackingItemId);
    if (!item)
      return NextResponse.json(
        { message: "آیتم یافت نشد" },
        { status: 404 }
      );

    if (item.tenadorOrderId !== orderId.toString())
      return NextResponse.json(
        { message: "این آیتم به این سفارش تعلق ندارد" },
        { status: 403 }
      );

    // جدا کردن از سفارش (نه حذف از دیتابیس)
    item.tenadorOrderId = null;
    item.relatedOrder = null;
    item.procurementStatus = null;
    item.history.push({
      status: item.status,
      locationName: "پنل ادمین تنادور",
      note: `جدا شدن از سفارش — ادمین`,
      addedByName: "ادمین تنادور",
      addedById: admin.userId,
    });

    await item.save();

    return NextResponse.json(
      { message: "بارکد از سفارش جدا شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
