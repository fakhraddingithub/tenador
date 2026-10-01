"use client";

import { Wallet } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { ChartCard, EmptyState } from "./primitives";
import { useAnalyticsCurrency } from "./CurrencyContext";
import { faDayLabel } from "./format";

export default function EuroCollections({ data, loading }) {
  const { fa, axisShort } = useAnalyticsCurrency();
  return (
    <ChartCard icon={Wallet} title="پرداخت‌های یورویی در بازه"
      subtitle="بر اساس تاریخ ثبت پرداخت؛ شامل سفارش‌های قدیمی و سفارش‌های بدون مبلغ کل یورویی">
      {loading ? <div className="h-64 animate-pulse bg-gray-50 rounded-xl" /> : !data?.count ? (
        <EmptyState title="پرداخت یورویی در این بازه ثبت نشده" />
      ) : <>
        <p className="text-sm font-bold mb-4">{fa(data.count)} پرداخت · مجموع {fa(data.total)} یورو</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.daily}>
            <XAxis dataKey="date" tickFormatter={faDayLabel} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={axisShort} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={faDayLabel} formatter={(value) => [`${fa(value)} یورو`, "وصول‌شده"]} />
            <Bar dataKey="amount" fill="#aa4725" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </>}
    </ChartCard>
  );
}
