/**
 * src/app/api/admin/orders/used-product-tracking/route.js
 *
 * POST → ساخت یا اختصاص tracking item برای یک محصول دست‌دوم
 *
 * body: {
 *   usedProductId: string,     -- شناسه محصول دست‌دوم
 *   orderId: string,           -- شناسه سفارش
 *   action: "create" | "scan", -- create: ساخت بارکد جدید | scan: اسکن بارکد موجود
 *   barcode?: string,          -- برای action = scan
 *   warehouseId?: string,      -- برای action = create (انبار مبدا)
 * }
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
import UsedProduct from "base/models/UsedProduct";
import Order from "base/models/Order";
import { syncOrderFulfillmentFromTracking } from "@/lib/orderFulfillmentSync";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId || decoded.role !== "admin") return null;
  return decoded;
}

function generateBarcode() {
  const ts   = Date.now().toString().slice(-9);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  const base = `${ts}${rand}`;
  const digits = base.split("").map(Number);
  const sum    = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check  = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}

function generateTrackingId(label = "used", date = new Date()) {
  const d  = String(date.getDate()).padStart(2, "0");
  const m  = String(date.getMonth() + 1).padStart(2, "0");
  const y  = String(date.getFullYear());
  const seq = String(Math.floor(Math.random() * 9999 + 1)).padStart(4, "0");
  return `used-${label.slice(0, 3).toLowerCase()}-${d}${m}${y}${seq}`;
}

export async function POST(req) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });

    await connectToDB();
    const body = await req.json();
    const { usedProductId, orderId, action, barcode, warehouseId } = body;

    if (!usedProductId || !orderId || !action)
      return NextResponse.json({ message: "پارامترهای ناقص" }, { status: 400 });

    const usedProduct = await UsedProduct.findById(usedProductId)
      .populate("baseProduct", "name sku")
      .lean();
    if (!usedProduct)
      return NextResponse.json({ message: "محصول دست‌دوم یافت نشد" }, { status: 404 });

    const order = await Order.findById(orderId).lean();
    if (!order)
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });

    // ربط دقیق به خطِ سفارش: ایندکس آیتمِ این محصول دست‌دوم در order.items
    // بدون این ایندکس، بخش سفارش‌ها نمی‌تواند بارکد دست‌دوم را به خطِ درست نسبت دهد
    const usedOrderItemIndex = (order.items || []).findIndex(
      (it) =>
        it.itemType === "used_product" &&
        it.usedProduct?.toString() === usedProductId.toString()
    );

    const warehouseConn = await connectWarehouseDB();
    const ItemTracking  = getItemTrackingModel(warehouseConn);
    const Warehouse     = getWarehouseModel(warehouseConn);

    // ─── action = "scan": اسکن بارکد موجود ───────────────────────
    if (action === "scan") {
      if (!barcode?.trim())
        return NextResponse.json({ message: "بارکد الزامی است" }, { status: 400 });

      const item = await ItemTracking.findOne({
        $or: [{ barcode: barcode.trim() }, { trackingId: barcode.trim() }],
      });

      if (!item)
        return NextResponse.json({ message: "بارکدی با این کد در سیستم یافت نشد", found: false }, { status: 404 });

      if (item.tenadorOrderId && item.tenadorOrderId !== orderId.toString())
        return NextResponse.json({
          message: `این بارکد قبلاً به سفارش دیگری اختصاص داده شده`,
          alreadyAssigned: true,
        }, { status: 409 });

      // اختصاص به سفارش
      item.tenadorOrderId   = orderId.toString();
      item.relatedOrder     = order._id;
      item.procurementStatus = "IN_STOCK";
      // ربط دقیق به خطِ سفارش تا بخش سفارش‌ها بتواند بارکد را پیدا کند
      if (usedOrderItemIndex >= 0) item.orderItemIndex = usedOrderItemIndex;
      item.flowNodeId = null; // خطِ اصلی است نه انتخابِ فرایند

      // ربط دادن به usedProduct (از طریق productRef)
      if (usedProduct.baseProduct?._id) {
        item.productRef = usedProduct.baseProduct._id;
      }

      item.history.push({
        status:       item.status,
        locationName: "سیستم تنادور",
        note:         `اختصاص به سفارش ${order.trackingCode} | محصول دست‌دوم: ${usedProduct.name}`,
        addedByName:  "ادمین تنادور",
        addedById:    admin.userId,
      });

      await item.save();

      // آپدیت usedProduct با barcode و trackingId
      await UsedProduct.findByIdAndUpdate(usedProductId, {
        warehouseTrackingId:   item._id.toString(),
        assignedBarcode:       item.barcode,
        assignedTrackingCode:  item.trackingId,
        status:                "reserved",
        order:                 order._id,
      });

      // بارکد جدید به سفارش وصل شد → وضعیت سفارش با وضعیت بارکدها همگام شود
      await syncOrderFulfillmentFromTracking(orderId);

      return NextResponse.json({
        message:     "بارکد با موفقیت اختصاص داده شد",
        trackingId:  item.trackingId,
        barcode:     item.barcode,
        status:      item.status,
      }, { status: 200 });
    }

    // ─── action = "create": ساخت tracking item جدید ──────────────
    if (action === "create") {
      if (!warehouseId)
        return NextResponse.json({ message: "انبار الزامی است" }, { status: 400 });

      const warehouse = await Warehouse.findById(warehouseId).lean();
      if (!warehouse)
        return NextResponse.json({ message: "انبار یافت نشد" }, { status: 404 });

      const trackingId = generateTrackingId(
        usedProduct.baseProduct?.name || "used",
        new Date()
      );
      const newBarcode = generateBarcode();

      const newItem = await ItemTracking.create({
        productRef:        usedProduct.baseProduct?._id ?? null,
        variantRef:        null,
        trackingId,
        barcode:           newBarcode,
        status:            "IR_WAREHOUSE", // محصولات دست‌دوم در ایران هستند
        currentWarehouse:  warehouseId,
        relatedOrder:      order._id,
        tenadorOrderId:    orderId.toString(),
        procurementStatus: "IN_STOCK",
        // ربط دقیق به خطِ سفارش تا بخش سفارش‌ها بتواند بارکد را پیدا کند
        orderItemIndex:    usedOrderItemIndex >= 0 ? usedOrderItemIndex : null,
        flowNodeId:        null,
        history: [{
          status:       "IR_WAREHOUSE",
          locationName: warehouse.name,
          note:         `ثبت محصول دست‌دوم: ${usedProduct.name} | سفارش: ${order.trackingCode}`,
          addedByName:  "ادمین تنادور",
          addedById:    admin.userId,
          createdAt:    new Date(),
        }],
      });

      await UsedProduct.findByIdAndUpdate(usedProductId, {
        warehouseTrackingId:  newItem._id.toString(),
        assignedBarcode:      newBarcode,
        assignedTrackingCode: trackingId,
        status:               "reserved",
        order:                order._id,
      });

      // بارکد جدید به سفارش وصل شد → وضعیت سفارش با وضعیت بارکدها همگام شود
      await syncOrderFulfillmentFromTracking(orderId);

      return NextResponse.json({
        message:     "بارکد جدید با موفقیت ساخته شد",
        trackingId,
        barcode:     newBarcode,
        status:      "IR_WAREHOUSE",
        warehouse:   warehouse.name,
      }, { status: 201 });
    }

    return NextResponse.json({ message: "action نامعتبر" }, { status: 400 });
  } catch (error) {
    console.error("[admin/orders/used-product-tracking POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── GET: وضعیت tracking محصول دست‌دوم ─────────────────────────── */
export async function GET(req) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const usedProductId = searchParams.get("usedProductId");

    if (!usedProductId)
      return NextResponse.json({ message: "usedProductId الزامی است" }, { status: 400 });

    await connectToDB();
    const usedProduct = await UsedProduct.findById(usedProductId).lean();
    if (!usedProduct)
      return NextResponse.json({ message: "یافت نشد" }, { status: 404 });

    let trackingItem = null;
    if (usedProduct.warehouseTrackingId) {
      const warehouseConn = await connectWarehouseDB();
      const ItemTracking  = getItemTrackingModel(warehouseConn);
      const Warehouse     = getWarehouseModel(warehouseConn);
      trackingItem = await ItemTracking.findById(usedProduct.warehouseTrackingId)
        .populate({ path: "currentWarehouse", model: Warehouse })
        .lean();
    }

    return NextResponse.json({
      usedProduct: {
        _id:                  usedProduct._id,
        name:                 usedProduct.name,
        status:               usedProduct.status,
        assignedBarcode:      usedProduct.assignedBarcode,
        assignedTrackingCode: usedProduct.assignedTrackingCode,
        warehouseTrackingId:  usedProduct.warehouseTrackingId,
      },
      trackingItem,
    }, { status: 200 });
  } catch (error) {
    console.error("[admin/orders/used-product-tracking GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}