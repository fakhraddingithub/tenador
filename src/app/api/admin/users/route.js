/**
 * src/app/api/admin/users/route.js
 *
 * GET → لیست کاربران برای پنل ادمین به همراه آمار کلی
 *        query params: search, role (all|admin|coach|user|seller|national_player), status (all|active|banned)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
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
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status") || "all";

    const filter = {};

    if (search) {
      const rx = { $regex: search, $options: "i" };
      filter.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { coachCode: rx },
      ];
    }

    if (role === "coach") {
      filter.role = "coach";
    } else if (role === "admin") {
      filter.role = "admin";
    } else if (role === "user") {
      filter.role = "user";
    } else if (role === "seller") {
      filter.role = "seller";
    } else if (role === "national_player") {
      filter.role = "national_player";
    }

    if (status === "active") filter.isBanned = { $ne: true };
    else if (status === "banned") filter.isBanned = true;

    const users = await User.find(filter)
      .select("name email phone role coachCode isBanned avatar level walletBalance createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // آمار کلی روی کل کاربران (مستقل از فیلتر)
    const [stats] = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isBanned", true] }, 0, 1] } },
          coaches: { $sum: { $cond: [{ $eq: ["$role", "coach"] }, 1, 0] } },
          banned: { $sum: { $cond: [{ $eq: ["$isBanned", true] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json(
      {
        users,
        stats: stats || { total: 0, active: 0, coaches: 0, banned: 0 },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/users GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
