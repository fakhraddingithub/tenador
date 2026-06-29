"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar, AlertTriangle, Wallet, Search, ChevronLeft,
  Clock, CheckCircle, XCircle, Loader2, TrendingUp, Filter, Calculator,
} from "lucide-react";
import InstallmentCalculatorModal from "@/components/admin/financial/InstallmentCalculatorModal";
import { INSTALLMENT_RATE_KEY, DEFAULT_MONTHLY_RATE } from "@/lib/installmentFinance";

/* ─── helpers ─── */
const fa = (n) => new Intl.NumberFormat("fa-IR").format(Number(n ?? 0));
const faDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(d))
    : "—";

const STATUS = {
  PENDING: { label: "در انتظار تأیید", cls: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
  ACTIVE: { label: "در حال پرداخت", cls: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500" },
  OVERDUE: { label: "سررسید گذشته", cls: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  COMPLETED: { label: "تکمیل شده", cls: "bg-green-50 text-green-600 border-green-200", dot: "bg-green-500" },
  DEFAULTED: { label: "چک برگشتی", cls: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-600" },
};

const STATUS_FILTERS = [
  { key: "", label: "همه" },
  { key: "OVERDUE", label: "سررسید گذشته" },
  { key: "PENDING", label: "در انتظار" },
  { key: "ACTIVE", label: "در حال پرداخت" },
  { key: "COMPLETED", label: "تکمیل شده" },
  { key: "DEFAULTED", label: "برگشتی" },
];

const SORTS = [
  { key: "newest", label: "جدیدترین" },
  { key: "dueDate", label: "سررسید بعدی" },
  { key: "amount", label: "مبلغ" },
  { key: "status", label: "وضعیت" },
];

function StatCard({ icon: Icon, label, value, suffix, accent }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--admin-border)] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}1a` }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-gray-400">{label}</p>
        <p className="text-lg font-black text-gray-800 truncate">
          {value}{suffix ? <span className="text-[11px] font-bold text-gray-400 mr-1">{suffix}</span> : null}
        </p>
      </div>
    </div>
  );
}

export default function InstallmentsManager() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ totalActive: 0, totalOverdue: 0, expectedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [defaultRate, setDefaultRate] = useState(DEFAULT_MONTHLY_RATE);

  // نرخ سود ماهانه‌ی پیش‌فرض برای ماشین‌حساب اقساط (Part 1)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/site-settings?key=${INSTALLMENT_RATE_KEY}`);
        const data = await res.json();
        const val = Number(data?.value);
        if (val > 0) setDefaultRate(val);
      } catch {
        /* از پیش‌فرض استفاده می‌شود */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (sort) sp.set("sort", sort);
      if (q.trim()) sp.set("q", q.trim());
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const res = await fetch(`/api/admin/installments?${sp.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.installments || []);
        setStats(data.stats || {});
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [status, sort, q, from, to]);

  // debounce for search; immediate for filters
  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div dir="rtl" className="space-y-5">
      {/* Action bar — Installment Calculator */}
      <div className="flex justify-start">
        <button
          onClick={() => setCalcOpen(true)}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-[#aa4725]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
          style={{ background: "#aa4725" }}
        >
          <Calculator size={16} />
          ماشین حساب اقساط
        </button>
      </div>

      <InstallmentCalculatorModal
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        defaultRate={defaultRate}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="اقساط فعال" value={fa(stats.totalActive)} suffix="مورد" accent="#3b82f6" />
        <StatCard icon={AlertTriangle} label="سررسید گذشته" value={fa(stats.totalOverdue)} suffix="مورد" accent="#ef4444" />
        <StatCard icon={Wallet} label="انتظار وصول این ماه" value={fa(stats.expectedThisMonth)} suffix="تومان" accent="#aa4725" />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-[var(--admin-border)] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition
                ${status === f.key ? "bg-[#aa4725] text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-[#aa4725]/40"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام/تلفن مشتری یا کد رهگیری..."
              className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm font-medium text-gray-800
                focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725] transition"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-600 cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>مرتب‌سازی: {s.label}</option>)}
          </select>

          <button
            onClick={() => setShowDate((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition
              ${showDate || from || to ? "bg-[#aa4725]/10 text-[#aa4725] border-[#aa4725]/30" : "bg-white text-gray-500 border-gray-200 hover:border-[#aa4725]/40"}`}
          >
            <Filter size={14} /> بازه تاریخ
          </button>
        </div>

        {showDate && (
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">از تاریخ (میلادی)</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">تا تاریخ (میلادی)</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30" />
            </div>
            {(from || to) && (
              <button onClick={() => { setFrom(""); setTo(""); }}
                className="text-xs font-bold text-red-500 hover:underline py-2">پاک کردن</button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={26} className="animate-spin text-[#aa4725]" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--admin-border)] p-10 text-center text-sm text-gray-400">
          <Calendar size={34} className="mx-auto mb-3 opacity-30" />
          طرح اقساطی با این فیلترها یافت نشد
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const st = STATUS[r.derivedStatus] || STATUS.PENDING;
            const perInstallment = r.numberOfChecks > 0 ? Math.round(r.checksTotal / r.numberOfChecks) : 0;
            return (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Link
                  href={`/p-admin/financial/installments/${r._id}`}
                  className="block bg-white rounded-xl border border-[var(--admin-border)] p-4 hover:border-[#aa4725]/40 hover:shadow-sm transition group"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Customer + order */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{r.customer.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono truncate">
                          {r.order.trackingCode} · {r.customer.phone}
                        </p>
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-gray-300 group-hover:text-[#aa4725] transition flex-shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-0.5">مبلغ کل</p>
                      <p className="font-bold text-gray-700">{fa(r.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">اقساط</p>
                      <p className="font-bold text-gray-700">{fa(r.paidChecksCount)}/{fa(r.numberOfChecks)} پرداخت</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">هر قسط</p>
                      <p className="font-bold text-gray-700">{fa(perInstallment)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">سررسید بعدی</p>
                      <p className="font-bold text-gray-700">{faDate(r.nextDueDate)}</p>
                    </div>
                    <div className="flex items-end">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${st.cls}`}>
                        {st.label}
                        {r.overdueCount > 0 && r.derivedStatus !== "OVERDUE" ? ` (${fa(r.overdueCount)})` : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
