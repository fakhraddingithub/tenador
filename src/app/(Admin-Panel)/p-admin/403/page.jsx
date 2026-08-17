/**
 * src/app/(Admin-Panel)/p-admin/403/page.jsx
 *
 * مقصدِ rewrite ـِ نگهبانِ middleware (src/middleware.js).
 *
 * ⚠️ عمداً در ADMIN_ROUTE_PERMISSIONS ثبت نشده: باید برای *هر* نشستی که به آن
 * rewrite می‌شود قابل رندر باشد. middleware خودش این مسیر را از ارزیابی کنار
 * می‌گذارد، پس نبودنش در manifest حلقه‌ی rewrite نمی‌سازد.
 *
 * URL کاربر عوض نمی‌شود (rewrite، نه redirect) تا بعدِ اصلاحِ دسترسی، یک
 * refresh ساده کافی باشد.
 */

import ForbiddenNotice from "@/components/admin/ForbiddenNotice";

export const metadata = { title: "دسترسی مجاز نیست | پنل مدیریت" };

export default async function AdminForbiddenPage({ searchParams }) {
  const { reason } = await searchParams;
  return <ForbiddenNotice reason={reason} />;
}
