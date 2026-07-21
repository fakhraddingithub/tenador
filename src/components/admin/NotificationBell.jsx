"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell } from "react-icons/fi";
import {
  ShoppingCart,
  BadgeDollarSign,
  GraduationCap,
  UserPlus,
  LifeBuoy,
  CheckCheck,
  Inbox,
} from "lucide-react";
import { useNotifications } from "./NotificationProvider";

/* ─── پیکربندی نوع اعلان (آیکون + رنگ) ─────────────────────────────── */
const TYPE_CONFIG = {
  new_order: {
    Icon: ShoppingCart,
    color: "#aa4725",
    label: "سفارش جدید",
  },
  new_payment: {
    Icon: BadgeDollarSign,
    color: "#16a34a",
    label: "پرداخت تأییدشده",
  },
  coach_student_order: {
    Icon: GraduationCap,
    color: "#ffbf00",
    label: "کردیت مربی",
  },
  coach_application: {
    Icon: UserPlus,
    color: "#6366f1",
    label: "درخواست مربیگری",
  },
  new_ticket: {
    Icon: LifeBuoy,
    color: "#0ea5e9",
    label: "پشتیبانی",
  },
};

const FALLBACK = { Icon: FiBell, color: "#9c9189", label: "اعلان" };

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
function NotificationItem({ item, onClick, index }) {
  const cfg = TYPE_CONFIG[item.type] || FALLBACK;
  const { Icon, color, label } = cfg;

  return (
    <motion.button
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.3) }}
      onClick={() => onClick(item)}
      className={`relative w-full text-right flex items-start gap-3 px-4 py-3 transition-colors duration-150 group
        ${item.isRead ? "hover:bg-white/[0.04]" : "bg-white/[0.04] hover:bg-white/[0.07]"}`}
    >
      {/* نوار رنگی سمت راست برای خوانده‌نشده‌ها */}
      {!item.isRead && (
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] rounded-l-full"
          style={{ background: color }}
        />
      )}

      {/* آیکون نوع */}
      <span
        className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={17} />
      </span>

      {/* متن */}
      <span className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${color}1f`, color }}>
            {label}
          </span>
          {!item.isRead && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ffbf00" }} />
          )}
        </span>
        <span className={`text-[12.5px] leading-relaxed ${item.isRead ? "text-white/55" : "text-white/90 font-medium"}`}>
          {item.message}
        </span>
        <span className="text-[10.5px] text-white/35 tabular-nums">{timeAgo(item.createdAt)}</span>
      </span>
    </motion.button>
  );
}

/* ─── کامپوننت اصلی زنگوله ───────────────────────────────────────────── */
export default function NotificationBell() {
  const router = useRouter();
  const { items, total, loading, refresh, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const hasUnread = total > 0;

  /* واکشیِ تازه هنگام باز شدن (نه هر بار — Provider خودش poll می‌کند) */
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

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

  const handleItemClick = (item) => {
    // علامت‌گذاری خوانده‌شده (متمرکز) سپس ناوبری — صفحه‌ی مقصد هم دوباره تضمین می‌کند
    if (!item.isRead) markRead({ ids: [item._id] });
    setOpen(false);
    if (item.link) router.push(item.link);
  };

  const handleMarkAll = () => {
    if (total === 0) return;
    markRead({ all: true });
  };

  const badgeText = total > 99 ? "۹۹+" : Number(total).toLocaleString("fa-IR");

  return (
    <div className="relative" ref={wrapRef}>
      {/* دکمه زنگوله */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="اعلان‌ها"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border transition-all"
        style={{
          background: open ? "rgba(170,71,37,0.1)" : "var(--admin-card)",
          borderColor: open ? "rgba(170,71,37,0.4)" : "var(--admin-border)",
          color: open ? "var(--color-primary)" : "#6b6259",
        }}
      >
        <motion.span
          animate={hasUnread ? { rotate: [0, -12, 10, -8, 6, 0] } : { rotate: 0 }}
          transition={hasUnread ? { duration: 0.9, repeat: Infinity, repeatDelay: 3 } : {}}
          style={{ originY: 0 }}
        >
          <FiBell size={17} />
        </motion.span>

        <AnimatePresence>
          {hasUnread && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9.5px] font-bold tabular-nums shadow-sm"
              style={{ background: "var(--color-secondary)", color: "#1a1a1a" }}
            >
              {badgeText}
              {/* حلقه‌ی پالس */}
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-60"
                style={{ background: "var(--color-secondary)", animationDuration: "1.8s" }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* پنل کشویی */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            dir="rtl"
            className="absolute left-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden z-[60] origin-top-left"
            style={{
              background: "#0d0d0d",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            {/* خط برجسته‌ی بالا */}
            <div
              className="h-[2px] w-full"
              style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-secondary))" }}
            />

            {/* هدر پنل */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">اعلان‌ها</span>
                {total > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(255,191,0,0.15)", color: "var(--color-secondary)" }}
                  >
                    {Number(total).toLocaleString("fa-IR")} جدید
                  </span>
                )}
              </div>
              <button
                onClick={handleMarkAll}
                disabled={total === 0}
                className="flex items-center gap-1.5 text-[11px] font-bold text-white/45 hover:text-[var(--color-secondary)] disabled:opacity-30 disabled:hover:text-white/45 transition-colors"
              >
                <CheckCheck size={13} />
                خواندن همه
              </button>
            </div>

            {/* بدنه */}
            <div className="max-h-[400px] overflow-y-auto admin-scrollbar divide-y divide-white/[0.04]">
              {loading ? (
                <div className="py-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-[10px] bg-white/[0.06] animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-2.5 w-1/3 bg-white/[0.06] rounded animate-pulse" />
                        <div className="h-2.5 w-4/5 bg-white/[0.06] rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <span className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center text-white/30">
                    <Inbox size={22} />
                  </span>
                  <p className="text-white/40 text-sm">اعلانی وجود ندارد</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <NotificationItem
                    key={item._id}
                    item={item}
                    index={idx}
                    onClick={handleItemClick}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
