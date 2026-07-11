/**
 * GET /api/coach/dashboard
 * Returns the logged-in coach's students, credit earned per student, and wallet balance.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";
import CoachWalletTransaction from "base/models/CoachWalletTransaction";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET() {
  try {
    await connectToDB();

    const auth = await getAuthUser();
    if (!auth?.userId) {
      return NextResponse.json({ message: "ورود به سیستم الزامی است" }, { status: 401 });
    }

    const coach = await User.findById(auth.userId)
      .select("name lastName email phone avatar coachCode walletBalance role")
      .lean();

    if (!coach || coach.role !== "coach") {
      return NextResponse.json({ message: "دسترسی تنها برای مربیان فعال مجاز است" }, { status: 403 });
    }

    // Students of this coach
    const students = await User.find({ coach: auth.userId })
      .select("name lastName phone email createdAt")
      .lean();

    // All wallet transactions for this coach
    const transactions = await CoachWalletTransaction.find({ coach: auth.userId })
      .sort({ createdAt: -1 })
      .lean();

    // Group credit by student
    const creditByStudent = {};
    const txByStudent = {};
    for (const tx of transactions) {
      const sid = tx.student?.toString() || "__manual__";
      creditByStudent[sid] = (creditByStudent[sid] || 0) + tx.amount;
      if (!txByStudent[sid]) txByStudent[sid] = [];
      txByStudent[sid].push(tx);
    }

    const totalCreditEarned = transactions.reduce((sum, t) => sum + t.amount, 0);

    const studentsWithCredit = students.map((s) => {
      const sid = s._id.toString();
      return {
        ...s,
        creditEarned: creditByStudent[sid] || 0,
        transactions: txByStudent[sid] || [],
      };
    });

    // Students with more credit appear first
    studentsWithCredit.sort((a, b) => b.creditEarned - a.creditEarned);

    return NextResponse.json({
      coach,
      students: studentsWithCredit,
      totalCreditEarned,
    });
  } catch (error) {
    console.error("[coach/dashboard GET]", error);
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
