"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { ShoppingCart } from "lucide-react";
import { ChartCard, Card, EmptyState } from "./primitives";
import { fa, compactToman, axisShort, faDayLabel, COLORS } from "./format";

function OrderTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs" dir="rtl">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-gray-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-gray-800">{fa(p.value)}{p.dataKey === "aov" ? " تومان" : ""}</span>
        </p>
      ))}
    </div>
  );
}

function OrderAnalytics({ daily = [], loading }) {
  const data = useMemo(
    () => daily.map((d) => ({ label: faDayLabel(d.date), orders: d.orders, aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0 })),
    [daily]
  );

  const stats = useMemo(() => {
    const totalOrders = daily.reduce((s, d) => s + d.orders, 0);
    const days = daily.length || 1;
    const peak = [...daily].sort((a, b) => b.orders - a.orders)[0];
    return {
      totalOrders,
      avgPerDay: Math.round(totalOrders / days),
      peakOrders: peak?.orders || 0,
      peakDate: peak?.date,
    };
  }, [daily]);

  const empty = !loading && data.length === 0;

  return (
    <ChartCard icon={ShoppingCart} title="تحلیل سفارش‌ها" subtitle="تعداد سفارش و میانگین ارزش سفارش (روند روزانه)">
      {loading ? (
        <div className="h-72 animate-pulse bg-gray-50 rounded-xl" />
      ) : empty ? (
        <EmptyState title="سفارشی در این بازه نیست" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-2.5 text-center bg-gray-50/60 border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold">میانگین روزانه</p>
              <p className="text-sm font-black text-gray-800">{fa(stats.avgPerDay)}</p>
            </Card>
            <Card className="p-2.5 text-center bg-gray-50/60 border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold">اوج روزانه</p>
              <p className="text-sm font-black text-gray-800">{fa(stats.peakOrders)}</p>
            </Card>
            <Card className="p-2.5 text-center bg-gray-50/60 border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold">کل سفارش‌ها</p>
              <p className="text-sm font-black text-gray-800">{fa(stats.totalOrders)}</p>
            </Card>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="left" tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<OrderTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar yAxisId="left" dataKey="orders" name="سفارش‌ها" radius={[5, 5, 0, 0]} maxBarSize={32}>
                {data.map((_, i) => <Cell key={i} fill={COLORS.blue} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="aov" name="میانگین ارزش" stroke={COLORS.primary} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export default memo(OrderAnalytics);
