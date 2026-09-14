import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import User from "base/models/User";
import { getWalletHistory } from "base/services/walletHistory.service";


import { verifyToken } from "base/utils/auth";

export async function GET() {
  try {
    const token = (await cookies()).get("accessToken")?.value;
    const auth = token ? verifyToken(token) : null;
    if (!auth?.userId) {
      return NextResponse.json({ message: "ورود به سیستم الزامی است" }, { status: 401 });
    }

    await connectToDB();
    const user = await User.findById(auth.userId).select("walletBalance").lean();
    if (!user) {
      return NextResponse.json({ message: "حساب کاربری یافت نشد" }, { status: 401 });
    }

    const transactions = await getWalletHistory(user._id);

    return NextResponse.json(
      { wallet: { balance: user.walletBalance ?? 0 }, transactions },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/wallet]", error);
    return NextResponse.json({ message: "خطا در بارگذاری کیف پول" }, { status: 500 });
  }
}
