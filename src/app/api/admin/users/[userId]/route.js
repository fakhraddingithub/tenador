/**
 * src/app/api/admin/users/[userId]/route.js
 *
 * GET   → جزئیات کامل یک کاربر (پروفایل، آدرس‌ها، سفارش‌ها، پرداخت‌ها، مربی، شاگردان)
 * PATCH → ویرایش اطلاعات کاربر توسط ادمین
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import Address from "base/models/Address";
import Order from "base/models/Order";
import Payment from "base/models/Payment";

async function generateUniqueCoachCode() {
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    code = `TR${randomDigits}`;
    const exists = await User.findOne({ coachCode: code });
    if (!exists) isUnique = true;
  }
  return code;
}

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { userId } = await params;

    const user = await User.findById(userId)
      .select("-password -otp")
      .populate("coach", "name lastName coachCode avatar phone email")
      .lean();

    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    // آدرس‌ها
    const addresses = await Address.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    // سفارش‌ها
    const orders = await Order.find({ user: userId })
      .select(
        "trackingCode items subtotalPrice discountAmount couponDiscount totalPrice paymentMethod paymentStatus fulfillmentStatus orderDate createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((o) => o._id);

    // پرداخت‌ها (بر اساس سفارش‌های کاربر)
    const payments = orderIds.length
      ? await Payment.find({ order: { $in: orderIds } })
          .select("order method amount status bankReceipt onlinePayment createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // نگاشت کد رهگیری به هر پرداخت برای نمایش راحت‌تر
    const orderTrackingMap = {};
    orders.forEach((o) => {
      orderTrackingMap[o._id.toString()] = {
        trackingCode: o.trackingCode,
        _id: o._id,
      };
    });
    const paymentsWithOrder = payments.map((p) => ({
      ...p,
      orderInfo: orderTrackingMap[p.order?.toString()] || null,
    }));

    // شاگردان (در صورتی که کاربر مربی است)
    let students = [];
    if (user.role === "coach") {
      students = await User.find({ coach: userId })
        .select("name lastName phone email avatar createdAt isBanned")
        .sort({ createdAt: -1 })
        .lean();
    }

    return NextResponse.json(
      {
        user,
        addresses,
        orders,
        payments: paymentsWithOrder,
        students,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/users/[userId] GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectToDB();
    const { userId } = await params;
    const body = await req.json();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 404 });
    }

    const editableFields = ["name", "lastName", "email", "phone", "avatar"];
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        user[field] = body[field] === "" ? undefined : body[field];
      }
    }

    if (body.level !== undefined) user.level = Number(body.level) || 0;
    if (body.walletBalance !== undefined)
      user.walletBalance = Number(body.walletBalance) || 0;
    if (body.isBanned !== undefined) user.isBanned = Boolean(body.isBanned);

    if (body.role !== undefined) {
      const validRoles = ["user", "coach", "admin", "seller", "national_player", "store"];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ message: "نقش نامعتبر است" }, { status: 400 });
      }
      user.role = body.role;
      // اگر کاربر مربی شد و هنوز کد مربیگری ندارد، یک کد جدید بساز
      if (body.role === "coach" && !user.coachCode) {
        user.coachCode = await generateUniqueCoachCode();
      }
    }

    // امکان ویرایش/پاک کردن مربی متصل به کاربر
    if (body.coach !== undefined) {
      user.coach = body.coach || null;
    }

    await user.save();

    const updated = await User.findById(userId)
      .select("-password -otp")
      .populate("coach", "name lastName coachCode avatar phone email")
      .lean();

    return NextResponse.json(
      { message: "اطلاعات کاربر با موفقیت بروزرسانی شد", user: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/users/[userId] PATCH]", error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { message: "این ایمیل یا شماره تلفن قبلاً ثبت شده است" },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
