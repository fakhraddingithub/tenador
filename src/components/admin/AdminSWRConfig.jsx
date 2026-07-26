"use client";

import { SWRConfig } from "swr";

/**
 * پیکربندیِ سراسریِ SWR برای پنل مدیریت.
 *
 * پیش‌فرض‌های SWR عمداً بازنویسی شده‌اند: رفتارِ پیش‌فرضِ آن (revalidate روی هر
 * focus و هر reconnect) دقیقاً همان چیزی است که در Vercel هزینه می‌سازد — هر
 * بار جابه‌جایی بینِ تب‌ها یک موجِ درخواست راه می‌اندازد.
 *
 * نکته: این پیکربندی فقط روی صفحاتی اثر دارد که useSWR را صدا می‌زنند. صفحه‌های
 * 🔴 (سفارش‌ها، اقساط، مالی/آنالیتیکس، اعتبار مربی، نرخ ارز) عمداً از SWR
 * استفاده نمی‌کنند و همان fetch مستقیمِ همیشگی را دارند — هیچ کشی روی داده‌ی
 * پولی/مالی گذاشته نمی‌شود.
 */

// دریافت‌کننده‌ی مشترک — خطای HTTP را به throw تبدیل می‌کند تا در `error` بنشیند
// (SWR پاسخِ ۴۰۱/۵۰۰ را به‌خودیِ‌خود خطا حساب نمی‌کند).
const fetcher = async (url) => {
  // credentials صریح — بعضی صداکننده‌ها قبلاً include داشتند و رفتار نباید عوض شود
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = new Error("خطا در دریافت اطلاعات");
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export default function AdminSWRConfig({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // بدونِ رفتارِ پیش‌فرضِ پرهزینه
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        // پنجره‌ی پیش‌فرضِ حذفِ درخواست‌های تکراری؛ هر صفحه می‌تواند
        // بسته به دسته‌بندیِ داده‌اش این را بالا/پایین ببرد.
        dedupingInterval: 30_000,
        // هنگام تغییرِ key داده‌ی قبلی نگه داشته می‌شود تا UI نپرد
        keepPreviousData: true,
        // تلاشِ مجددِ بی‌پایان روی خطا = دنباله‌ی invocation؛ محدود می‌شود
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
