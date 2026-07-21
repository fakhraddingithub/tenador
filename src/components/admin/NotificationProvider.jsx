"use client";

/**
 * NotificationProvider — لایه‌ی متمرکزِ حالت اعلان‌های پنل مدیریت.
 *
 * تنها منبعِ حقیقت برای: زنگوله‌ی هدر، بَج‌های سایدبار، بَج‌های تب‌ها و صفحه‌ها.
 * یک poll (۴۵ ثانیه) + refetch روی focus؛ هیچ صفحه‌ای منطق شمارشِ جداگانه ندارد.
 *
 * مصرف: const { badgeFor, markRead, ... } = useNotifications();
 * علامت‌گذاریِ «مشاهده‌شده» از طریق کامپوننت <MarkNotificationsRead filter={...} />.
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const EMPTY_COUNTS = {
  total: 0,
  byType: {},
  sections: { orders: 0, coachCredits: 0, coachApplications: 0, support: 0 },
};

const NotificationContext = createContext(null);

const POLL_MS = 45000;

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [contactNew, setContactNew] = useState(0);
  const [loading, setLoading] = useState(true);

  // جلوگیری از setState بعد از unmount
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const applyPayload = useCallback((data) => {
    if (!alive.current || !data) return;
    if (data.notifications) setItems(data.notifications);
    if (data.counts) setCounts({ ...EMPTY_COUNTS, ...data.counts });
    if (typeof data.contactNew === "number") setContactNew(data.contactNew);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications/summary?limit=20");
      if (!res.ok) return;
      applyPayload(await res.json());
    } catch {
      /* بی‌صدا */
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [applyPayload]);

  /* poll + refetch روی focus */
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  /**
   * علامت‌گذاری خوانده‌شده — خوش‌بینانه (فوری در UI) سپس سرور.
   * filter: { order } | { coach } | { ticket } | { type } | { ids } | { all }
   */
  const markRead = useCallback(
    async (filter) => {
      if (!filter || typeof filter !== "object") return;

      // به‌روزرسانی خوش‌بینانه‌ی لیستِ زنگوله (کاهش فوریِ ظاهر)
      setItems((prev) =>
        prev.map((n) => {
          if (n.isRead) return n;
          const hit =
            (filter.order && String(n.order) === String(filter.order)) ||
            (filter.coach && String(n.coach) === String(filter.coach)) ||
            (filter.ticket && String(n.ticket) === String(filter.ticket)) ||
            (filter.ids && filter.ids.map(String).includes(String(n._id))) ||
            (filter.type &&
              (Array.isArray(filter.type)
                ? filter.type.includes(n.type)
                : n.type === filter.type)) ||
            filter.all;
          return hit ? { ...n, isRead: true } : n;
        })
      );

      try {
        const res = await fetch("/api/admin/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(filter),
        });
        if (res.ok) applyPayload(await res.json());
      } catch {
        /* بی‌صدا — poll بعدی حالت را تصحیح می‌کند */
      }
    },
    [applyPayload]
  );

  /* نگاشتِ href سایدبار → عددِ بَج (تنها جای این منطق) */
  const badgeFor = useCallback(
    (href) => {
      const s = counts.sections || {};
      if (href === "/p-admin/admin-orders") return s.orders || 0;
      if (href === "/p-admin/users")
        return (s.coachApplications || 0) + (s.coachCredits || 0);
      if (href === "/p-admin/support") return (s.support || 0) + (contactNew || 0);
      return 0;
    },
    [counts, contactNew]
  );

  const value = {
    items,
    counts,
    contactNew,
    loading,
    total: counts.total || 0,
    byType: counts.byType || {},
    sections: counts.sections || EMPTY_COUNTS.sections,
    refresh,
    markRead,
    badgeFor,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // خارج از Provider (نباید رخ دهد در پنل) — مقدار خنثی
    return {
      items: [],
      counts: EMPTY_COUNTS,
      contactNew: 0,
      loading: false,
      total: 0,
      byType: {},
      sections: EMPTY_COUNTS.sections,
      refresh: () => {},
      markRead: () => {},
      badgeFor: () => 0,
    };
  }
  return ctx;
}
