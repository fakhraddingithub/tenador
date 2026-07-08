"use client";

/**
 * SectionTabs — الگوی مشترک تبِ افقی برای پنل ادمین (فاز ۲).
 * — کاملاً کنترل‌شده؛ URL-sync اختیاری با تنظیم initialTab از سمت والد.
 * — تنها از توکن‌های admin-scope استفاده می‌کند (سبز درباری، رادیوس ۶px).
 * — Responsive: در موبایل scrollable افقی می‌شود.
 */
import { motion } from "framer-motion";

export default function SectionTabs({ tabs, value, onChange, className = "" }) {
  return (
    <div
      className={`relative inline-flex items-center gap-1 p-1 border overflow-x-auto max-w-full admin-scrollbar ${className}`}
      style={{
        background: "var(--admin-card)",
        borderColor: "var(--admin-border)",
        borderRadius: "var(--admin-radius)",
      }}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className="relative flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors"
            style={{
              color: active ? "#fff" : "var(--admin-text-muted)",
              borderRadius: "calc(var(--admin-radius) - 2px)",
              zIndex: 1,
            }}
          >
            {active && (
              <motion.span
                layoutId="admin-section-tabs-indicator"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="absolute inset-0"
                style={{
                  background: "var(--color-primary)",
                  borderRadius: "calc(var(--admin-radius) - 2px)",
                  zIndex: -1,
                }}
              />
            )}
            {Icon && <Icon size={13} />}
            <span>{t.label}</span>
            {typeof t.badge === "number" && t.badge > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                style={{
                  background: active ? "var(--color-secondary)" : "var(--color-primary-soft)",
                  color: active ? "#1a1a1a" : "var(--color-primary)",
                }}
              >
                {t.badge > 99 ? "۹۹+" : Number(t.badge).toLocaleString("fa-IR")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}