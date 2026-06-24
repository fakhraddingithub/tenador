"use client";

import { memo, useState } from "react";
import { Package, TrendingDown, Lightbulb, Trophy } from "lucide-react";
import { ChartCard, EmptyState } from "./primitives";
import { fa, compactToman } from "./format";

const TABS = [
  { key: "top", label: "بیشترین درآمد" },
  { key: "topByUnits", label: "بیشترین فروش" },
];

function ProductRow({ p, i, showUnits }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition">
      <td className="py-2 px-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0
            ${i === 0 ? "bg-[#ffbf00] text-[#1a1a1a]" : i < 3 ? "bg-[#aa4725]/15 text-[#aa4725]" : "bg-gray-100 text-gray-400"}`}>
            {fa(i + 1)}
          </span>
          {p.image
            ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-700 truncate max-w-[160px]">{p.name}</p>
            <p className="text-[10px] text-gray-400 truncate">{p.brandName} · {p.categoryName}</p>
          </div>
        </div>
      </td>
      <td className="py-2 px-2 text-left font-black text-gray-800">{compactToman(p.revenue)}</td>
      <td className="py-2 px-2 text-left hidden sm:table-cell text-gray-600 font-bold">{fa(p.units)}</td>
      <td className="py-2 px-2 text-left hidden md:table-cell text-gray-500">{compactToman(p.avgPrice)}</td>
      <td className="py-2 px-2 text-left">
        <span className="inline-flex items-center gap-1">
          <span className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden hidden sm:inline-block">
            <span className="block h-full bg-[#aa4725]" style={{ width: `${Math.min(100, p.contribution)}%` }} />
          </span>
          <span className="text-[11px] font-bold text-gray-600">{fa(p.contribution)}٪</span>
        </span>
      </td>
    </tr>
  );
}

function ProductAnalytics({ data, loading }) {
  const [tab, setTab] = useState("top");
  const rows = data?.[tab] || [];
  const underperformers = data?.underperformers || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Best sellers */}
      <ChartCard
        className="lg:col-span-2"
        icon={Trophy}
        title="محصولات پرفروش"
        subtitle="عملکرد محصولات در بازه‌ی انتخابی"
        action={
          <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${tab === t.key ? "bg-white text-[#aa4725] shadow-sm" : "text-gray-400"}`}>
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="h-72 animate-pulse bg-gray-50 rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title="فروش محصولی ثبت نشده" />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[11px] border-b border-gray-100">
                  <th className="text-right font-bold py-2 px-2">محصول</th>
                  <th className="text-left font-bold py-2 px-2">درآمد</th>
                  <th className="text-left font-bold py-2 px-2 hidden sm:table-cell">تعداد</th>
                  <th className="text-left font-bold py-2 px-2 hidden md:table-cell">میانگین قیمت</th>
                  <th className="text-left font-bold py-2 px-2">سهم</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => <ProductRow key={p.productId || i} p={p} i={i} />)}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Underperformers + recommendations */}
      <ChartCard icon={TrendingDown} title="محصولات کم‌فروش" subtitle="نیازمند بازنگری">
        {loading ? (
          <div className="h-72 animate-pulse bg-gray-50 rounded-xl" />
        ) : underperformers.length === 0 ? (
          <EmptyState icon={Package} title="داده‌ای نیست" />
        ) : (
          <div className="space-y-2">
            {underperformers.slice(0, 5).map((p) => (
              <div key={p.productId} className="flex items-center justify-between gap-2 bg-gray-50/70 rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {p.image
                    ? <img src={p.image} alt="" className="w-7 h-7 rounded-md object-cover border border-gray-100 flex-shrink-0" />
                    : <div className="w-7 h-7 rounded-md bg-gray-200 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-700 truncate max-w-[120px]">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{fa(p.units)} فروش</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-gray-500 flex-shrink-0">{compactToman(p.revenue)}</span>
              </div>
            ))}

            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] mb-1.5">
                <Lightbulb size={13} /> پیشنهادهای بهبود
              </div>
              <ul className="text-[11px] text-amber-700/90 space-y-1 leading-relaxed list-disc pr-4">
                <li>برای محصولات کم‌فروش کمپین تخفیف یا فروش ویژه تعریف کنید.</li>
                <li>قیمت‌گذاری و تصویر محصول را با رقبا مقایسه و بهینه کنید.</li>
                <li>محصولات راکد را در صفحه‌ی اصلی یا بنرها برجسته کنید.</li>
              </ul>
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

export default memo(ProductAnalytics);
