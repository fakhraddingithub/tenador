/**
 * POST /api/admin/coaches/[coachId]/wallet
 * Adds credit (Tomans) to a coach's walletBalance.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded || null;
}

export async function POST(req, { params }) {
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

    return NextResponse.json({
      message: "کردیت با موفقیت به کیف پول مربی افزوده شد",
      newBalance: coach.walletBalance,
    });
  } catch (error) {
    console.error("[admin/coaches/:id/wallet POST]", error);
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
