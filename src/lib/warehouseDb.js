/**
 * configs/warehouseDb.js
 *
 * اتصال جداگانه به دیتابیس انبارداری (warehouse DB)
 * این فایل توسط API های admin/orders/tracking استفاده می‌شود
 */

import mongoose from "mongoose";

const WAREHOUSE_URI = process.env.MONGODB_URI_WAREHOUSE;

let warehouseCache = global._warehouseConn || { conn: null, promise: null };
global._warehouseConn = warehouseCache;

export async function connectWarehouseDB() {
  if (warehouseCache.conn) return warehouseCache.conn;
  if (!warehouseCache.promise) {
    warehouseCache.promise = mongoose
      .createConnection(WAREHOUSE_URI, { bufferCommands: false })
      .asPromise();
  }
  warehouseCache.conn = await warehouseCache.promise;
  return warehouseCache.conn;
}

/**
 * برگرداندن مدل ItemTracking از warehouse connection
 */
export function getItemTrackingModel(conn) {
  if (conn.models.ItemTracking) return conn.models.ItemTracking;

  const ItemTrackingSchema = new mongoose.Schema(
    {
      productRef: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
      },
      variantRef: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },
      trackingId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      barcode: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      status: {
        type: String,
        enum: [
          "FR_WAREHOUSE",
          "READY_TO_SHIP",
          "IN_TRANSIT",
          "CUSTOMS_HOLD",
          "IR_WAREHOUSE",
          "SOLD",
          "DELIVERED",
          "RETURNED",
        ],
        default: "FR_WAREHOUSE",
      },
      currentWarehouse: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      relatedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
      },
      // شناسه سفارش در پروژه tenador (برای ربط دادن)
      tenadorOrderId: {
        type: String,
        default: null,
        index: true,
      },
      // وضعیت خرید: باید خریداری شود یا موجود است
      procurementStatus: {
        type: String,
        enum: ["IN_STOCK", "TO_PURCHASE", "PURCHASED"],
        default: null,
      },
      // ربط دقیق به خطِ سفارش: ایندکس آیتم در order.items
      orderItemIndex: {
        type: Number,
        default: null,
      },
      // اگر این آیتم برای یک «انتخابِ فرایند سفارش» (نود category) باشد، شناسه‌ی آن نود
      // مقدار null یعنی این tracking برای خودِ محصول اصلی است نه انتخاب‌های فرایند
      flowNodeId: {
        type: String,
        default: null,
      },
      history: [
        {
          status: { type: String, required: true },
          locationName: { type: String, required: true },
          note: { type: String },
          addedByName: { type: String },
          addedById: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
    { timestamps: true }
  );

  ItemTrackingSchema.index({ status: 1, currentWarehouse: 1 });
  ItemTrackingSchema.index({ tenadorOrderId: 1 });

  return conn.model("ItemTracking", ItemTrackingSchema);
}

/**
 * مدل Warehouse از warehouse connection
 */
export function getWarehouseModel(conn) {
  if (conn.models.Warehouse) return conn.models.Warehouse;

  const WarehouseSchema = new mongoose.Schema(
    {
      name: { type: String, required: true },
      manager: { type: String },
      locationType: { type: String, enum: ["FRANCE", "IRAN"] },
      address: { type: String },
      contactPhone: { type: String },
      capacity: { type: Number, default: 5000 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

  return conn.model("Warehouse", WarehouseSchema);
}
