import Navbar from "@/components/features/navbar/Navbar";
import { UserProvider } from "@/components/features/auth/UserContext";
import { getCachedNavbar } from "@/lib/navbarService";

/**
 * SiteNavbar — wrapper نازک برای استفاده‌ی مجدد از «نوبار اصلی سایت» در لایه‌های
 * دیگر (پنل مدیریت و داشبورد کاربر) بدون ساختن کپی یا تکرارِ خود کامپوننت.
 *
 * نوبار اصلی برای کارکرد صحیح به دو چیز نیاز دارد که فقط در layout گروه (Site)
 * فراهم بودند:
 *   ۱) `UserProvider` تا useUser() کاربرِ واردشده را بشناسد.
 *   ۲) prop `navData` برای منوی دسته‌بندی (مگامنو).
 *
 * سرور-کامپوننت است و مثل layout گروه (Site) مستقیماً getCachedNavbar را صدا
 * می‌زند — نه fetch به /api/navbar. این یک رفت‌وبرگشتِ HTTP (و یک invocation)
 * را به‌ازای هر بازدید از پنل حذف می‌کند و پرشِ مگامنو بعد از hydrate را هم.
 */
export default async function SiteNavbar() {
  // مثل layout گروه (Site): اگر دیتابیس در دسترس نباشد صفحه ۵۰۰ می‌شود.
  // (catch اینجا گذاشته نشده چون خطای داخلِ unstable_cache به‌هرحال به رندر
  // نشت می‌کند و catch حسِ کاذبِ مقاومت می‌دهد.)
  const navData = await getCachedNavbar();

  return (
    <UserProvider>
      <Navbar navData={Array.isArray(navData) ? navData : []} />
    </UserProvider>
  );
}
