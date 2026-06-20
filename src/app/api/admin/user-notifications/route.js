/**
 * /api/admin/user-notifications
 *
 * GET  → تاریخچه‌ی اعلان‌های ارسال‌شده به کاربران (برای پنل ادمین)
 * POST → ساخت و ارسال یک اعلان جدید به کاربران
 *
 * ⚠️ بررسی دسترسیِ ادمین روی هر دو متد (GET تاریخچه و POST ارسال) عمداً برداشته
 * شده است.
 *
 * ⚠️ کاملاً جدا از /api/admin/notifications (اعلان‌های داخلی خودِ پنل).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { verifyToken } from "base/utils/auth";
import {
  createUserNotification,
  getSentNotifications,
} from "base/services/userNotificationService";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");
    const items = await getSentNotifications({ limit });

    return NextResponse.json({ notifications: items }, { status: 200 });
  } catch (error) {
    console.error("[admin/user-notifications GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    // ⚠️ بررسی دسترسیِ ادمین برای «ارسال/ساخت اعلان» عمداً برداشته شده است.
    // فقط برای انتسابِ createdBy، در صورت وجود توکن، شناسه‌ی کاربر خوانده می‌شود
    // (بدون هیچ اجبار یا ردِ درخواست).
    let actorId = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("accessToken")?.value;
      const decoded = token ? verifyToken(token) : null;
      actorId = decoded?.userId || null;
    } catch {
      /* بی‌صدا */
    }

    const body = await req.json().catch(() => ({}));
    const { title, message, targetType, targetRole, targetUserIds } = body;

    const notification = await createUserNotification({
      title,
      message,
      targetType,
      targetRole,
      targetUserIds,
      createdBy: actorId,
    });

    return NextResponse.json(
      {
        message: `اعلان با موفقیت برای ${Number(
          notification.recipientCount
        ).toLocaleString("fa-IR")} کاربر ارسال شد`,
        notification,
      },
      { status: 201 }
    );
  } catch (error) {
    // خطاهای اعتبارسنجی پیام فارسی دارند → 400
    const validationMessages = [
      "نوع هدف‌گذاری نامعتبر است",
      "نقش انتخاب‌شده نامعتبر است",
      "حداقل یک کاربر باید انتخاب شود",
      "برای ارسال تکی فقط یک کاربر مجاز است",
      "عنوان اعلان الزامی است",
      "متن اعلان الزامی است",
      "هیچ کاربری با این هدف‌گذاری یافت نشد",
    ];
    if (validationMessages.includes(error?.message)) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("[admin/user-notifications POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
