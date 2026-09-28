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
import mongoose from "mongoose";
import "base/models/registerModels";
import connectToDB from "base/configs/db";
import {
  connectWarehouseDB,
  getItemTrackingModel,
  getUsedItemTrackingModel,
  getWarehouseModel,
} from "@/lib/warehouseDb";
import Order from "base/models/Order";
import { syncOrderFulfillmentFromTracking } from "@/lib/orderFulfillmentSync";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { acquireTrackingMutation } from "base/services/orderTrackingMutation";
import { manualTrackingCount, trackingQuantities, matchMainTracking, lineTracking, validateManualTracking } from "@/lib/manualTracking";
import { revalidateContent } from "@/lib/revalidate";

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
  const { denied } = await requireAdminPermission("orderTracking.view");
  if (denied) return denied;

  try {
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

    // ─── tracking محصولات دست دوم (کالکشن جداگانه UsedItemTracking) ───
    // محصولات دست دوم در پروژه انبار در کالکشن دیگری با کلید usedProductRef
    // نگهداری می‌شوند؛ این‌جا بر اساس سفارش و/یا شناسه‌ی محصولات دست دومِ سفارش واکشی می‌شوند.
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

    // نگاشت usedProductRef → tracking های دست دومِ آن محصول
    const usedTrackingByProduct = new Map();
    for (const t of usedTrackingItems) {
      const key = t.usedProductRef?.toString();
      if (!key) continue;
      if (!usedTrackingByProduct.has(key)) usedTrackingByProduct.set(key, []);
      usedTrackingByProduct.get(key).push(t);
    }

    // tracking مربوط به خطِ اصلی هر آیتم:
    //  - ترجیحاً با orderItemIndex صریح تطبیق داده می‌شود (محصول معمولی و دست دوم)
    //  - محصول دست دوم بدون orderItemIndex (داده‌های قدیمی): با شناسه/بارکد/کدِ
    //    رهگیریِ ذخیره‌شده روی خودِ محصول دست دوم تطبیق می‌خورد — دقیق و بدون ابهام
    //    حتی اگر چند محصول دست دومِ هم‌پایه در یک سفارش باشند
    //  - محصول معمولی بدون orderItemIndex (داده‌های قدیمی): با productRef + variantRef
    //  - آیتم‌های متعلق به انتخاب‌های فرایند (flowNodeId غیرنال) هرگز اینجا شمرده نمی‌شوند
    // ساختار خروجی: برای هر آیتم سفارش، tracking خطِ اصلی + خطوط انتخاب‌های فرایند
    const itemsWithTracking = order.items.map((item, index) => {
      const isUsed = item.itemType === "used_product";
      // برای محصول دست دوم: tracking از کالکشن UsedItemTracking (بر اساس usedProductRef)
      // به‌علاوه‌ی هر tracking قدیمیِ احتمالی در ItemTracking
      const usedRelated = isUsed
        ? usedTrackingByProduct.get(item.usedProduct?._id?.toString()) || []
        : [];
      const mainRelated = [...matchMainTracking(item, index, trackingItems), ...usedRelated];
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
            ...trackingQuantities(s, item.quantity, related.length),
            trackingItems: related,
          };
        });

      const product = isUsed
        ? {
            _id: item.usedProduct?._id ?? item.product?._id ?? null,
            name: item.usedProduct?.name || item.product?.name || "محصول دست دوم",
            mainImage:
              item.usedProduct?.images?.[0] || item.product?.mainImage || null,
            sku: item.usedProduct?.sku || "USED-ITEM",
            isUsed: true,
          }
        : item.product;

      return {
        index,
        itemId: item._id,
        itemType: item.itemType || "product",
        isUsed,
        product,
        variant: item.variant,
        procurementStatus: item.procurementStatus || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        scannedCount: mainRelated.length,
        ...trackingQuantities(item, mainRequired, mainRelated.length),
        trackingItems: mainRelated,
        flowTracking,
      };
    });

    // مجموع موردنیاز = خطوط اصلی (دست دوم=۱) + خطوط فرایند (به‌ازای هر واحدِ آیتم)
    const totalRequired = itemsWithTracking.reduce((s, it) => {
      const main = it.isUsed ? 1 : it.quantity;
      const flow = (it.flowTracking || []).reduce((fs, f) => fs + f.quantity, 0);
      return s + main + flow;
    }, 0);

    // مجموع اسکن‌شده — شامل خطوط اصلی (محصول معمولی + دست دوم) و خطوط فرایند
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
        totalManual: itemsWithTracking.reduce((sum, item) => sum + item.manualCount + item.flowTracking.reduce((n, f) => n + f.manualCount, 0), 0),
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
  const { actor: admin, denied } = await requireAdminPermission("orderTracking.assign");
  if (denied) return denied;

  let release;
  try {
    await connectToDB();
    const { orderId } = await params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    release = await acquireTrackingMutation(orderId);
    const body = await req.json();
    const { barcode, orderItemIndex, procurementStatus } = body;
    // flowNodeId: اگر مقدار داشته باشد، بارکد برای یک «انتخابِ فرایند» (نود category) ثبت می‌شود
    const flowNodeId = body.flowNodeId || null;
    // action: scan / mark_purchase / set_manual (تعداد وضعیت‌های بدون بارکد)
    const action = body.action || "scan";

    const order = await Order.findById(orderId)
      .populate("items.product", "name mainImage sku _id")
      .populate("items.variant", "sku attributes _id")
      .populate("items.usedProduct", "warehouseTrackingId assignedBarcode assignedTrackingCode")
      .lean();

    if (!order)
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });

    if (
      !Number.isInteger(orderItemIndex) ||
      orderItemIndex < 0 ||
      orderItemIndex >= order.items.length
    )
      return NextResponse.json(
        { message: "ایندکس آیتم سفارش نامعتبر است" },
        { status: 400 }
      );

    const targetItem = order.items[orderItemIndex];
    if (body.itemId && String(targetItem._id) !== body.itemId) {
      return NextResponse.json({ message: "اقلام سفارش تغییر کرده‌اند؛ صفحه را تازه‌سازی کنید" }, { status: 409 });
    }
    const targetLine = flowNodeId
      ? (targetItem.flowSelections || []).find((s) => s.nodeId === flowNodeId && s.nodeType === "category" && s.selectedProduct)
      : targetItem;
    if (!targetLine) return NextResponse.json({ message: "انتخاب فرایند یافت نشد" }, { status: 400 });

    if (action === "set_manual") {
      if (!body.itemId || !Number.isSafeInteger(body.revision) || body.revision < 0) {
        return NextResponse.json({ message: "شناسه آیتم و نسخه وضعیت الزامی است" }, { status: 400 });
      }
      if (order.fulfillmentStatus === "CANCELED") {
        return NextResponse.json({ message: "ثبت وضعیت دستی برای این مورد مجاز نیست" }, { status: 400 });
      }
      if ((targetLine.manualTrackingRevision || 0) !== body.revision) {
        return NextResponse.json({ message: "وضعیت توسط کاربر دیگری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید" }, { status: 409 });
      }
      const warehouseConn = await connectWarehouseDB();
      const Tracking = getItemTrackingModel(warehouseConn);
      const tracked = await Tracking.find({ tenadorOrderId: orderId.toString() }).lean();
      const usedTracked = !flowNodeId && targetItem.itemType === "used_product" && targetItem.usedProduct
        ? await getUsedItemTrackingModel(warehouseConn).find({ usedProductRef: String(targetItem.usedProduct._id) }).lean()
        : [];
      const assigned = lineTracking(targetItem, orderItemIndex, flowNodeId, tracked, usedTracked).length;
      const quantity = !flowNodeId && targetItem.itemType === "used_product" ? 1 : targetItem.quantity;
      let rows;
      try {
        rows = validateManualTracking(body.manualTracking, quantity - assigned);
      } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      const prefix = flowNodeId
        ? `items.${orderItemIndex}.flowSelections.${targetItem.flowSelections.indexOf(targetLine)}`
        : `items.${orderItemIndex}`;
      await release.assertOwned();
      const saved = await Order.updateOne({
        _id: orderId,
        fulfillmentStatus: { $ne: "CANCELED" },
        [`items.${orderItemIndex}._id`]: targetItem._id,
        [`items.${orderItemIndex}.quantity`]: targetItem.quantity,
      }, {
        $set: {
          [`${prefix}.manualTracking`]: rows,
          manualTrackingEnabled: true,
          ...(assigned + manualTrackingCount({ manualTracking: rows }) === quantity && targetLine.procurementStatus === "TO_PURCHASE"
            ? { [`${prefix}.procurementStatus`]: null } : {}),
        },
        $inc: { [`${prefix}.manualTrackingRevision`]: 1 },
        $push: { [`${prefix}.manualTrackingHistory`]: {
          before: targetLine.manualTracking || [], after: rows, by: admin.userId, at: new Date(),
        } },
      }, { runValidators: true });
      if (!saved.matchedCount) {
        return NextResponse.json({ message: "سفارش تغییر کرده است؛ اطلاعات را تازه‌سازی کنید" }, { status: 409 });
      }
      const fresh = await Order.findById(orderId).select("fulfillmentStatus items.procurementStatus items.flowSelections.procurementStatus").lean();
      if (fresh?.fulfillmentStatus === "NEEDS_PURCHASE" && !orderHasPendingPurchase(fresh)) {
        await Order.updateOne({ _id: orderId, fulfillmentStatus: "NEEDS_PURCHASE" }, { $set: { fulfillmentStatus: "PROCESSING" } });
      }
      const fulfillmentStatus = await syncOrderFulfillmentFromTracking(orderId);
      revalidateContent(["orders"]);
      return NextResponse.json({ message: "وضعیت‌های دستی ذخیره شد", fulfillmentStatus });
    }
    if (!["scan", "mark_purchase"].includes(action)) {
      return NextResponse.json({ message: "عملیات نامعتبر است" }, { status: 400 });
    }

    // ─── علامت‌گذاری «باید خریداری شود» (بدون بارکد) ───
    // محصول هنوز خریداری نشده و بارکدی ندارد؛ فقط خطِ سفارش علامت می‌خورد و
    // وضعیت کل سفارش به «باید خریداری شود» تغییر می‌کند تا در لیست سفارش‌ها قابل شناسایی باشد.
    if (action === "mark_purchase") {
      if (manualTrackingCount(targetLine) > 0) {
        const conn = await connectWarehouseDB();
        const tracked = await getItemTrackingModel(conn).find({ tenadorOrderId: orderId.toString() }).lean();
        if (lineTracking(targetItem, orderItemIndex, flowNodeId, tracked).length + manualTrackingCount(targetLine) >= targetItem.quantity) {
          return NextResponse.json({ message: "تعداد نامشخصی برای خرید باقی نمانده است" }, { status: 400 });
        }
      }
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

      await release.assertOwned();
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

    if (typeof barcode !== "string" || !barcode.trim())
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

    if (trackingItem.tenadorOrderId === orderId.toString()) {
      return NextResponse.json({ message: "این بارکد قبلاً به همین سفارش اختصاص یافته است" }, { status: 409 });
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

    const manualCount = manualTrackingCount(targetLine);
    if (alreadyScanned + manualCount >= requiredCount) {
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

    await release.assertOwned();
    await trackingItem.save();

    // ─── بروزرسانی وضعیت تأمینِ خطِ سفارش روی خود سند سفارش ───
    // اگر این خط قبلاً «باید خریداری شود» بوده، حالا «خریداری شد» می‌شود؛ در غیر این صورت
    // مقدار ارسالی از کلاینت (IN_STOCK / PURCHASED) ثبت می‌شود.
    const lineProcurement = order.manualTrackingEnabled && targetLine.procurementStatus === "TO_PURCHASE" && alreadyScanned + manualCount + 1 < requiredCount
      ? "TO_PURCHASE" : procurementStatus || "IN_STOCK";
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
        remainingCount: requiredCount - alreadyScanned - manualCount - 1,
        fulfillmentStatus: updatedFulfillment,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking POST]", error);
    return NextResponse.json({ message: error.status ? error.message : "خطای داخلی سرور" }, { status: error.status || 500 });
  } finally {
    if (release) await release();
  }
}

/* ─── DELETE: حذف tracking item از سفارش ───────────────────────── */
export async function DELETE(req, { params }) {
  const { actor: admin, denied } = await requireAdminPermission("orderTracking.assign");
  if (denied) return denied;

  let release;
  try {
    await connectToDB();
    const { orderId } = await params;
    if (!mongoose.isValidObjectId(orderId)) return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    release = await acquireTrackingMutation(orderId);
    const body = await req.json();
    const { trackingItemId } = body;

    if (!trackingItemId)
      return NextResponse.json(
        { message: "شناسه آیتم الزامی است" },
        { status: 400 }
      );

    const warehouseConn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(warehouseConn);

    // ابتدا در ItemTracking (محصولات معمولی)، سپس در UsedItemTracking (دست دوم)
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

    await release.assertOwned();
    await item.save();

    // حذف بارکد ممکن است ترکیب باقی‌مانده را «همه تحویل‌شده» کند (یا برعکس)
    await syncOrderFulfillmentFromTracking(orderId);

    return NextResponse.json(
      { message: "بارکد از سفارش جدا شد" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/tracking DELETE]", error);
    return NextResponse.json({ message: error.status ? error.message : "خطای داخلی سرور" }, { status: error.status || 500 });
  } finally {
    if (release) await release();
  }
}
