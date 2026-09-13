import "base/models/registerModels";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";
import Coupon from "base/models/Coupon";
import { issueCoachCoupon, coachWalletError } from "base/services/coachWallet.service";
import { revalidateContent } from "@/lib/revalidate";

async function authenticate() {
  const token = (await cookies()).get("accessToken")?.value;
  const auth = token && verifyToken(token);
  if (!auth?.userId) throw coachWalletError("ورود به سیستم الزامی است", 401);
  await connectToDB();
  const coach = await User.findOne({ _id: auth.userId, role: "coach", isBanned: { $ne: true } }).select("walletBalance").lean();
  if (!coach) throw coachWalletError("دسترسی فقط برای مربی فعال مجاز است", 403);
  return coach;
}
const failure = (error) => {
  console.error('[coach/coupons]', error);
  return NextResponse.json({ message: error.code === 'WALLET_CHECKOUT_ERROR' ? error.message : 'خطا در پردازش کد تخفیف' }, { status: error.status || 500 });
};

export async function GET(req) {
  try {
    const coach = await authenticate();
    const page = Math.max(1, Math.min(10000, Number(new URL(req.url).searchParams.get('page')) || 1));
    const coupons = await Coupon.find({ createdByCoach: coach._id })
      .select("code discount coachName createdAt active usedAt usedByName usedTrackingCode appliedAmount returnedAmount")
      .sort({ createdAt: -1, _id: -1 }).skip((Math.floor(page) - 1) * 20).limit(21).lean();
    return NextResponse.json({ coupons: coupons.slice(0, 20), hasMore: coupons.length > 20, balance: coach.walletBalance ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(req) {
  try {
    const coach = await authenticate();
    const { amount, code, requestKey } = await req.json();
    const result = await issueCoachCoupon({ coachId: coach._id, amount, code, requestKey });
    try { revalidateContent(["products", "events"]); } catch (error) { console.error('[coach coupon cache]', error); }
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return failure(error); }
}
