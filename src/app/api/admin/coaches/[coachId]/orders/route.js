/**
 * GET /api/admin/coaches/[coachId]/orders
 * Returns coach info + students with their orders (unreviewed orders first).
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import "base/models/Product";

import requireAdmin, { unauthorized } from "@/lib/requireAdmin";

import User from "base/models/User";
// نقش ادمین از دیتابیس بررسی می‌شود (توکن به‌تنهایی قابل‌اعتماد نیست).
async function getAdminUser() {
  return await requireAdmin();
}

export async function GET(req, { params }) {
  if (!(await requireAdmin())) return unauthorized();

  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { coachId } = await params;

    if (!mongoose.Types.ObjectId.isValid(coachId)) {
      return NextResponse.json(
        { message: "شناسه نامعتبر است" },
        { status: 400 }
      );
    }

    const coach = await User.findById(coachId)
      .select("name lastName email phone coachCode avatar walletBalance")
      .lean();

    if (!coach) {
      return NextResponse.json({ message: "مربی یافت نشد" }, { status: 404 });
    }

    const students = await User.find({ coach: coachId })
      .select("name lastName email phone createdAt")
      .lean();

    const studentIds = students.map((s) => s._id);

    let orders = [];
    if (studentIds.length > 0) {
      orders = await Order.find({ user: { $in: studentIds } })
        .select(
          "trackingCode totalPrice finalPrice orderDate paymentStatus fulfillmentStatus reviewedAt user items"
        )
        .populate({ path: "items.product", model: "Product", select: "name mainImage" })
        .sort({ reviewedAt: 1, orderDate: -1 })
        .lean();
    }

    // Group orders by student
    const ordersByStudent = {};
    for (const order of orders) {
      const uid = order.user.toString();
      if (!ordersByStudent[uid]) ordersByStudent[uid] = [];
      ordersByStudent[uid].push(order);
    }

    const studentsWithOrders = students.map((s) => ({
      ...s,
      orders: ordersByStudent[s._id.toString()] || [],
    }));

    // Students with unreviewed orders come first
    studentsWithOrders.sort((a, b) => {
      const aHas = a.orders.some((o) => !o.reviewedAt);
      const bHas = b.orders.some((o) => !o.reviewedAt);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    const unreviewedCount = orders.filter((o) => !o.reviewedAt).length;

    return NextResponse.json({ coach, students: studentsWithOrders, unreviewedCount });
  } catch (error) {
    console.error("[admin/coaches/:id/orders GET]", error);
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
