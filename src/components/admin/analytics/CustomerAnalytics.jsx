"use client";

import { memo, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Users, Crown, Repeat, UserX, Gem, Heart } from "lucide-react";
import { ChartCard, Card, EmptyState } from "./primitives";
import { fa, compactToman, CATEGORICAL } from "./format";

const SEG = [
  { key: "vip", label: "ویژه (VIP)", icon: Crown, color: "#ffbf00" },
  { key: "highValue", label: "پرارزش", icon: Gem, color: "#aa4725" },
  { key: "repeat", label: "تکرارشونده", icon: Repeat, color: "#3b82f6" },
  { key: "oneTime", label: "تک‌خرید", icon: Heart, color: "#0d9488" },
  { key: "atRisk", label: "در معرض ریزش", icon: UserX, color: "#dc2626" },
];

function SegTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-1.5 text-xs" dir="rtl">
      <p className="font-bold text-gray-700">{p.name}: {fa(p.value)} نفر</p>
    </div>
  );
}

const TABS = [
  { key: "topByRevenue", label: "بر اساس درآمد", valueKey: "rangeRevenue", isMoney: true },
  { key: "topByOrders", label: "بر اساس تعداد", valueKey: "rangeOrders", isMoney: false },
  { key: "topByAov", label: "بالاترین میانگین", valueKey: "aov", isMoney: true },
];

function CustomerAnalytics({ data, loading }) {
  const [tab, setTab] = useState("topByRevenue");
  const seg = data?.segmentation;

  const pieData = useMemo(
    () => SEG.map((s) => ({ name: s.label, value: seg?.[s.key] || 0, color: s.color })).filter((d) => d.value > 0),
    [seg]
  );

  const activeTab = TABS.find((t) => t.key === tab);
  const rows = data?.[tab] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Segmentation + CLV */}
      <ChartCard icon={Users} title="بخش‌بندی مشتریان" subtitle="دسته‌بندیِ رفتاریِ مشتریان">
        {loading ? (
          <div className="h-64 animate-pulse bg-gray-50 rounded-xl" />
        ) : !seg || seg.total === 0 ? (
          <EmptyState title="مشتری‌ای ثبت نشده" />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<SegTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-1.5">
              {SEG.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Icon size={13} style={{ color: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-black text-gray-800">{fa(seg?.[s.key] || 0)}</span>
                  </div>
                );
              })}
              <div className="pt-2 mt-1 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-bold">میانگین ارزش عمر (CLV)</span>
                <span className="font-black text-[#aa4725]">{compactToman(data?.clv?.average)}</span>
              </div>
            </div>
          </div>
        )}
      </ChartCard>

      {/* Rankings */}
      <ChartCard
        icon={Crown}
        title="مشتریان برتر"
        subtitle="رتبه‌بندیِ مشتریان"
        action={
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${tab === t.key ? "bg-white text-[#aa4725] shadow-sm" : "text-gray-400"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="h-64 animate-pulse bg-gray-50 rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState title="داده‌ای نیست" />
        ) : (
          <div className="space-y-1.5">
            {rows.slice(0, 8).map((r, i) => {
              const val = r[activeTab.valueKey];
              const max = rows[0]?.[activeTab.valueKey] || 1;
              return (
                <div key={r.userId || i} className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-[#aa4725]/5" style={{ width: `${(val / max) * 100}%` }} />
                  <div className="flex items-center gap-2 min-w-0 relative">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0
                      ${i === 0 ? "bg-[#ffbf00] text-[#1a1a1a]" : i < 3 ? "bg-[#aa4725]/15 text-[#aa4725]" : "bg-gray-100 text-gray-400"}`}>
                      {fa(i + 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{r.phone}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-gray-800 relative flex-shrink-0">
                    {activeTab.isMoney ? compactToman(val) : `${fa(val)} سفارش`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

export default memo(CustomerAnalytics);
