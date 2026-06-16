/**
 * POST /api/admin/notifications/read-all
 * همه‌ی اعلان‌های خوانده‌نشده را خوانده‌شده علامت می‌زند.
 * می‌توان با body { type } فقط یک نوع خاص را علامت زد (اختیاری).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Notification, { NOTIFICATION_TYPES } from "base/models/Notification";
import { getNotificationCounts } from "base/services/notificationService";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    // body اختیاری — اگر type معتبر داده شود فقط همان نوع علامت می‌خورد
    let type = null;
    try {
      const body = await req.json();
      if (body?.type && NOTIFICATION_TYPES.includes(body.type)) type = body.type;
    } catch {
      // بدون body — همه را علامت بزن
    }

    const filter = { isRead: false, ...(type ? { type } : {}) };
    await Notification.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });

    const counts = await getNotificationCounts();
    return NextResponse.json({ message: "همه خوانده شد", counts }, { status: 200 });
  } catch (error) {
    console.error("[admin/notifications/read-all POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
