import "base/models/registerModels";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { getWalletHistory } from "base/services/walletHistory.service";
import { adjustUserWallet } from "base/services/adminWallet.service";

const fail = error => NextResponse.json({ message: error.code === 'WALLET_ADJUSTMENT_ERROR' ? error.message : 'خطا در پردازش کیف پول' }, { status: error.status || 500 });

export async function GET(req, { params }) {
  const { denied } = await requireAdminPermission("users.view");
  if (denied) return denied;
  try {
    const { userId } = await params;
    if (!mongoose.isValidObjectId(userId)) return NextResponse.json({ message: 'شناسه کاربر نامعتبر است' }, { status: 400 });
    await connectToDB();
    const user = await User.findById(userId).select('walletBalance').lean();
    if (!user) return NextResponse.json({ message: 'کاربر یافت نشد' }, { status: 404 });
    return NextResponse.json({ wallet: { balance: user.walletBalance ?? 0 }, transactions: await getWalletHistory(user._id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('[admin user wallet GET]', error); return fail(error); }
}

export async function POST(req, { params }) {
  const { actor, denied } = await requireAdminPermission("users.adjustWallet");
  if (denied) return denied;
  try {
    const { userId } = await params;
    if (!mongoose.isValidObjectId(userId)) return NextResponse.json({ message: 'شناسه کاربر نامعتبر است' }, { status: 400 });
    const { amount, type, description, requestKey } = await req.json().catch(() => ({}));
    await connectToDB();
    const result = await adjustUserWallet({ userId, adminId: actor.userId, amount, type, description, requestKey });
    return NextResponse.json({ message: result.replayed ? 'این تراکنش قبلاً ثبت شده است' : 'تراکنش کیف پول ثبت شد', balanceAfter: result.balanceAfter, transactionId: result.transaction, replayed: result.replayed });
  } catch (error) { console.error('[admin user wallet POST]', error); return fail(error); }
}
