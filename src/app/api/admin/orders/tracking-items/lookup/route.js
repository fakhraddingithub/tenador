/**
 * src/app/api/admin/orders/tracking-items/lookup/route.js
 *
 * GET ?code=XXX
 *
 * جستجوی یک بارکد یا tracking ID در دیتابیس انبارداری
 * استفاده می‌شود هنگام اسکن بارکد در صفحه سفارش ادمین
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  connectWarehouseDB,
  getItemTrackingModel,
  getWarehouseModel,
} from "base/configs/warehouseDb";
import { verifyToken } from "base/utils/auth";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded;
}

export async function GET(req) {
  try {
    const admin = await getAdminUser();
   
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();

    if (!code)
      return NextResponse.json(
        { message: ".کد الزامی است", found: false },
        { status: 400 }
      );

    const warehouseConn = await connectWarehouseDB();
    const ItemTracking = getItemTrackingModel(warehouseConn);
    const Warehouse = getWarehouseModel(warehouseConn);

    const item = await ItemTracking.findOne({
      $or: [{ barcode: code }, { trackingId: code }],
    })
      .populate({ path: "currentWarehouse", model: Warehouse })
      .lean();

    if (!item)
      return NextResponse.json({ found: false }, { status: 200 });

    return NextResponse.json(
      {
        found: true,
        item: {
          _id: item._id,
          trackingId: item.trackingId,
          barcode: item.barcode,
          status: item.status,
          procurementStatus: item.procurementStatus,
          productRef: item.productRef,
          variantRef: item.variantRef,
          tenadorOrderId: item.tenadorOrderId,
          currentWarehouse: item.currentWarehouse,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/tracking-items/lookup GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
