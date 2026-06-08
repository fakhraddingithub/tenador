import { redirect } from "next/navigation";

// نرخ تبدیل ارز اکنون بخشی از صفحه‌ی «مدیریت مالی» است.
export default function ExchangeRateRedirect() {
  redirect("/p-admin/financial");
}
