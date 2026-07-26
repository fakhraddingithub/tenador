import { NextResponse } from "next/server";
import { PERMISSION_MODULES } from "@/lib/permissions";

import requireAdmin, { unauthorized } from "@/lib/requireAdmin";

/**
 * رجیستری دسترسی‌ها برای UI پنل ادمین.
 * فرانت‌اند هیچ دسترسی‌ای را هاردکد نمی‌کند؛ همیشه از این endpoint می‌خواند
 * تا با افزودن ماژول/دسترسی جدید در رجیستری، UI خودکار به‌روز شود.
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  return NextResponse.json({ modules: PERMISSION_MODULES }, { status: 200 });
}
