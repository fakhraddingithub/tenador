/**
 * GET /api/admin/notifications/counts
 * فقط شمارش خوانده‌نشده‌ها (کل، بر اساس نوع و بخش) — سبک، برای بَج‌های سایدبار.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import { getNotificationCounts } from "base/services/notificationService";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET() {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const counts = await getNotificationCounts();
    return NextResponse.json({ counts }, { status: 200 });
  } catch (error) {
    console.error("[admin/notifications/counts GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
