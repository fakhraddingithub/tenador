/**
 * POST /api/admin/coaches/[coachId]/wallet
 * Adds credit (Tomans) to a coach's walletBalance and records the transaction.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { addCoachCredit } from "base/services/coachWallet.service";


import requireAdminPermission from "@/lib/requireAdminPermission";



export async function POST(req, { params }) {
  const { actor: admin, denied } = await requireAdminPermission("coaches.manageCredits");
  if (denied) return denied;

  try {
    await connectToDB();

    const { coachId } = await params;

    if (!mongoose.Types.ObjectId.isValid(coachId)) {
      return NextResponse.json(
        { message: "شناسه نامعتبر است" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const amount = Number(body.amount);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { message: "مبلغ وارد شده معتبر نیست" },
        { status: 400 }
      );
    }

    if (body.orderId && !mongoose.Types.ObjectId.isValid(body.orderId)) return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    const newBalance = await addCoachCredit({ coachId, amount, orderId: body.orderId || null, addedBy: admin.userId, note: String(body.note || "").slice(0, 1000) });

    return NextResponse.json({
      message: "کردیت با موفقیت به کیف پول مربی افزوده شد",
      newBalance,
    });
  } catch (error) {
    console.error("[admin/coaches/:id/wallet POST]", error);
    return NextResponse.json({ message: error.code === "WALLET_CHECKOUT_ERROR" ? error.message : "خطای سرور" }, { status: error.status || 500 });
  }
}
