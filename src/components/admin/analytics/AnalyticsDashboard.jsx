"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import { BarChart3, Sparkles, AlertTriangle } from "lucide-react";

import GlobalFilter, { presetRange } from "./GlobalFilter";
import ExportMenu from "./ExportMenu";
import KpiCards from "./KpiCards";
import RevenueTrends from "./RevenueTrends";
import SalesHeatmap from "./SalesHeatmap";
import ReceivablesPanel from "./ReceivablesPanel";
import CustomerAnalytics from "./CustomerAnalytics";
import ProductAnalytics from "./ProductAnalytics";
import CategoryBrandAnalytics from "./CategoryBrandAnalytics";
import OrderAnalytics from "./OrderAnalytics";
import InsightCards from "./InsightCards";
import { FadeIn, SectionTitle } from "./primitives";
import { faDate } from "./format";

export default function AnalyticsDashboard() {
  const [preset, setPreset] = useState("last30");
  const [range, setRange] = useState(() => presetRange("last30"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reqId = useRef(0);

  const fetchData = useCallback(async (r) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(false);
    try {
      const sp = new URLSearchParams({ from: r.from.toISOString(), to: r.to.toISOString() });
      const res = await fetch(`/api/admin/analytics?${sp.toString()}`);
      const json = await res.json();
      if (id !== reqId.current) return; // درخواستِ منسوخ
      if (!res.ok) throw new Error(json.message || "خطا در دریافت داده");
      setData(json);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(true);
      toast.error(e.message || "خطا در دریافت تحلیل‌ها");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // واکشیِ اولیه — با تأخیرِ صفر تا setStateِ همگام در بدنه‌ی افکت رخ ندهد
  useEffect(() => {
    const t = setTimeout(() => fetchData(range), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilterChange = useCallback(({ preset: p, range: r }) => {
    setPreset(p);
    setRange(r);
    fetchData(r);
  }, [fetchData]);

  const rangeLabel = useMemo(
    () => (range ? `${faDate(range.from)} تا ${faDate(range.to)}` : ""),
    [range]
  );

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius,8px)] flex items-center justify-center" style={{ background: "rgba(170,71,37,0.1)" }}>
            <BarChart3 size={18} style={{ color: "#aa4725" }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">تحلیل مالی و هوش فروش</h1>
            <p className="text-xs font-bold text-gray-400">بینش‌های عملیاتی برای رشد فروش و بهبود جریان نقدی</p>
          </div>
        </div>
        <ExportMenu data={data} rangeLabel={rangeLabel} disabled={loading || !data} />
      </div>

      {/* Global filter */}
      <GlobalFilter preset={preset} range={range} onChange={onFilterChange} onRefresh={() => fetchData(range)} loading={loading} />

      {error ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <AlertTriangle size={34} className="mx-auto text-red-300 mb-2" />
          <p className="text-sm font-bold text-gray-500">خطا در دریافت داده‌های تحلیلی</p>
          <button onClick={() => fetchData(range)} className="mt-3 text-xs font-bold text-[#aa4725] hover:underline">تلاش مجدد</button>
        </div>
      ) : (
        <>
          {/* Executive summary */}
          <FadeIn>
            <SectionTitle icon={Sparkles} title="خلاصه‌ی اجرایی" subtitle={`مقایسه با دوره‌ی قبلیِ هم‌طول · ${rangeLabel}`} />
            <KpiCards kpis={data?.kpis} loading={loading} />
          </FadeIn>

          {/* Insights */}
          {!loading && data?.insights?.length > 0 && (
            <FadeIn delay={0.05}><InsightCards insights={data.insights} loading={loading} /></FadeIn>
          )}

          {/* Revenue + heatmap */}
          <FadeIn delay={0.05}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2"><RevenueTrends daily={data?.revenue?.daily} monthly={data?.revenue?.monthly} loading={loading} /></div>
              <div><SalesHeatmap weekday={data?.heatmap?.weekday} dayOfMonth={data?.heatmap?.dayOfMonth} loading={loading} /></div>
            </div>
          </FadeIn>

          {/* Orders */}
          <FadeIn delay={0.05}><OrderAnalytics daily={data?.revenue?.daily} loading={loading} /></FadeIn>

          {/* Receivables */}
          <FadeIn delay={0.05}>
            <SectionTitle icon={AlertTriangle} title="مطالبات و بدهی‌ها" subtitle="تحلیل سنی و بدهکاران" />
            <ReceivablesPanel data={data?.receivables} loading={loading} />
          </FadeIn>

          {/* Customers */}
          <FadeIn delay={0.05}><CustomerAnalytics data={data?.customers} loading={loading} /></FadeIn>

          {/* Products */}
          <FadeIn delay={0.05}><ProductAnalytics data={data?.products} loading={loading} /></FadeIn>

          {/* Category & brand */}
          <FadeIn delay={0.05}><CategoryBrandAnalytics categories={data?.categories} brands={data?.brands} loading={loading} /></FadeIn>
        </>
      )}
    </div>
  );
}
