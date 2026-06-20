/**
 * GET /api/admin/user-notifications/recipients?targetType=all|role&targetRole=...
 *
 * پیش‌نمایشِ تعداد گیرنده برای تأییدیه‌ی ارسال (فقط all و role؛ تعداد group/single
 * سمت کلاینت از روی انتخاب مشخص است).
 *
 * ⚠️ بررسی دسترسیِ ادمین عمداً برداشته شده است.
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import { previewRecipientCount } from "base/services/userNotificationService";

export async function GET(req) {
  try {
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType");
    const targetRole = searchParams.get("targetRole");

    const count = await previewRecipientCount({ targetType, targetRole });
    return NextResponse.json({ count }, { status: 200 });
  } catch (error) {
    console.error("[admin/user-notifications/recipients GET]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
