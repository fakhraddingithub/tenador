"use client";

import { memo, useMemo } from "react";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";
import { ChartCard, EmptyState } from "./primitives";
import { fa, compactToman, WEEKDAYS, WEEKDAY_ORDER } from "./format";

// رنگِ سلول بر اساس شدت (۰..۱) — از روشن به رنگ برند
function heatColor(t) {
  if (t <= 0) return "#f5f3f0";
  // درون‌یابی بین کرم روشن و #aa4725
  const from = [245, 243, 240];
  const to = [170, 71, 37];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function Cell({ label, value, max, sub }) {
  const t = max > 0 ? value / max : 0;
  const bg = heatColor(t);
  const textLight = t > 0.55;
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center aspect-square p-1 transition hover:ring-2 hover:ring-[#aa4725]/40 cursor-default"
      style={{ background: bg }}
      title={`${label}: ${fa(value)} تومان`}
    >
      <span className={`text-[10px] font-bold leading-none ${textLight ? "text-white/90" : "text-gray-500"}`}>{label}</span>
      {sub && <span className={`text-[8px] mt-0.5 leading-none ${textLight ? "text-white/70" : "text-gray-400"}`}>{sub}</span>}
    </div>
  );
}

function SalesHeatmap({ weekday = [], dayOfMonth = [], loading }) {
  const wd = useMemo(() => {
    const map = Object.fromEntries(weekday.map((w) => [w.dow, w]));
    return WEEKDAY_ORDER.map((dow) => ({ dow, label: WEEKDAYS[dow], revenue: map[dow]?.revenue || 0, orders: map[dow]?.orders || 0 }));
  }, [weekday]);

  const dom = useMemo(() => {
    const map = Object.fromEntries(dayOfMonth.map((d) => [d.day, d]));
    return Array.from({ length: 31 }, (_, i) => ({ day: i + 1, revenue: map[i + 1]?.revenue || 0, orders: map[i + 1]?.orders || 0 }));
  }, [dayOfMonth]);

  const wdMax = Math.max(1, ...wd.map((w) => w.revenue));
  const domMax = Math.max(1, ...dom.map((d) => d.revenue));

  const bestDay = useMemo(() => [...wd].sort((a, b) => b.revenue - a.revenue)[0], [wd]);
  const weakDay = useMemo(() => [...wd].filter((w) => w.revenue >= 0).sort((a, b) => a.revenue - b.revenue)[0], [wd]);

  const empty = !loading && wd.every((w) => w.revenue === 0) && dom.every((d) => d.revenue === 0);

  return (
    <ChartCard icon={Flame} title="هیت‌مپ فروش" subtitle="شناساییِ پرفروش‌ترین روزها و بازه‌های ضعیف">
      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded-xl" />
      ) : empty ? (
        <EmptyState title="داده‌ای برای هیت‌مپ نیست" />
      ) : (
        <div className="space-y-5">
          {/* Weekday */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-2">عملکرد روزهای هفته</p>
            <div className="grid grid-cols-7 gap-1.5">
              {wd.map((w) => (
                <Cell key={w.dow} label={w.label} value={w.revenue} max={wdMax} sub={w.orders ? `${fa(w.orders)}` : ""} />
              ))}
            </div>
          </div>

          {/* Day of month */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-2">عملکرد روزهای ماه</p>
            <div className="grid grid-cols-10 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
              {dom.map((d) => (
                <Cell key={d.day} label={fa(d.day)} value={d.revenue} max={domMax} />
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <TrendingUp size={16} className="text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-green-600 font-bold">پرفروش‌ترین روز</p>
                <p className="text-xs font-bold text-gray-700 truncate">{bestDay?.label} — {compactToman(bestDay?.revenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <TrendingDown size={16} className="text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-amber-600 font-bold">ضعیف‌ترین روز</p>
                <p className="text-xs font-bold text-gray-700 truncate">{weakDay?.label} — {compactToman(weakDay?.revenue)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export default memo(SalesHeatmap);
