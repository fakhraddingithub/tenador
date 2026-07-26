/**
 * POST /api/admin/coaches/[coachId]/wallet
 * Adds credit (Tomans) to a coach's walletBalance and records the transaction.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import Order from "base/models/Order";
import CoachWalletTransaction from "base/models/CoachWalletTransaction";

import requireAdmin, { unauthorized } from "@/lib/requireAdmin";

import User from "base/models/User";
// نقش ادمین از دیتابیس بررسی می‌شود (توکن به‌تنهایی قابل‌اعتماد نیست).
async function getAdminUser() {
  return await requireAdmin();
}

export async function POST(req, { params }) {
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

    const body = await req.json();
    const amount = Number(body.amount);

    if (!amount || amount <= 0 || !isFinite(amount)) {
      return NextResponse.json(
        { message: "مبلغ وارد شده معتبر نیست" },
        { status: 400 }
      );
    }

    // Resolve student from orderId for transaction tracking
    let studentId = null;
    const orderId = body.orderId && mongoose.Types.ObjectId.isValid(body.orderId)
      ? body.orderId
      : null;

    if (orderId) {
      const order = await Order.findById(orderId, "user").lean();
      studentId = order?.user || null;
    }

    // Increment wallet balance
    const coach = await User.findOneAndUpdate(
      { _id: coachId, role: "coach" },
      { $inc: { walletBalance: amount } },
      { new: true, select: "name walletBalance" }
    ).lean();

    if (!coach) {
      return NextResponse.json(
        { message: "مربی یافت نشد یا نقش مربی ندارد" },
        { status: 404 }
      );
    }

    // Record transaction for coach dashboard visibility
    await CoachWalletTransaction.create({
      coach: coachId,
      student: studentId,
      order: orderId,
      amount,
      addedBy: admin.userId,
      note: body.note || "",
    });

    return NextResponse.json({
      message: "کردیت با موفقیت به کیف پول مربی افزوده شد",
      newBalance: coach.walletBalance,
    });
  } catch (error) {
    console.error("[admin/coaches/:id/wallet POST]", error);
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
