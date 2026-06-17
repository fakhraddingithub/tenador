"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/features/navbar/Navbar";
import { UserProvider } from "@/components/features/auth/UserContext";

/**
 * SiteNavbar — wrapper نازک برای استفاده‌ی مجدد از «نوبار اصلی سایت» در لایه‌های
 * دیگر (پنل مدیریت و داشبورد کاربر) بدون ساختن کپی یا تکرارِ خود کامپوننت.
 *
 * نوبار اصلی برای کارکرد صحیح به دو چیز نیاز دارد که فقط در layout گروه (Site)
 * فراهم بودند:
 *   ۱) `UserProvider` تا useUser() کاربرِ واردشده را بشناسد.
 *   ۲) prop `navData` برای منوی دسته‌بندی (مگامنو).
 * این wrapper هر دو را تأمین می‌کند و خودِ کامپوننت Navbar را بدون هیچ تغییری
 * رندر می‌کند.
 */
export default function SiteNavbar() {
  const [navData, setNavData] = useState([]);

  useEffect(() => {
    fetch("/api/navbar")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setNavData(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  return (
    <UserProvider>
      <Navbar navData={navData} />
    </UserProvider>
  );
}
