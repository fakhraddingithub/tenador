/**
 * GET /api/admin/notifications
 * جدیدترین اعلان‌های پنل مدیریت + شمارش خوانده‌نشده‌ها (کل، بر اساس نوع و بخش).
 *
 * query: ?limit=20
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import { getRecentNotifications } from "base/services/notificationService";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET(req) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");

    const { items, counts } = await getRecentNotifications(limit);

    return NextResponse.json({ notifications: items, counts }, { status: 200 });
  } catch (error) {
    console.error("[admin/notifications GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
