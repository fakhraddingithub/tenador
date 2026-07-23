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
  getUsedItemTrackingModel,
  getWarehouseModel,
} from "@/lib/warehouseDb";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import { syncOrderFulfillmentFromTracking } from "@/lib/orderFulfillmentSync";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

/**
 * تنظیم وضعیت تأمین یک خطِ سفارش (محصول اصلی یا یک انتخابِ فرایند) روی خود سند سفارش
 */
async function setOrderLineProcurement(orderId, index, flowNodeId, status) {
  if (flowNodeId) {
    await Order.updateOne(
      { _id: orderId },
      { $set: { [`items.${index}.flowSelections.$[fs].procurementStatus`]: status } },
      { arrayFilters: [{ "fs.nodeId": flowNodeId }] }
    );
  } else {
    await Order.updateOne(
      { _id: orderId },
      { $set: { [`items.${index}.procurementStatus`]: status } }
    );
  }
}

/**
 * آیا سفارش هنوز خطی دارد که «باید خریداری شود» و خریداری نشده؟
 */
function orderHasPendingPurchase(order) {
  for (const it of order.items || []) {
    if (it.procurementStatus === "TO_PURCHASE") return true;
    for (const s of it.flowSelections || []) {
      if (s.procurementStatus === "TO_PURCHASE") return true;
    }
  }
  return false;
}

/* ─── GET: لیست tracking items مرتبط با سفارش ──────────────────── */
export async function GET(req, { params }) {
  try {
    const admin = await getAdminUser();
    
    await connectToDB();
    const { orderId } = await params;

    // read-repair: وضعیت بارکدها ممکن است در پروژه‌ی انبار (خارج از این اپ)
    // تغییر کرده باشد — قبل از خواندن، وضعیت سفارش همگام می‌شود
    await syncOrderFulfillmentFromTracking(orderId);

    const order = await Order.findById(orderId)
      .populate("items.product", "name mainImage sku")
      .populate("items.variant", "sku attributes")
      .populate(
        "items.usedProduct",
        "name images sku warehouseTrackingId assignedBarcode assignedTrackingCode"
      )
      .populate("items.flowSelections.selectedProduct", "name mainImage sku")
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

    // ─── tracking محصولات دست‌دوم (کالکشن جداگانه UsedItemTracking) ───
    // محصولات دست‌دوم در پروژه انبار در کالکشن دیگری با کلید usedProductRef
    // نگهداری می‌شوند؛ این‌جا بر اساس سفارش و/یا شناسه‌ی محصولات دست‌دومِ سفارش واکشی می‌شوند.
    const usedProductIds = (order.items || [])
      .filter((it) => it.itemType === "used_product" && it.usedProduct?._id)
      .map((it) => it.usedProduct._id.toString());

    let usedTrackingItems = [];
    if (usedProductIds.length > 0) {
      const UsedItemTracking = getUsedItemTrackingModel(warehouseConn);
      const raw = await UsedItemTracking.find({
        $or: [
          { tenadorOrderId: orderId.toString() },
          { usedProductRef: { $in: usedProductIds } },
        ],
      })
        .populate({ path: "currentWarehouse", model: Warehouse })
        .lean();
      // علامت‌گذاری منبع تا کلاینت/DELETE بتواند کالکشن درست را تشخیص دهد
      usedTrackingItems = raw.map((t) => ({ ...t, isUsedItemTracking: true }));
    }

    // نگاشت usedProductRef → tracking های دست‌دومِ آن محصول
    const usedTrackingByProduct = new Map();
    for (const t of usedTrackingItems) {
      const key = t.usedProductRef?.toString();
      if (!key) continue;
      if (!usedTrackingByProduct.has(key)) usedTrackingByProduct.set(key, []);
      usedTrackingByProduct.get(key).push(t);
    }

    // tracking مربوط به خطِ اصلی هر آیتم:
    //  - ترجیحاً با orderItemIndex صریح تطبیق داده می‌شود (محصول معمولی و دست‌دوم)
    //  - محصول دست‌دوم بدون orderItemIndex (داده‌های قدیمی): با شناسه/بارکد/کدِ
    //    رهگیریِ ذخیره‌شده روی خودِ محصول دست‌دوم تطبیق می‌خورد — دقیق و بدون ابهام
    //    حتی اگر چند محصول دست‌دومِ هم‌پایه در یک سفارش باشند
    //  - محصول معمولی بدون orderItemIndex (داده‌های قدیمی): با productRef + variantRef
    //  - آیتم‌های متعلق به انتخاب‌های فرایند (flowNodeId غیرنال) هرگز اینجا شمرده نمی‌شوند
    const matchMainTracking = (item, index) =>
      trackingItems.filter((t) => {
        if (t.flowNodeId) return false;

        // ۱) تطبیق صریح با ایندکس خطِ سفارش
        if (t.orderItemIndex !== null && t.orderItemIndex !== undefined) {
          return t.orderItemIndex === index;
        }

        // ۲) محصول دست‌دوم: تطبیق دقیق با tracking ثبت‌شده روی خود محصول دست‌دوم
        if (item.itemType === "used_product") {
          const up = item.usedProduct;
          if (!up) return false;
          const trackId = up.warehouseTrackingId?.toString();
          if (trackId && t._id?.toString() === trackId) return true;
          if (up.assignedBarcode && t.barcode === up.assignedBarcode) return true;
          if (up.assignedTrackingCode && t.trackingId === up.assignedTrackingCode)
            return true;
          return false;
        }

        // ۳) fallback قدیمی فقط برای محصولات معمولی
        const productMatch =
          t.productRef?.toString() === item.product?._id?.toString();
        const variantMatch = item.variant
          ? t.variantRef?.toString() === item.variant?._id?.toString()
          : true;
        return productMatch && variantMatch;
      });

    // ساختار خروجی: برای هر آیتم سفارش، tracking خطِ اصلی + خطوط انتخاب‌های فرایند
    const itemsWithTracking = order.items.map((item, index) => {
      const isUsed = item.itemType === "used_product";
      // برای محصول دست‌دوم: tracking از کالکشن UsedItemTracking (بر اساس usedProductRef)
      // به‌علاوه‌ی هر tracking قدیمیِ احتمالی در ItemTracking
      const usedRelated = isUsed
        ? usedTrackingByProduct.get(item.usedProduct?._id?.toString()) || []
        : [];
      const mainRelated = [...matchMainTracking(item, index), ...usedRelated];
      const mainRequired = isUsed ? 1 : item.quantity;

      // خطوط انتخاب فرایند (فقط نودهای category که محصول فیزیکی دارند)
      const flowTracking = (item.flowSelections || [])
        .filter((s) => s.nodeType === "category" && s.selectedProduct)
        .map((s) => {
          const sp = s.selectedProduct;
          const spIsObj = sp && typeof sp === "object";
          const related = trackingItems.filter(
            (t) => t.flowNodeId === s.nodeId && t.orderItemIndex === index
          );
          return {
            nodeId: s.nodeId,
            nodeLabel: s.nodeLabel || "",
            product: {
              _id: (spIsObj ? sp._id : sp)?.toString() ?? null,
              name: (spIsObj ? sp.name : null) || s.selectedProductName || "",
              mainImage: spIsObj ? sp.mainImage || null : null,
              sku: spIsObj ? sp.sku || null : null,
            },
            variantId: s.selectedVariant ? s.selectedVariant.toString() : null,
            variantLabel: s.selectedVariantLabel || null,
            procurementStatus: s.procurementStatus || null,
            quantity: item.quantity,
            scannedCount: related.length,
            remainingCount: item.quantity - related.length,
            trackingItems: related,
          };
        });

      const product = isUsed
        ? {
            _id: item.usedProduct?._id ?? item.product?._id ?? null,
            name: item.usedProduct?.name || item.product?.name || "محصول دست‌دوم",
            mainImage:
              item.usedProduct?.images?.[0] || item.product?.mainImage || null,
            sku: item.usedProduct?.sku || "USED-ITEM",
            isUsed: true,
          }
        : item.product;

      return {
        index,
        itemType: item.itemType || "product",
        isUsed,
        product,
        variant: item.variant,
        procurementStatus: item.procurementStatus || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        scannedCount: mainRelated.length,
        remainingCount: mainRequired - mainRelated.length,
        trackingItems: mainRelated,
        flowTracking,
      };
    });

    // مجموع موردنیاز = خطوط اصلی (دست‌دوم=۱) + خطوط فرایند (به‌ازای هر واحدِ آیتم)
    const totalRequired = itemsWithTracking.reduce((s, it) => {
      const main = it.isUsed ? 1 : it.quantity;
      const flow = (it.flowTracking || []).reduce((fs, f) => fs + f.quantity, 0);
      return s + main + flow;
    }, 0);

    // مجموع اسکن‌شده — شامل خطوط اصلی (محصول معمولی + دست‌دوم) و خطوط فرایند
    const totalScanned = itemsWithTracking.reduce((s, it) => {
      const flow = (it.flowTracking || []).reduce((fs, f) => fs + f.scannedCount, 0);
      return s + it.scannedCount + flow;
    }, 0);

    return NextResponse.json(
      {
        order: {
          _id: order._id,
          trackingCode: order.trackingCode,
          fulfillmentStatus: order.fulfillmentStatus,
          paymentStatus: order.paymentStatus,
        },
        itemsWithTracking,
        totalScanned,
        totalRequired,
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
    // flowNodeId: اگر مقدار داشته باشد، بارکد برای یک «انتخابِ فرایند» (نود category) ثبت می‌شود
    const flowNodeId = body.flowNodeId || null;
    // action: "scan" (پیش‌فرض) یا "mark_purchase" (علامت‌گذاری «باید خریداری شود» بدون بارکد)
    const action = body.action || "scan";

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

    // ─── علامت‌گذاری «باید خریداری شود» (بدون بارکد) ───
    // محصول هنوز خریداری نشده و بارکدی ندارد؛ فقط خطِ سفارش علامت می‌خورد و
    // وضعیت کل سفارش به «باید خریداری شود» تغییر می‌کند تا در لیست سفارش‌ها قابل شناسایی باشد.
    if (action === "mark_purchase") {
      if (flowNodeId) {
        const selection = (targetItem.flowSelections || []).find(
          (s) => s.nodeId === flowNodeId && s.nodeType === "category"
        );
        if (!selection || !selection.selectedProduct) {
          return NextResponse.json(
            { message: "انتخابِ فرایند موردنظر در این آیتم یافت نشد" },
            { status: 400 }
          );
        }
      }

      await setOrderLineProcurement(orderId, orderItemIndex, flowNodeId, "TO_PURCHASE");
      await Order.updateOne(
        { _id: orderId, fulfillmentStatus: { $nin: ["DELIVERED", "CANCELED"] } },
        { $set: { fulfillmentStatus: "NEEDS_PURCHASE" } }
      );

      return NextResponse.json(
        {
          message: "به عنوان «باید خریداری شود» علامت‌گذاری شد و وضعیت سفارش بروزرسانی شد",
          marked: true,
          fulfillmentStatus: "NEEDS_PURCHASE",
        },
        { status: 200 }
      );
    }

    if (!barcode?.trim())
      return NextResponse.json(
        { message: "بارکد یا کد رهگیری الزامی است" },
        { status: 400 }
      );

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

    // ─── تعیین هدف: محصول اصلی یا یک انتخابِ فرایند (نود category) ───
    let expectedProductId;
    let expectedVariantId = null;
    let requiredCount;
    let label;

    if (flowNodeId) {
      const selection = (targetItem.flowSelections || []).find(
        (s) => s.nodeId === flowNodeId && s.nodeType === "category"
      );
      if (!selection || !selection.selectedProduct) {
        return NextResponse.json(
          { message: "انتخابِ فرایند موردنظر در این آیتم یافت نشد" },
          { status: 400 }
        );
      }
      expectedProductId = selection.selectedProduct.toString();
      expectedVariantId = selection.selectedVariant
        ? selection.selectedVariant.toString()
        : null;
      requiredCount = targetItem.quantity;
      label = `انتخاب فرایند «${selection.nodeLabel || ""}»`;
    } else {
      expectedProductId = targetItem.product?._id?.toString();
      expectedVariantId = targetItem.variant?._id?.toString() || null;
      requiredCount = targetItem.quantity;
      label = "محصول اصلی";
    }

    // بررسی تطبیق محصول
    const productIdMatch =
      trackingItem.productRef?.toString() === expectedProductId;

    if (!productIdMatch) {
      return NextResponse.json(
        {
          message: "این بارکد متعلق به محصول دیگری است",
          mismatch: true,
          trackingProductId: trackingItem.productRef?.toString(),
          expectedProductId,
        },
        { status: 400 }
      );
    }

    // تطبیق واریانت (در صورت وجود واریانتِ موردانتظار و ثبت واریانت روی بارکد)
    if (
      expectedVariantId &&
      trackingItem.variantRef &&
      trackingItem.variantRef.toString() !== expectedVariantId
    ) {
      return NextResponse.json(
        {
          message: "این بارکد متعلق به واریانت دیگری از این محصول است",
          variantMismatch: true,
        },
        { status: 400 }
      );
    }

    // بررسی تعداد اسکن‌شده برای همین خط (اصلی یا همین نودِ فرایند)
    const quotaFilter = flowNodeId
      ? {
          tenadorOrderId: orderId.toString(),
          orderItemIndex,
          flowNodeId,
        }
      : {
          tenadorOrderId: orderId.toString(),
          flowNodeId: null,
          $or: [
            { orderItemIndex },
            {
              orderItemIndex: null,
              productRef: targetItem.product?._id,
              ...(targetItem.variant ? { variantRef: targetItem.variant?._id } : {}),
            },
          ],
        };

    const alreadyScanned = await ItemTracking.countDocuments(quotaFilter);

    if (alreadyScanned >= requiredCount) {
      return NextResponse.json(
        {
          message: `تعداد مجاز برای این ${label} (${requiredCount} عدد) تکمیل شده`,
          quotaFull: true,
        },
        { status: 400 }
      );
    }

    // اختصاص دادن بارکد به سفارش — با ربط دقیق به خط سفارش
    trackingItem.tenadorOrderId = orderId.toString();
    trackingItem.relatedOrder = order._id;
    trackingItem.orderItemIndex = orderItemIndex;
    trackingItem.flowNodeId = flowNodeId;
    if (procurementStatus) {
      trackingItem.procurementStatus = procurementStatus;
    }

    // اضافه کردن به تاریخچه
    trackingItem.history.push({
      status: trackingItem.status,
      locationName: "سفارش پنل ادمین تنادور",
      note: `اختصاص به سفارش ${order.trackingCode} | ${label} | ${
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

    // ─── بروزرسانی وضعیت تأمینِ خطِ سفارش روی خود سند سفارش ───
    // اگر این خط قبلاً «باید خریداری شود» بوده، حالا «خریداری شد» می‌شود؛ در غیر این صورت
    // مقدار ارسالی از کلاینت (IN_STOCK / PURCHASED) ثبت می‌شود.
    const lineProcurement = procurementStatus || "IN_STOCK";
    await setOrderLineProcurement(orderId, orderItemIndex, flowNodeId, lineProcurement);

    // اگر سفارش در وضعیت «باید خریداری شود» بوده و دیگر هیچ خطی منتظر خرید نیست،
    // وضعیت سفارش به «در حال پردازش» تغییر می‌کند.
    let updatedFulfillment = order.fulfillmentStatus;
    const freshOrder = await Order.findById(orderId)
      .select("fulfillmentStatus items.procurementStatus items.flowSelections.procurementStatus")
      .lean();
    if (
      freshOrder?.fulfillmentStatus === "NEEDS_PURCHASE" &&
      !orderHasPendingPurchase(freshOrder)
    ) {
      await Order.updateOne(
        { _id: orderId },
        { $set: { fulfillmentStatus: "PROCESSING" } }
      );
      updatedFulfillment = "PROCESSING";
    } else if (freshOrder?.fulfillmentStatus) {
      updatedFulfillment = freshOrder.fulfillmentStatus;
    }

    // همگام‌سازی خودکار با وضعیت بارکدها (مثلاً اسکنِ بارکدی که همین حالا
    // DELIVERED است، یا برعکس، سفارشِ تحویل‌شده‌ای که بارکد جدید گرفت)
    const syncedStatus = await syncOrderFulfillmentFromTracking(orderId);
    if (syncedStatus) updatedFulfillment = syncedStatus;

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
        remainingCount: requiredCount - alreadyScanned - 1,
        fulfillmentStatus: updatedFulfillment,
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

    // ابتدا در ItemTracking (محصولات معمولی)، سپس در UsedItemTracking (دست‌دوم)
    let item = await ItemTracking.findById(trackingItemId);
    let isUsedItem = false;
    if (!item) {
      const UsedItemTracking = getUsedItemTrackingModel(warehouseConn);
      item = await UsedItemTracking.findById(trackingItemId);
      isUsedItem = true;
    }

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
    // فیلدهای زیر فقط در ItemTracking وجود دارند (محصولات معمولی)
    if (!isUsedItem) {
      item.relatedOrder = null;
      item.procurementStatus = null;
      item.orderItemIndex = null;
      item.flowNodeId = null;
    }
    item.history.push({
      status: item.status,
      locationName: "پنل ادمین تنادور",
      note: `جدا شدن از سفارش — ادمین`,
      addedByName: "ادمین تنادور",
      addedById: admin.userId,
    });

    await item.save();

    // حذف بارکد ممکن است ترکیب باقی‌مانده را «همه تحویل‌شده» کند (یا برعکس)
    await syncOrderFulfillmentFromTracking(orderId);

    return NextResponse.json(
      { message: "بارکد از سفارش جدا شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
