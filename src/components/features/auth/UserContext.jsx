"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import useAuthSession from "@/hooks/useAuthSession";

/**
 * UserProvider — جزیره‌ی احراز هویت سمت کلاینت.
 *
 * چرا: تا قبل از این، layout سرور با `cookies()` نام کاربر را می‌خواند و همین
 * باعث می‌شد کل درخت `(Site)` به‌صورت داینامیک رندر شود (هیچ صفحه‌ای static/ISR نشود).
 * با انتقال وضعیت کاربر به این جزیره‌ی کلاینت، صفحات عمومی می‌توانند static/ISR شوند
 * و فقط همین ویجت کوچک نوبار سمت کلاینت هیدریت می‌شود.
 *
 * توکن httpOnly است، پس کلاینت مستقیماً آن را نمی‌خواند؛ از `/api/auth/session`
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
  const [cachedUser, setCachedUser] = useState(null);
  const { data, isLoading: loading, mutate } = useAuthSession();
  const user = data === undefined ? cachedUser : data.user;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      // One-time browser storage hydration preserves the existing header behavior.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (cached) setCachedUser(JSON.parse(cached));
    } catch { /* storage may be unavailable */ }
  }, []);

  useEffect(() => {
    if (data === undefined) return;
    try {
      if (data.user) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage may be unavailable */ }
  }, [data]);

  const refresh = useCallback(() => mutate().catch(() => {}), [mutate]);
  useEffect(() => {
    const onAuthChanged = () => { void refresh(); };
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, loading, refresh }}>
      {children}
    </UserContext.Provider>
  );
}
