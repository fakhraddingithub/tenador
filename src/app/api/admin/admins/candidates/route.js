/**
 * src/app/api/admin/admins/candidates/route.js
 *
 * GET → انتخابگرِ کاربر برای ساختِ عضویتِ ادمین (فاز ۳).
 *
 * چرا یک endpoint جدا و نه استفاده‌ی دوباره از /api/admin/users:
 *   ۱) کلیدِ لازم فرق می‌کند. ساختِ ادمین `admins.create` است؛ اجبار به داشتنِ
 *      `users.view` یعنی هرکس بتواند ادمین بسازد باید کلِ پایگاه کاربران را
 *      هم ببیند.
 *   ۲) خروجی باید *وضعیتِ عضویت* را هم بگوید تا UI بین «ساختِ جدید» و
 *      «ویرایش/بازفعال‌سازیِ عضویتِ موجود» تمایز بگذارد.
 *   ۳) صفحه‌بندیِ واقعی لازم است؛ آن روت ۵۰۰ رکورد را یک‌جا می‌دهد.
 *
 * کاربرانِ دارای عضویت *حذف نمی‌شوند*: با برچسبِ عضویت برمی‌گردند تا کاربر
 * پیامِ گمراه‌کننده‌ی «پیدا نشد» نگیرد و مسیرِ درست به او نشان داده شود.
 */

import { withSearch } from "@/lib/search";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import User from "base/models/User";
import Admin from "base/models/Admin";

import requireAdminPermission from "@/lib/requireAdminPermission";

const MAX_LIMIT = 50;

/** فیلدهایی که برای شناختنِ کاربر لازم است — نه بیشتر. */
const USER_FIELDS = "name lastName phone email avatar role isBanned createdAt";

export async function GET(req) {
  const { denied } = await requireAdminPermission("admins.create");
  if (denied) return denied;

  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20)
    );

    // ⚠️ ورودی هرگز مستقیم وارد RegExp نمی‌شود: توکن‌ساز هر چیزی جز حرف و رقم
    // را دور می‌ریزد، پس `(a+)+$` هم به یک توکنِ تحت‌اللفظی تبدیل می‌شود.
    const filter = withSearch({}, search, ["name", "lastName", "phone", "email"]);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // وضعیتِ عضویتِ همین صفحه — یک کوئری، نه N تا.
    const memberships = users.length
      ? await Admin.find({ user: { $in: users.map((u) => u._id) } })
          .select("user isActive role")
          .populate("role", "name isFullAccess")
          .lean()
      : [];

    const byUser = new Map(memberships.map((m) => [String(m.user), m]));

    return NextResponse.json(
      {
        users: users.map((user) => {
          const membership = byUser.get(String(user._id)) || null;
          return {
            ...user,
            membership: membership
              ? {
                  _id: membership._id,
                  isActive: membership.isActive,
                  roleName: membership.role?.name || null,
                  isFullAccess: !!membership.role?.isFullAccess,
                }
              : null,
            // چرا این کاربر قابل انتخاب نیست (اگر نیست) — تصمیم سمتِ سرور
            // گرفته می‌شود تا UI و API یک قاعده داشته باشند.
            blockedReason: user.isBanned
              ? "banned"
              : membership
                ? "already-member"
                : null,
          };
        }),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/admins/candidates GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
