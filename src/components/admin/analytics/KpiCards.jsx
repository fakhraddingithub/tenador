"use client";

import { memo } from "react";
import {
  DollarSign, Wallet, AlertCircle, ShoppingCart, Receipt, Users,
  UserPlus, UserCheck, Percent, TrendingUp, Calendar, CalendarDays, CalendarRange,
} from "lucide-react";
import { Card, TrendBadge, Skeleton } from "./primitives";
import { fa, compactToman, pct } from "./format";

const tomanFmt = (v) => compactToman(v);
const countFmt = (v) => fa(v);
const pctFmt = (v) => pct(v);

// تعریفِ کارت‌های KPI (ترتیب نمایش)
const CONFIG = [
  { key: "revenue", label: "درآمد کل", icon: DollarSign, fmt: tomanFmt, unit: "تومان", accent: "#aa4725" },
  { key: "collected", label: "وصول‌شده", icon: Wallet, fmt: tomanFmt, unit: "تومان", accent: "#16a34a" },
  { key: "outstanding", label: "مطالبات معوق", icon: AlertCircle, fmt: tomanFmt, unit: "تومان", accent: "#dc2626", invert: true },
  { key: "orders", label: "تعداد سفارش", icon: ShoppingCart, fmt: countFmt, unit: "سفارش", accent: "#3b82f6" },
  { key: "aov", label: "میانگین ارزش سفارش", icon: Receipt, fmt: tomanFmt, unit: "تومان", accent: "#7c3aed" },
  { key: "customers", label: "مشتریان فعال", icon: Users, fmt: countFmt, unit: "نفر", accent: "#0d9488" },
  { key: "newCustomers", label: "مشتریان جدید", icon: UserPlus, fmt: countFmt, unit: "نفر", accent: "#0ea5e9" },
  { key: "returningCustomers", label: "مشتریان بازگشتی", icon: UserCheck, fmt: countFmt, unit: "نفر", accent: "#f59e0b" },
  { key: "collectionRate", label: "نرخ وصول", icon: Percent, fmt: pctFmt, unit: "", accent: "#16a34a" },
  { key: "revenueGrowth", label: "رشد درآمد", icon: TrendingUp, fmt: pctFmt, unit: "", accent: "#aa4725", isGrowth: true },
  { key: "monthlyGrowth", label: "رشد ماهانه", icon: Calendar, fmt: pctFmt, unit: "", accent: "#3b82f6", isGrowth: true },
  { key: "quarterlyGrowth", label: "رشد فصلی", icon: CalendarDays, fmt: pctFmt, unit: "", accent: "#7c3aed", isGrowth: true },
  { key: "yearlyGrowth", label: "رشد سالانه", icon: CalendarRange, fmt: pctFmt, unit: "", accent: "#0d9488", isGrowth: true },
];

function KpiCard({ cfg, data }) {
  const Icon = cfg.icon;
  const value = data?.value ?? 0;
  const change = data?.change;
  const prev = data?.prev;

  return (
    <Card className="p-4 relative overflow-hidden group hover:shadow-sm transition">
      <div className="absolute -left-6 -top-6 w-20 h-20 rounded-full opacity-[0.06] group-hover:opacity-[0.1] transition" style={{ background: cfg.accent }} />
      <div className="flex items-start justify-between gap-2 relative">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.accent}1a` }}>
          <Icon size={16} style={{ color: cfg.accent }} />
        </div>
        {cfg.isGrowth
          ? <TrendBadge change={value} size="xs" />
          : <TrendBadge change={change} invert={cfg.invert} size="xs" />}
      </div>

      <p className="text-[11px] font-bold text-gray-400 mt-3">{cfg.label}</p>
      <p className="text-lg font-black text-gray-800 mt-0.5 leading-tight">
        {cfg.isGrowth ? pct(value) : cfg.fmt(value)}
        {cfg.unit && !cfg.isGrowth ? <span className="text-[10px] font-bold text-gray-400 mr-1">{cfg.unit}</span> : null}
      </p>

      {/* مقایسه با بازه‌ی قبل */}
      {cfg.isGrowth ? (
        data?.current != null ? (
          <p className="text-[10px] text-gray-400 mt-1.5">دوره فعلی: {compactToman(data.current)} تومان</p>
        ) : null
      ) : prev != null ? (
        <p className="text-[10px] text-gray-400 mt-1.5">دوره قبل: {cfg.fmt(prev)}{cfg.unit && cfg.unit !== "تومان" ? "" : ""}</p>
      ) : (
        <p className="text-[10px] text-gray-300 mt-1.5">—</p>
      )}
    </Card>
  );
}

function KpiCards({ kpis, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {CONFIG.map((cfg) => <KpiCard key={cfg.key} cfg={cfg} data={kpis?.[cfg.key]} />)}
    </div>
  );
}

export default memo(KpiCards);
