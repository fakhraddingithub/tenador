"use client";

import { ChartCard, EmptyState } from "./primitives";
import { useAnalyticsCurrency } from "./CurrencyContext";

export default function EuroReceivables({ data, loading }) {
  const { fa } = useAnalyticsCurrency();
  return (
    <ChartCard title="مانده‌ی سفارش‌های یورویی" subtitle="تمام سفارش‌های غیرلغوشده؛ برای داده‌های یورویی سررسید ثبت نشده و تحلیل معوق قابل محاسبه نیست.">
      {loading ? <div className="h-40 animate-pulse bg-gray-50 rounded-xl" /> : <>
        <p className="font-bold mb-4">کل مانده: {fa(data?.outstanding)} یورو</p>
        {!data?.byCustomer?.length ? <EmptyState title="مانده‌ی یورویی ثبت نشده" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead><tr className="border-b border-gray-100"><th className="p-2">مشتری</th><th className="p-2">سفارش</th><th className="p-2">مانده (یورو)</th></tr></thead>
              <tbody>{data.byCustomer.map((row) => <tr key={row.orderId} className="border-b border-gray-50">
                <td className="p-2">{row.customer || "—"}<p className="text-gray-500">{row.phone}</p></td>
                <td className="p-2">{row.trackingCode || "—"}</td><td className="p-2 font-bold">{fa(row.amount)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </>}
    </ChartCard>
  );
}
