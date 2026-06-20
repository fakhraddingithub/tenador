/**
 * GET /api/notifications
 *
 * اعلان‌های مرتبط با کاربرِ واردشده (all + نقشِ او + group/single هدف‌گرفته به او)
 * به‌همراه شمارشِ نخوانده. جدیدترین اول.
 *
 * query: ?limit=30
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import User from "base/models/User";
import { getUserNotifications } from "base/services/userNotificationService";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  // نقش از دیتابیس خوانده می‌شود (هدف‌گذاری بر اساس نقش به آن وابسته است)
  const user = await User.findById(decoded.userId).select("role").lean();
  if (!user) return null;
  return { _id: decoded.userId, role: user.role };
}

export async function GET(req) {
  try {
    await connectToDB();
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");

    const { items, unreadCount } = await getUserNotifications(user, { limit });

    return NextResponse.json(
      { notifications: items, unreadCount },
      { status: 200 }
    );
  } catch (error) {
    console.error("[notifications GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
