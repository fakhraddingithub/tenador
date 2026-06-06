/**
 * src/lib/usedTrackingAuto.js
 *
 * اختصاص خودکارِ tracking item انبار به آیتم‌های محصول دست‌دوم یک سفارش.
 *
 * چون هر محصول دست‌دوم منحصربه‌فرد است (فقط یک کالای فیزیکی مشخص)، tracking item
 * از پیش‌تولیدشده‌ی آن در انبار به‌صورت خودکار به سفارش وصل می‌شود. tracking مربوطه
 * از روی فیلدهای ذخیره‌شده روی خود محصول دست‌دوم شناسایی می‌شود
 * (warehouseTrackingId یا assignedBarcode / assignedTrackingCode) تا هیچ ابهام یا
 * تداخلی با محصولات دست‌دومِ دیگرِ همان محصولِ پایه پیش نیاید.
 *
 * ⚠️ این تابع هرگز نباید روند ثبت سفارش را متوقف کند؛ همه‌ی خطاها بلعیده می‌شوند.
 */

import { connectWarehouseDB, getItemTrackingModel } from "@/lib/warehouseDb";
import UsedProduct from "base/models/UsedProduct";

export async function autoAssignUsedProductTracking(order) {
  if (!order?._id || !Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  // استخراج آیتم‌های دست‌دوم به‌همراه ایندکس‌شان در سفارش
  const usedEntries = [];
  order.items.forEach((item, index) => {
    if (item?.itemType === "used_product" && item?.usedProduct) {
      usedEntries.push({ usedProductId: item.usedProduct.toString(), index });
    }
  });
  if (usedEntries.length === 0) return;

  let ItemTracking;
  try {
    const conn = await connectWarehouseDB();
    ItemTracking = getItemTrackingModel(conn);
  } catch (err) {
    console.warn(
      "[autoAssignUsedTracking] اتصال به انبار ناموفق بود:",
      err?.message,
    );
    return;
  }

  for (const { usedProductId, index } of usedEntries) {
    try {
      const up = await UsedProduct.findById(usedProductId).lean();
      if (!up) continue;

      // ─── شناسایی tracking item منحصربه‌فردِ این محصول دست‌دوم ───
      let tracking = null;

      if (up.warehouseTrackingId) {
        try {
          tracking = await ItemTracking.findById(up.warehouseTrackingId);
        } catch {
          tracking = null;
        }
      }

      if (!tracking && (up.assignedBarcode || up.assignedTrackingCode)) {
        const or = [];
        if (up.assignedBarcode) or.push({ barcode: up.assignedBarcode });
        if (up.assignedTrackingCode) or.push({ trackingId: up.assignedTrackingCode });
        if (or.length) tracking = await ItemTracking.findOne({ $or: or });
      }

      if (!tracking) {
        console.warn(
          `[autoAssignUsedTracking] tracking انبار برای محصول دست‌دوم ${usedProductId} یافت نشد`,
        );
        continue;
      }

      // اگر این tracking قبلاً به سفارش دیگری وصل است، دست نزن (جلوگیری از تداخل)
      if (
        tracking.tenadorOrderId &&
        tracking.tenadorOrderId !== order._id.toString()
      ) {
        console.warn(
          `[autoAssignUsedTracking] tracking ${tracking.trackingId} قبلاً به سفارش ${tracking.tenadorOrderId} وصل است`,
        );
        continue;
      }

      tracking.tenadorOrderId = order._id.toString();
      tracking.relatedOrder = order._id;
      tracking.procurementStatus = "IN_STOCK";
      tracking.orderItemIndex = index;
      tracking.flowNodeId = null;
      tracking.history.push({
        status: tracking.status,
        locationName: "سیستم تنادور",
        note: `اختصاص خودکار محصول دست‌دوم به سفارش ${order.trackingCode}`,
        addedByName: "سیستم",
      });
      await tracking.save();

      await UsedProduct.findByIdAndUpdate(usedProductId, {
        warehouseTrackingId: tracking._id.toString(),
        assignedBarcode: tracking.barcode,
        assignedTrackingCode: tracking.trackingId,
        status: "reserved",
        order: order._id,
      });
    } catch (err) {
      console.warn(
        `[autoAssignUsedTracking] اختصاص برای ${usedProductId} ناموفق:`,
        err?.message,
      );
    }
  }
}
