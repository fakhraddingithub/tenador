"use client";

import { useState, useMemo, memo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import { ChartCard, EmptyState } from "./primitives";
import { fa, compactToman, axisShort, faDayLabel, faMonthLabel, COLORS } from "./format";

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs" dir="rtl">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-gray-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-gray-800">{fa(p.value)}{p.dataKey === "revenue" ? " تومان" : ""}</span>
        </p>
      ))}
    </div>
  );
}

const VIEWS = [
  { key: "daily", label: "روزانه" },
  { key: "monthly", label: "ماهانه (۱۲ ماه)" },
];

function RevenueTrends({ daily = [], monthly = [], loading }) {
  const [view, setView] = useState("daily");

  const data = useMemo(() => {
    if (view === "daily") {
      return daily.map((d) => ({ label: faDayLabel(d.date), revenue: d.revenue, orders: d.orders }));
    }
    return monthly.map((m) => ({ label: faMonthLabel(m.month), revenue: m.revenue, orders: m.orders }));
  }, [view, daily, monthly]);

  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.revenue, 0), [data]);

  const action = (
    <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => setView(v.key)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition
            ${view === v.key ? "bg-white text-[#aa4725] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard icon={LineIcon} title="روند درآمد" subtitle={`مجموع نمایش‌داده‌شده: ${compactToman(totalRevenue)} تومان`} action={action}>
      {loading ? (
        <div className="h-72 animate-pulse bg-gray-50 rounded-xl" />
      ) : data.length === 0 ? (
        <EmptyState title="فروشی در این بازه ثبت نشده" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {view === "daily" ? (
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="revenue" name="درآمد" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(170,71,37,0.05)" }} />
              <Bar dataKey="revenue" name="درآمد" radius={[6, 6, 0, 0]} maxBarSize={42}>
                {data.map((_, i) => <Cell key={i} fill={COLORS.primary} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export default memo(RevenueTrends);
