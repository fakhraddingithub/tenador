// app/api/navbar/route.js
// نوبار اکنون در سرور (layout) رندر می‌شود. این مسیر برای سازگاری عقب‌رو
// و باطل‌سازی دستی کش نگه داشته شده است.

import { revalidateTag } from "next/cache";
import { getCachedNavbar } from "@/lib/navbarService";

export async function GET() {
  const data = await getCachedNavbar();
  return Response.json(data);
}

export async function POST() {
  revalidateTag("navbar");
  return Response.json({ revalidated: true });
}
