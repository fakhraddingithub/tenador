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
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ContactMessage from "base/models/ContactMessage";
import {
  SECTION_BY_TYPE,
  getRecentNotifications,
} from "base/services/notificationService";
import { filterNotificationPayload } from "@/lib/apiPermissions";

import requireAdminPermission from "@/lib/requireAdminPermission";

export const runtime = "nodejs";

export async function GET(req) {
  // بدون کلیدِ ورودیِ خاص (زنگوله برای همه‌ی ادمین‌هاست) ولی *خروجی* به
  // ماژول‌های مجازِ همین ادمین فیلتر می‌شود. بی‌فیلتر گذاشتنش یعنی ادمینِ
  // مقالات، عنوان و لینک و تعدادِ سفارش‌ها و تیکت‌ها را می‌دید.
  //
  // wrapper دوم (getAdminUser) حذف شد — خروجی‌اش استفاده نمی‌شد و فقط یک
  // رفت‌وبرگشتِ اضافیِ دیتابیس بود.
  const { ctx, denied } = await requireAdminPermission();
  if (denied) return denied;

  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");

    const [{ items, counts }, contactNew] = await Promise.all([
      getRecentNotifications(limit),
      ContactMessage.countDocuments({ status: "new" }),
    ]);

    const visible = filterNotificationPayload(
      { items, counts, contactNew },
      ctx.permissions,
      SECTION_BY_TYPE
    );

    return NextResponse.json(
      {
        notifications: visible.items,
        counts: visible.counts,
        contactNew: visible.contactNew,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/notifications/summary GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
