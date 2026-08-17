// app/api/navbar/route.js
// نوبار اکنون در سرور (layout) رندر می‌شود. این مسیر برای سازگاری عقب‌رو
// و باطل‌سازی دستی کش نگه داشته شده است.

import { revalidateTag } from "next/cache";
import { getCachedNavbar } from "@/lib/navbarService";
import requireAdminPermission from "@/lib/requireAdminPermission";

// GET عمومی می‌ماند — ویترین منو را از همین‌جا می‌خواند.
export async function GET() {
  const data = await getCachedNavbar();
  return Response.json(data);
}

// POST باطل‌سازیِ دستیِ کش است: عملیاتِ مدیریتی، و بدون گیت یک اهرمِ ارزانِ
// از کار انداختنِ کشِ منو برای هر بازدیدکننده‌ای بود.
export async function POST() {
  const { denied } = await requireAdminPermission("navbar.revalidate");
  if (denied) return denied;

  revalidateTag("navbar");
  return Response.json({ revalidated: true });
}
