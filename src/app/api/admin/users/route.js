/**
 * src/app/api/admin/users/route.js
 *
 * GET → لیست کاربران برای پنل ادمین به همراه آمار کلی
 *        query params: search, role (all|admin|coach|user|store|national_player), status (all|active|banned)
 */

import { withSearch } from "@/lib/search";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import requireAdminPermission from "@/lib/requireAdminPermission";

import User from "base/models/User";
export async function GET(req) {
  const { denied } = await requireAdminPermission("users.view");
  if (denied) return denied;

  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || "all";
    const status = searchParams.get("status") || "all";

    // هر توکن باید در یکی از این فیلدها بیاید. `$expr`ِ قبلی برای «نام +
    // نام‌خانوادگی» دیگر لازم نیست: توکن‌ها جدا تطبیق می‌خورند، پس «رضایی رضا»
    // هم پیدا می‌شود.
    const filter = withSearch({}, search, ["name", "lastName", "email", "phone", "coachCode"]);

    if (role === "coach") {
      filter.role = "coach";
    } else if (role === "admin") {
      filter.role = "admin";
    } else if (role === "user") {
      filter.role = "user";
    } else if (role === "store") {
      filter.role = "store";
    } else if (role === "national_player") {
      filter.role = "national_player";
    }

    if (status === "active") filter.isBanned = { $ne: true };
    else if (status === "banned") filter.isBanned = true;

    const users = await User.find(filter)
      .select("name lastName email phone role coachCode isBanned avatar level walletBalance createdAt")
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
