import { redirect } from "next/navigation";

/**
 * فاز ۲: فهرست کلی ورزشکاران حذف شد؛ ورزشکاران داخل هر «ورزش» مدیریت می‌شوند.
 * ورود از /p-admin/admin-athletes به فهرست ورزش‌ها هدایت می‌شود.
 * زیرمسیرهای add / edit برای جریان‌های CRUD حفظ شده‌اند
 * و از داخل صفحه‌ی هر ورزش قابل دسترسی هستند.
 */
export default function AdminAthletesRootRedirect() {
  redirect("/p-admin/admin-sports");
}