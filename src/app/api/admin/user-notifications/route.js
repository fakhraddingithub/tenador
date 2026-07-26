/**
 * /api/admin/user-notifications
 *
 * GET  → تاریخچه‌ی اعلان‌های ارسال‌شده به کاربران (برای پنل ادمین)
 * POST → ساخت و ارسال یک اعلان جدید به کاربران
 *
 * هر دو متد با requireAdmin محافظت می‌شوند (نقش از دیتابیس بررسی می‌شود).
 * پیش‌تر این بررسی برداشته شده بود؛ یعنی هر کاربرِ ناشناسی می‌توانست برای همه‌ی
 * کاربران اعلان بفرستد.
 *
 * ⚠️ کاملاً جدا از /api/admin/notifications (اعلان‌های داخلی خودِ پنل).
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import requireAdmin, { unauthorized } from "@/lib/requireAdmin";
import {
  createUserNotification,
  getSentNotifications,
} from "base/services/userNotificationService";

export async function GET(req) {
  if (!(await requireAdmin())) return unauthorized();

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
  const admin = await requireAdmin();
  if (!admin) return unauthorized();

  try {
    await connectToDB();

    // شناسه‌ی ادمینِ ارسال‌کننده برای انتسابِ createdBy
    const actorId = admin._id;

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
