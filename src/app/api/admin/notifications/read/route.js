/**
 * POST /api/admin/notifications/read
 * علامت‌گذاری متمرکز اعلان‌ها به‌عنوان خوانده‌شده و برگرداندن شمارشِ به‌روز.
 *
 * body (یکی از):
 *   { order }   → همه‌ی اعلان‌های مربوط به این سفارش
 *   { coach }   → همه‌ی اعلان‌های مربوط به این مربی
 *   { ticket }  → همه‌ی اعلان‌های مربوط به این تیکت
 *   { type }    → همه‌ی اعلان‌های یک نوع (رشته یا آرایه)
 *   { ids }     → اعلان‌های مشخص
 *   { all: true } → همه‌ی خوانده‌نشده‌ها
 *
 * این اندپوینت جایگزینِ [id]/read و read-all شد.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import ContactMessage from "base/models/ContactMessage";
import { markNotificationsRead } from "base/services/notificationService";

export const runtime = "nodejs";

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

    let body = {};
    try {
      body = await req.json();
    } catch {
      /* بدون body */
    }

    const [counts, contactNew] = await Promise.all([
      markNotificationsRead(body || {}),
      ContactMessage.countDocuments({ status: "new" }),
    ]);

    return NextResponse.json({ counts, contactNew }, { status: 200 });
  } catch (error) {
    console.error("[admin/notifications/read POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
