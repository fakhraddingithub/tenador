/**
 * src/lib/orderFulfillmentSync.js
 *
 * همگام‌سازی خودکار وضعیت سفارش (fulfillmentStatus) با وضعیت بارکدهای
 * (tracking) اختصاص‌یافته به آیتم‌های آن در دیتابیس انبار.
 *
 * قانون: سفارش فقط وقتی «تحویل شده» است که همه‌ی بارکدهای همه‌ی آیتم‌هایش
 * DELIVERED باشند؛ اگر حتی یک بارکد تحویل نشده باشد، سفارشِ DELIVERED به
 * PROCESSING برمی‌گردد.
 *
 * تعامل با وضعیت دستی: فقط دو گذارِ خودکار انجام می‌شود —
 *   ۱) همه‌ی بارکدها DELIVERED → DELIVERED (سفارش لغوشده هرگز تغییر نمی‌کند)
 *   ۲) وضعیت فعلی DELIVERED ولی بارکدی هنوز تحویل نشده → PROCESSING
 * وضعیت‌های میانی گردش‌کار (WAITING / NEEDS_PURCHASE / SENT) که ادمین یا
 * منطق موجود ست کرده دست‌نخورده می‌مانند و سفارشِ بدون بارکد هیچ‌وقت
 * خودکار تغییر نمی‌کند — وگرنه هر همگام‌سازی، وضعیت دستی را می‌شکست.
 *
 * آپدیت به‌صورت compare-and-swap شرطی است (فقط از همان وضعیتی که تصمیم بر
 * اساس آن گرفته شد) تا race با آپدیت دستی/همزمان وضعیت ناسازگار نسازد؛ و
 * چون این تابع فقط Order را می‌نویسد (نه tracking را)، حلقه‌ی آپدیت ممکن
 * نیست. هرگز مسیر فراخوان را نمی‌شکند؛ همه‌ی خطاها بلعیده می‌شوند
 * (همان الگوی usedTrackingAuto).
 */

import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import {
  connectWarehouseDB,
  getItemTrackingModel,
  getUsedItemTrackingModel,
} from "@/lib/warehouseDb";

/**
 * تصمیم خالص: وضعیت بعدی سفارش یا null (بدون تغییر)
 * @param {string} currentStatus  وضعیت فعلی fulfillmentStatus
 * @param {string[]} trackingStatuses  وضعیت همه‌ی بارکدهای اختصاص‌یافته
 */
export function decideAutoFulfillment(currentStatus, trackingStatuses) {
  if (currentStatus === "CANCELED") return null;
  if (!trackingStatuses || trackingStatuses.length === 0) return null;

  const allDelivered = trackingStatuses.every((s) => s === "DELIVERED");
  if (allDelivered) {
    return currentStatus === "DELIVERED" ? null : "DELIVERED";
  }
  return currentStatus === "DELIVERED" ? "PROCESSING" : null;
}

/**
 * بازمحاسبه و اعمال وضعیت سفارش از روی بارکدهای انبار.
 * @returns {Promise<string|null>} وضعیت جدید اگر تغییری اعمال شد، وگرنه null
 */
export async function syncOrderFulfillmentFromTracking(orderId) {
  try {
    const id = orderId?.toString();
    if (!id) return null;

    await connectToDB();
    const order = await Order.findById(id)
      .select("fulfillmentStatus items.itemType items.usedProduct")
      .lean();
    if (!order || order.fulfillmentStatus === "CANCELED") return null;

    const conn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(conn);
    const UsedItemTracking = getUsedItemTrackingModel(conn);

    // همان منطق تطبیقِ صفحه‌ی tracking سفارش: بارکدهای معمولی با tenadorOrderId؛
    // دست‌دوم‌ها با tenadorOrderId یا usedProductRef (سازگار با داده‌های قدیمی)
    const usedProductIds = (order.items || [])
      .filter((it) => it.itemType === "used_product" && it.usedProduct)
      .map((it) => it.usedProduct.toString());

    const usedFilter =
      usedProductIds.length > 0
        ? { $or: [{ tenadorOrderId: id }, { usedProductRef: { $in: usedProductIds } }] }
        : { tenadorOrderId: id };

    const [items, usedItems] = await Promise.all([
      ItemTracking.find({ tenadorOrderId: id }).select("status").lean(),
      UsedItemTracking.find(usedFilter).select("status").lean(),
    ]);

    const statuses = [...items, ...usedItems].map((t) => t.status);
    const next = decideAutoFulfillment(order.fulfillmentStatus, statuses);
    if (!next) return null;

    const res = await Order.updateOne(
      { _id: id, fulfillmentStatus: order.fulfillmentStatus },
      { $set: { fulfillmentStatus: next } }
    );
    return res.modifiedCount > 0 ? next : null;
  } catch (err) {
    console.warn("[orderFulfillmentSync]", err?.message);
    return null;
  }
}
