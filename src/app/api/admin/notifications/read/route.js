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
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import ContactMessage from "base/models/ContactMessage";
import {
  SECTION_BY_TYPE,
  markNotificationsRead,
} from "base/services/notificationService";
import {
  constrainReadFilterToPermissions,
  filterNotificationPayload,
} from "@/lib/apiPermissions";

import requireAdminPermission from "@/lib/requireAdminPermission";

export const runtime = "nodejs";

export async function POST(req) {
  // بدون کلیدِ اختصاصی: علامت‌زدنِ اعلان‌ها به‌عنوان خوانده‌شده، وضعیتِ خودِ
  // ادمین است نه داده‌ی یک ماژول.
  //
  // پیش‌تر این هندلر requireAdmin() را دو بار صدا می‌زد (یک بار مستقیم و یک
  // بار از طریق getAdminUser)؛ آن wrapper حذف شد چون خروجی‌اش پس از بررسی
  // هیچ‌جا استفاده نمی‌شد و فقط یک رفت‌وبرگشتِ اضافی به دیتابیس بود.
  const { ctx, denied } = await requireAdminPermission();
  if (denied) return denied;

  try {
    await connectToDB();

    let body = {};
    try {
      body = await req.json();
    } catch {
      /* بدون body */
    }

    // ادمین نباید بتواند اعلانِ ماژولی را که نمی‌بیند «خوانده‌شده» کند —
    // حتی با فرستادنِ ids یا all:true.
    const scopedFilter = constrainReadFilterToPermissions(body, ctx.permissions);

    const [counts, contactNew] = await Promise.all([
      markNotificationsRead(scopedFilter),
      ContactMessage.countDocuments({ status: "new" }),
    ]);

    const visible = filterNotificationPayload(
      { items: [], counts, contactNew },
      ctx.permissions,
      SECTION_BY_TYPE
    );

    return NextResponse.json(
      { counts: visible.counts, contactNew: visible.contactNew },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/notifications/read POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
