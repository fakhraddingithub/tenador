"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

/**
 * UserProvider — جزیره‌ی احراز هویت سمت کلاینت.
 *
 * چرا: تا قبل از این، layout سرور با `cookies()` نام کاربر را می‌خواند و همین
 * باعث می‌شد کل درخت `(Site)` به‌صورت داینامیک رندر شود (هیچ صفحه‌ای static/ISR نشود).
 * با انتقال وضعیت کاربر به این جزیره‌ی کلاینت، صفحات عمومی می‌توانند static/ISR شوند
 * و فقط همین ویجت کوچک نوبار سمت کلاینت هیدریت می‌شود.
 *
 * توکن httpOnly است، پس کلاینت مستقیماً آن را نمی‌خواند؛ از `/api/auth/profile`
 * استفاده می‌شود (کوکی same-origin خودکار ارسال می‌شود).
 *
 * برای جلوگیری از «پرش» نمایش (logged-in → logged-out) برای کاربران بازگشتی،
 * وضعیت آخرین کاربر در localStorage کش می‌شود و فوراً به‌صورت خوش‌بینانه رندر
 * می‌شود، سپس با پاسخ سرور تأیید/به‌روزرسانی می‌گردد.
 */

const UserContext = createContext({
  user: null,
  loading: true,
  refresh: () => {},
});

export function useUser() {
  return useContext(UserContext);
}

const STORAGE_KEY = "authUser";

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // هیدریت خوش‌بینانه از کش محلی (بدون پرش برای کاربران بازگشتی)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) setUser(JSON.parse(cached));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const u = data.user || null;
        setUser(u);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        } catch {
          /* ignore */
        }
      } else {
        setUser(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch {
      // خطای شبکه: وضعیت خوش‌بینانه‌ی فعلی حفظ شود
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // پس از login/logout سایر بخش‌ها می‌توانند این رویداد را dispatch کنند
    const onAuthChanged = () => refresh();
    window.addEventListener("auth-changed", onAuthChanged);

    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, loading, refresh }}>
      {children}
    </UserContext.Provider>
  );
}
