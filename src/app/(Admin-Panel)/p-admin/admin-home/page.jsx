import { redirect } from "next/navigation";

/**
 * فاز ۲: «صفحه‌ی اصلی» به تبِ داخل «صفحات سایت» منتقل شد.
 * این ری‌دایرکت نرم، لینک‌های قدیمی (بوکمارک/داشبورد/سرچ) را زنده نگه می‌دارد.
 * زیرمسیرها مانند /p-admin/admin-home/slider، /banners و … کاملاً دست‌نخورده‌اند.
 */
export default function AdminHomeRootRedirect() {
  redirect("/p-admin/admin-pages?tab=home");
}