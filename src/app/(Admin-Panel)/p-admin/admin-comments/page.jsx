import { redirect } from "next/navigation";

/**
 * فاز ۲: مدیریت نظرات به تبِ «نظرات» در مرکز پشتیبانی منتقل شد.
 * لینک قدیمی /p-admin/admin-comments همچنان زنده است.
 */
export default function AdminCommentsRedirect() {
  redirect("/p-admin/support?tab=comments");
}