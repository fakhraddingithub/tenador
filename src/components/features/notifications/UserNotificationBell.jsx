"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell } from "react-icons/fi";
import { CheckCheck, Inbox, Megaphone } from "lucide-react";

/* ─── زمانِ نسبی فارسی ──────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const fa = (n) => Number(n).toLocaleString("fa-IR");
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "لحظاتی پیش";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${fa(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${fa(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${fa(day)} روز پیش`;
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── یک ردیف اعلان ─────────────────────────────────────────────────── */
function NotificationItem({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.3) }}
      className={`relative flex items-start gap-3 px-4 py-3.5 transition-colors duration-150
        ${item.isRead ? "" : "bg-[#aa4725]/[0.07]"}`}
    >
      {/* نوار رنگی سمت راست برای خوانده‌نشده‌ها */}
      {!item.isRead && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-l-full bg-[#ffbf00]" />
      )}

      {/* آیکون */}
      <span className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#aa4725]/15 text-[#aa4725]">
        <Megaphone size={16} />
      </span>

      {/* متن */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-[13px] truncate ${
              item.isRead ? "text-white/70 font-medium" : "text-white font-bold"
            }`}
          >
            {item.title}
          </p>
          {!item.isRead && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffbf00] flex-shrink-0" />
          )}
        </div>
        <p
          className={`text-[12px] leading-relaxed whitespace-pre-line ${
            item.isRead ? "text-white/45" : "text-white/75"
          }`}
        >
          {item.message}
        </p>
        <span className="text-[10.5px] text-white/35 tabular-nums">
          {timeAgo(item.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── محتوای پنل (مشترک بین دسکتاپ و موبایل) ─────────────────────────── */
function PanelBody({ loading, items }) {
  return (
    <div className="max-h-[60vh] lg:max-h-[420px] overflow-y-auto divide-y divide-white/[0.05] notif-scrollbar">
      {loading ? (
        <div className="py-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-[10px] bg-white/[0.06] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-1/3 bg-white/[0.06] rounded animate-pulse" />
                <div className="h-2.5 w-4/5 bg-white/[0.06] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <span className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center text-white/30">
            <Inbox size={22} />
          </span>
          <p className="text-white/40 text-sm">اعلانی برای شما وجود ندارد</p>
        </div>
      ) : (
        items.map((item, idx) => (
          <NotificationItem key={item._id} item={item} index={idx} />
        ))
      )}
    </div>
  );
}

/* ─── کامپوننت اصلی زنگوله‌ی کاربر ───────────────────────────────────── */
export default function UserNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef(null);

  const hasUnread = unread > 0;
  const badgeText = unread > 99 ? "۹۹+" : Number(unread).toLocaleString("fa-IR");

  useEffect(() => setMounted(true), []);

  /* فقط شمارش (سبک) — برای بَج هنگام بسته‌بودن + پولینگ */
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unreadCount || 0);
    } catch {
      /* بی‌صدا */
    }
  }, []);

  /* لیست کامل — هنگام باز شدن */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setItems(data.notifications || []);
    } catch {
      /* بی‌صدا */
    } finally {
      setLoading(false);
    }
  }, []);

  /* واکشی اولیه + پولینگِ شمارش هر ۶۰ ثانیه (وقتی بسته است) */
  useEffect(() => {
    refreshCount();
    const id = setInterval(() => {
      if (!open) refreshCount();
    }, 60000);
    return () => clearInterval(id);
  }, [refreshCount, open]);

  /* باز کردن: بَج فوراً صفر، لیست واکشی، و «همه خوانده‌شده» در سرور ثبت */
  const openPanel = useCallback(() => {
    setOpen(true);
    setUnread(0); // پاک‌سازی فوری بَج — بدون بَجِ کهنه بعد از مشاهده
    loadList();
    // ثبت watermark در سرور تا با باز/بسته‌کردنِ دوباره برنگردد
    fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }, [loadList]);

  const toggle = useCallback(() => {
    if (open) setOpen(false);
    else openPanel();
  }, [open, openPanel]);

  /* بستن با کلیک بیرون + ESC */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* هدرِ پنل — مشترک */
  const PanelHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
      <div className="flex items-center gap-2">
        <span className="text-white font-bold text-sm">اعلان‌ها</span>
      </div>
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#ffbf00]/80">
        <CheckCheck size={13} />
        خوانده شد
      </span>
    </div>
  );

  return (
    <div className="relative flex items-center" ref={wrapRef}>
      <style>{`
        .notif-scrollbar::-webkit-scrollbar { width: 4px; }
        .notif-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .notif-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
      `}</style>

      {/* دکمه زنگوله */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        aria-label={`اعلان‌ها${hasUnread ? ` (${badgeText} خوانده‌نشده)` : ""}`}
        aria-expanded={open}
        className="relative flex items-center justify-center w-9 h-9 text-white hover:text-[#aa4725] transition-colors"
      >
        <motion.span
          animate={hasUnread ? { rotate: [0, -12, 10, -8, 6, 0] } : { rotate: 0 }}
          transition={hasUnread ? { duration: 0.9, repeat: Infinity, repeatDelay: 3 } : {}}
          style={{ originY: 0 }}
        >
          <FiBell size={20} />
        </motion.span>

        <AnimatePresence>
          {hasUnread && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9.5px] font-bold tabular-nums bg-[#ffbf00] text-[#1a1a1a] shadow-sm"
            >
              {badgeText}
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-60 bg-[#ffbf00]"
                style={{ animationDuration: "1.8s" }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── پنل دسکتاپ (absolute) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            dir="rtl"
            className="hidden lg:block absolute left-0 top-full mt-3 w-[380px] rounded-2xl overflow-hidden z-[200] origin-top-left bg-[#1b1e25] border border-white/10 shadow-2xl"
          >
            <div className="h-[2px] w-full bg-gradient-to-l from-[#aa4725] to-[#ffbf00]" />
            {PanelHeader}
            <PanelBody loading={loading} items={items} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── پنل موبایل (بَتم‌شیت/پنل تمام‌عرض از طریق پورتال) ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="lg:hidden">
                {/* بک‌دراپ */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-[2px]"
                />
                {/* شیت از بالا، زیر نوبار */}
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  dir="rtl"
                  className="fixed z-[220] top-[80px] left-3 right-3 rounded-2xl overflow-hidden bg-[#1b1e25] border border-white/10 shadow-2xl"
                >
                  <div className="h-[2px] w-full bg-gradient-to-l from-[#aa4725] to-[#ffbf00]" />
                  {PanelHeader}
                  <PanelBody loading={loading} items={items} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
