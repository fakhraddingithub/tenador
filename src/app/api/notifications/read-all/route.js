/**
 * POST /api/notifications/read-all
 *
 * همه‌ی اعلان‌های کاربرِ واردشده را «خوانده‌شده» علامت می‌زند (watermark = اکنون).
 * بَجِ نخوانده پس از این صفر می‌شود و با باز/بسته‌کردنِ دوباره برنمی‌گردد.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import { markAllRead } from "base/services/userNotificationService";

async function getAuthUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId || null;
}

export async function POST() {
  try {
    await connectToDB();
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { unreadCount } = await markAllRead({ _id: userId });
    return NextResponse.json({ message: "همه خوانده شد", unreadCount }, { status: 200 });
  } catch (error) {
    console.error("[notifications/read-all POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
