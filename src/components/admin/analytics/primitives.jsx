"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/* کارت پایه */
export function Card({ children, className = "", as: Tag = "div", ...rest }) {
  return (
    <Tag className={`bg-white rounded-2xl border border-[var(--admin-border,#e8e4df)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* عنوان بخش */
export function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(170,71,37,0.1)" }}>
            <Icon size={16} style={{ color: "#aa4725" }} />
          </div>
        )}
        <div>
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-[11px] font-medium text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* نشانگر روند (٪ تغییر) */
export function TrendBadge({ change, invert = false, size = "sm" }) {
  if (change === null || change === undefined) {
    return <span className="text-[11px] font-bold text-gray-300">—</span>;
  }
  const up = change > 0;
  const flat = change === 0;
  // invert=true یعنی افزایش «بد» است (مثل مطالبات معوق)
  const good = flat ? null : invert ? !up : up;
  const color = good === null ? "text-gray-400" : good ? "text-green-600" : "text-red-500";
  const bg = good === null ? "bg-gray-100" : good ? "bg-green-50" : "bg-red-50";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold rounded-full ${bg} ${color}
      ${size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5"}`} dir="ltr">
      <Icon size={size === "xs" ? 10 : 12} />
      {Math.abs(change).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪
    </span>
  );
}

/* اسکلتون بارگذاری */
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

/* حالت خالی */
export function EmptyState({ icon: Icon, title = "داده‌ای برای نمایش نیست", hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {Icon && <Icon size={30} className="text-gray-300 mb-2" />}
      <p className="text-sm font-bold text-gray-400">{title}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/* کارت نمودار با عنوان */
export function ChartCard({ icon, title, subtitle, action, children, className = "" }) {
  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <SectionTitle icon={icon} title={title} subtitle={subtitle} action={action} />
      {children}
    </Card>
  );
}

/* انیمیشن ورود نرم برای بخش‌ها */
export function FadeIn({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
