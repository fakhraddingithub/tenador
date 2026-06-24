"use client";

import { memo, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { AlertCircle, Wallet, Clock } from "lucide-react";
import { ChartCard, Card, EmptyState } from "./primitives";
import { fa, compactToman, axisShort, faDate, AGING_LABELS, AGING_COLORS } from "./format";

function AgingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs" dir="rtl">
      <p className="font-bold text-gray-700">{p.label}</p>
      <p className="text-gray-500">مبلغ: <span className="font-bold text-gray-800">{fa(p.amount)} تومان</span></p>
      <p className="text-gray-500">تعداد چک: <span className="font-bold">{fa(p.count)}</span></p>
    </div>
  );
}

function ReceivablesPanel({ data, loading }) {
  const aging = useMemo(
    () => (data?.aging || []).map((b) => ({ ...b, label: AGING_LABELS[b.key] })),
    [data]
  );
  const debtors = data?.byCustomer || [];
  const empty = !loading && (!aging.length || aging.every((b) => b.amount === 0));

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(170,71,37,0.1)" }}>
            <Wallet size={18} style={{ color: "#aa4725" }} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400">کل مطالبات اقساطی</p>
            <p className="text-lg font-black text-gray-800">{compactToman(data?.outstanding)} <span className="text-[10px] text-gray-400">تومان</span></p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50">
            <AlertCircle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400">معوق (سررسید گذشته)</p>
            <p className="text-lg font-black text-red-600">{compactToman(data?.overdue)} <span className="text-[10px] text-gray-400">تومان</span></p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50">
            <Clock size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400">نسبت معوق</p>
            <p className="text-lg font-black text-gray-800">
              {data?.outstanding > 0 ? fa((data.overdue / data.outstanding) * 100) : "۰"}
              <span className="text-[10px] text-gray-400 mr-0.5">٪</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Aging chart */}
      <ChartCard icon={Clock} title="تحلیل سنیِ مطالبات" subtitle="سطل‌بندیِ چک‌های پرداخت‌نشده بر اساس روزهای سررسید">
        {loading ? (
          <div className="h-56 animate-pulse bg-gray-50 rounded-xl" />
        ) : empty ? (
          <EmptyState title="مطالبات اقساطیِ بازی وجود ندارد" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={aging} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ece8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={axisShort} tick={{ fontSize: 10, fill: "#9c9189" }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<AgingTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {aging.map((b) => <Cell key={b.key} fill={AGING_COLORS[b.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Debtors table */}
      <ChartCard icon={AlertCircle} title="بدهکارانِ برتر" subtitle="مشتریان با بیشترین مانده‌ی اقساطی">
        {loading ? (
          <div className="h-40 animate-pulse bg-gray-50 rounded-xl" />
        ) : debtors.length === 0 ? (
          <EmptyState title="بدهکاری ثبت نشده" />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-[11px] border-b border-gray-100">
                  <th className="text-right font-bold py-2 px-2">مشتری</th>
                  <th className="text-right font-bold py-2 px-2 hidden sm:table-cell">سفارش</th>
                  <th className="text-left font-bold py-2 px-2">مانده</th>
                  <th className="text-left font-bold py-2 px-2 hidden sm:table-cell">معوق</th>
                  <th className="text-left font-bold py-2 px-2 hidden md:table-cell">سررسید بعدی</th>
                </tr>
              </thead>
              <tbody>
                {debtors.slice(0, 12).map((d, i) => (
                  <tr key={d.orderId || i} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                    <td className="py-2 px-2">
                      <p className="font-bold text-gray-700 truncate max-w-[140px]">{d.customer}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{d.phone}</p>
                    </td>
                    <td className="py-2 px-2 hidden sm:table-cell font-mono text-[10px] text-gray-500">{d.trackingCode || "—"}</td>
                    <td className="py-2 px-2 text-left font-black text-gray-800">{fa(d.amount)}</td>
                    <td className="py-2 px-2 text-left hidden sm:table-cell">
                      {d.overdue > 0 ? <span className="text-red-600 font-bold">{fa(d.overdue)}</span> : <span className="text-gray-300">۰</span>}
                    </td>
                    <td className="py-2 px-2 text-left hidden md:table-cell text-gray-500">{faDate(d.nextDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

export default memo(ReceivablesPanel);
