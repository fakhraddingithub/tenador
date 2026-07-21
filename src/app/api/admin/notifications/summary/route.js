/**
 * GET /api/admin/notifications/summary
 * منبعِ واحدِ حالت اعلان‌های پنل مدیریت — همه‌چیز در یک درخواست:
 *  - items:      جدیدترین اعلان‌ها (برای زنگوله)
 *  - counts:     { total, byType, sections }  (اعلان‌ها)
 *  - contactNew: پیام‌های فرم تماسِ خوانده‌نشده (منبعِ status-based، بیرون از جدول اعلان‌ها)
 *
 * این اندپوینت جایگزینِ سه pollerِ پراکنده‌ی قبلی (counts + tickets/stats + contact) شد
 * تا هرگز شمارش‌های متناقض رخ ندهد. Provider سمت کلاینت تنها مصرف‌کننده‌ی آن است.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import ContactMessage from "base/models/ContactMessage";
import { getRecentNotifications } from "base/services/notificationService";

export const runtime = "nodejs";

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

    const [{ items, counts }, contactNew] = await Promise.all([
      getRecentNotifications(limit),
      ContactMessage.countDocuments({ status: "new" }),
    ]);

    return NextResponse.json(
      { notifications: items, counts, contactNew },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/notifications/summary GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
