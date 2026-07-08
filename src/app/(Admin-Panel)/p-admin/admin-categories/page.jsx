import { redirect } from "next/navigation";

/**
 * فاز ۲: مدیریت دسته‌بندی‌ها به داخل هر «ورزش» منتقل شد
 * (/p-admin/admin-sports/[sportId] که خود، لیستِ دسته‌های همان ورزش را نشان می‌دهد).
 * زیرمسیرهای add / edit / category-products برای جریان‌های CRUD حفظ شده‌اند.
 */
export default function AdminCategoriesRedirect() {
  redirect("/p-admin/admin-sports");
}