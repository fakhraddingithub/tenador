/**
 * src/app/api/admin/orders/route.js
 *
 * GET  → لیست تمام سفارشات (ادمین)
 *        query params:
 *          page, limit, search, paymentStatus, fulfillmentStatus, paymentMethod
 *
 * تغییرات:
 * - جستجو روی نام کاربر هم اضافه شد (با lookup)
 * - مرتب‌سازی همیشه بر اساس تاریخ ثبت (جدیدترین اول)؛ سفارش‌های دیده‌نشده با
 *   هایلایت بصری در کلاینت مشخص می‌شوند، نه با جابه‌جایی در ترتیب
 */

import { buildSearchFilter } from "@/lib/search";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Product from "base/models/Product";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function GET(req) {
  const { denied } = await requireAdminPermission("orders.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search")?.trim() || "";
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const fulfillmentStatus = searchParams.get("fulfillmentStatus") || "all";
    const paymentMethod = searchParams.get("paymentMethod") || "all";

    // ساخت فیلتر
    const filter = {};

    if (paymentStatus !== "all") filter.paymentStatus = paymentStatus;
    if (fulfillmentStatus !== "all") filter.fulfillmentStatus = fulfillmentStatus;
    if (paymentMethod !== "all") filter.paymentMethod = paymentMethod;

    const skip = (page - 1) * limit;

    let orders;
    let total;

    // هر جستجویی از مسیرِ aggregate می‌رود. قبلاً اگر عبارت با رقم شروع می‌شد
    // فقط روی trackingCode جستجو می‌شد، یعنی «۱۲۳۴ رضا» هیچ‌وقت جواب نمی‌داد و
    // دو مسیر خروجیِ متفاوت می‌ساختند (نامِ محصول در یکی نبود).
    if (search) {
      const matchStage = {};
      if (paymentStatus !== "all") matchStage.paymentStatus = paymentStatus;
      if (fulfillmentStatus !== "all") matchStage.fulfillmentStatus = fulfillmentStatus;
      if (paymentMethod !== "all") matchStage.paymentMethod = paymentMethod;

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userObj",
          },
        },
        { $unwind: { path: "$userObj", preserveNullAndEmpty: true } },
        // هر توکنِ عبارت باید در یکی از این فیلدها بیاید — پس «رضا ۱۲۳۴» هم
        // کار می‌کند و ترتیبِ «نام خانوادگی نام» هم فرقی ندارد.
        {
          $match: buildSearchFilter(search, [
            "trackingCode",
            "userObj.name",
            "userObj.lastName",
            "userObj.phone",
            "userObj.email",
          ]) || {},
        },
        // جدیدترین اول؛ _id به‌عنوان tiebreaker تا صفحه‌بندی پایدار بماند
        { $sort: { createdAt: -1, _id: -1 } },
      ];

      const countPipeline = [...pipeline, { $count: "total" }];
      const [countResult] = await Order.aggregate(countPipeline);
      total = countResult?.total || 0;

      const dataPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: "payments",
            localField: "payments",
            foreignField: "_id",
            as: "payments",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "_products",
            pipeline: [{ $project: { name: 1, mainImage: 1, sku: 1 } }],
          },
        },
      ];

      const rawOrders = await Order.aggregate(dataPipeline);
      // populate دستی: `_products` بالا lookup می‌شد ولی هیچ‌وقت به items وصل
      // نمی‌شد، برای همین در نتایجِ جستجو نامِ محصول خالی بود.
      orders = rawOrders.map(({ userObj, _products, ...o }) => {
        const byId = new Map((_products || []).map((p) => [String(p._id), p]));
        return {
          ...o,
          user: userObj || null,
          items: (o.items || []).map((item) => {
            const product = byId.get(String(item.product));
            return product
              ? { ...item, product: { _id: product._id, name: product.name, mainImage: product.mainImage, sku: product.sku } }
              : item;
          }),
        };
      });
    } else {
      // جستجوی معمولی با trackingCode
      total = await Order.countDocuments(filter);
      orders = await Order.find(filter)
        .populate("user", "name lastName phone email")
        .populate({
          path: "payments",
          select: "method amount status bankReceipt onlinePayment createdAt",
        })
        .populate("items.product", "name mainImage sku")
        .sort({ createdAt: -1, _id: -1 }) // جدیدترین اول؛ _id برای صفحه‌بندی پایدار
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // آمار کلی
    const [stats] = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unpaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "UNPAID"] }, 1, 0] } },
          partiallyPaid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PARTIALLY_PAID"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] } },
          waiting: { $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "WAITING"] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "PROCESSING"] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "SENT"] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "DELIVERED"] }, 1, 0] } },
          canceled: { $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "CANCELED"] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$totalPrice", 0] } },
          unseenCount: { $sum: { $cond: [{ $eq: ["$reviewedAt", null] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json(
      {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: stats || {
          total: 0, unpaid: 0, partiallyPaid: 0, paid: 0,
          waiting: 0, processing: 0, sent: 0, delivered: 0, canceled: 0,
          totalRevenue: 0, unseenCount: 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}