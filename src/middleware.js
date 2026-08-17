import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";

/**
 * نگهبانِ سمت‌سرورِ پنل مدیریت (فاز ۴).
 *
 * چرا middleware و نه layout: layout فقط در بارگذاریِ کاملِ صفحه دوباره اجرا
 * می‌شود. در ناوبریِ نرم (soft navigation) فقط segmentِ صفحه روی سرور رندر
 * می‌شود و layout دست‌نخورده می‌ماند — یعنی گیتِ داخلِ layout از کنارِ
 * صفحه‌های server-component رد می‌شد و داده‌شان رندر می‌گشت. middleware روی
 * *هر* درخواست (کامل، RSC و prefetch) اجرا می‌شود، پس تنها نقطه‌ی خفه‌کننده‌ی
 * واقعی است.
 *
 * ⚠️ runtime = nodejs (پایین) — چون اینجا mongoose کوئری می‌زند. نقشِ داخل JWT
 * دیگر ملاک نیست: عضویتِ زنده‌ی Admin + دسترسی مؤثر از دیتابیس خوانده می‌شود.
 * چکِ قدیمیِ `payload.role !== "admin"` حذف شد چون ادمینِ عضویتی (که
 * `User.role` اش «admin» نیست) را کاملاً قفلِ بیرون می‌کرد.
 *
 * گیتِ API ها مستقل است (requireAdminPermission) — این لایه جایگزینِ آن نیست.
 */

/** صفحه‌ی «دسترسی ندارید» — عمداً در ADMIN_ROUTE_PERMISSIONS نیست. */
const DENIED_PATH = "/p-admin/403";

function denied(request, reason) {
  const url = new URL(DENIED_PATH, request.url);
  url.searchParams.set("reason", reason);
  return NextResponse.rewrite(url);
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;

  if (!token) {
    const loginUrl = new URL("/login-register", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/p-admin")) {
    // خودِ صفحه‌ی ۴۰۳ نباید دوباره ارزیابی شود (روتِ ناشناخته → حلقه‌ی rewrite).
    if (pathname === DENIED_PATH) return NextResponse.next();

    const ctx = await getAdminContext({ token });
    if (!ctx) return denied(request, "not-admin");

    if (!canAccessAdminRoute(ctx.permissions, pathname + search)) {
      return denied(request, "forbidden");
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/p-user/:path*", "/p-admin/:path*"],
};
