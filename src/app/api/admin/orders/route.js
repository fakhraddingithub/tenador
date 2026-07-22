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

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Product from "base/models/Product";
import User from "base/models/User";


async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId || decoded.role !== "admin") return null;
  return decoded;
}

export async function GET(req) {
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

    if (search) {
      filter.$or = [
        { trackingCode: { $regex: search, $options: "i" } },
      ];
      // جستجوی نام کاربر از طریق User model می‌آید
      // چون populate بعد از query انجام می‌شود، فقط روی trackingCode جستجو می‌کنیم
      // برای جستجوی نام، aggregation pipeline استفاده می‌کنیم
    }

    const skip = (page - 1) * limit;

    // اگه search داریم و ممکنه نام کاربر باشه، از aggregate استفاده می‌کنیم
    let orders;
    let total;

    if (search && !/^\d/.test(search) && !search.startsWith("20")) {
      // ممکنه نام کاربر باشه — aggregate با lookup
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
        {
          $match: {
            $or: [
              { trackingCode: { $regex: search, $options: "i" } },
              { "userObj.name": { $regex: search, $options: "i" } },
              { "userObj.lastName": { $regex: search, $options: "i" } },
              {
                $expr: {
                  $regexMatch: {
                    input: {
                      $trim: { input: { $concat: [{ $ifNull: ["$userObj.name", ""] }, " ", { $ifNull: ["$userObj.lastName", ""] }] } },
                    },
                    regex: search,
                    options: "i",
                  },
                },
              },
              { "userObj.phone": { $regex: search, $options: "i" } },
            ],
          },
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
          },
        },
      ];

      const rawOrders = await Order.aggregate(dataPipeline);
      // اضافه کردن user و populate کردن دستی
      orders = rawOrders.map((o) => ({
        ...o,
        user: o.userObj || null,
      }));
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