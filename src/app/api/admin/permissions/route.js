import { NextResponse } from "next/server";
import { PERMISSION_MODULES } from "@/lib/permissions";

import requireAdminPermission from "@/lib/requireAdminPermission";

/**
 * رجیستری دسترسی‌ها برای UI پنل ادمین.
 * فرانت‌اند هیچ دسترسی‌ای را هاردکد نمی‌کند؛ همیشه از این endpoint می‌خواند
 * تا با افزودن ماژول/دسترسی جدید در رجیستری، UI خودکار به‌روز شود.
 */
export async function GET() {
  // رجیستری، نقشه‌ی کاملِ قابلیت‌های پنل است. باز گذاشتنش برای «هر ادمین»
  // با الزامِ «بخشِ غیرمجاز حتی دیده نشود» ناسازگار بود.
  // فقط مصرف‌کننده‌های واقعیِ این endpoint اجازه دارند:
  //   • roles.create / roles.edit          → ساخت و ویرایشِ نقش
  //   • admins.managePermissions           → grant/denialِ اختصاصیِ یک ادمین
  // (admins.create/edit عمداً اینجا نیستند: فرمِ ادمین بدون تبِ دسترسی‌ها هم
  //  کار می‌کند و دادنِ نقشه‌ی کامل به آن‌ها لازم نیست.)
  const { denied } = await requireAdminPermission(
    ["roles.create", "roles.edit", "admins.managePermissions"],
    { mode: "any" }
  );
  if (denied) return denied;

  return NextResponse.json({ modules: PERMISSION_MODULES }, { status: 200 });
}
