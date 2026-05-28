"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiDollarSign, FiClock, FiSave, FiArrowRight, FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";
import Link from "next/link";
import { showToast } from "@/lib/toast";

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function TrendIcon({ current, prev }) {
  if (!prev) return <FiMinus className="text-gray-400" size={14} />;
  if (current > prev) return <FiTrendingUp className="text-red-500" size={14} />;
  if (current < prev) return <FiTrendingDown className="text-green-500" size={14} />;
  return <FiMinus className="text-gray-400" size={14} />;
}

export default function ExchangeRatePage() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exchange-rate");
      const data = await res.json();
      setCurrent(data.current);
      setHistory(data.history || []);
      if (data.current?.rateToToman) setRate(String(data.current.rateToToman));
    } catch { showToast.error("خطا در بارگذاری"); } finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const rateNum = Number(rate.replace(/,/g, ""));
    if (!rateNum || rateNum < 1000) return showToast.warning("نرخ معتبر وارد کنید (حداقل ۱۰۰۰ تومان)");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateToToman: rateNum, note }),
      });
      const data = await res.json();
      if (res.ok) { showToast.success("نرخ تبدیل ذخیره شد"); setNote(""); fetchData(); }
      else showToast.error(data.error);
    } catch { showToast.error("خطای ارتباط با سرور"); } finally { setSaving(false); }
  };

  const rateNum = Number(rate.replace(/,/g, "")) || 0;

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/p-admin" className="inline-flex items-center gap-1.5 text-xs font-bold hover:gap-2.5 transition-all" style={{ color: 'var(--color-primary)' }}>
          <FiArrowRight size={13} /> بازگشت
        </Link>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center" style={{ background: 'rgba(170,71,37,0.1)' }}>
            <FiDollarSign size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">نرخ تبدیل ارز</h1>
            <p className="text-xs font-bold text-gray-400">یورو به تومان</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-5">
        {/* Current rate cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border px-5 py-4 shadow-sm sm:col-span-2"
            style={{ borderColor: '#e8e4df' }}
          >
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">نرخ فعلی ۱ یورو</p>
            {loading ? (
              <div className="h-8 w-40 bg-gray-100 animate-pulse rounded-lg" />
            ) : current ? (
              <>
                <p className="text-3xl font-bold text-gray-900">
                  {current.rateToToman.toLocaleString("fa-IR")}
                  <span className="text-base font-bold text-gray-400 mr-2">تومان</span>
                </p>
                <p className="text-xs text-gray-400 font-bold mt-2 flex items-center gap-1.5">
                  <FiClock size={11} />
                  آخرین بروزرسانی: {formatDate(current.updatedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-red-500">نرخ تنظیم نشده</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center"
            style={{ background: 'rgba(170,71,37,0.07)', border: '1px solid rgba(170,71,37,0.15)' }}
          >
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary)' }}>مثال — ۱۰۰ یورو</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {loading ? "..." : rateNum ? (100 * rateNum).toLocaleString("fa-IR") : "—"}
            </p>
            <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-primary)' }}>تومان</p>
          </motion.div>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSave}
          className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: '#e8e4df' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: '#f0ede9' }}>
            <h2 className="font-bold text-gray-800 text-sm">ثبت نرخ جدید</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                نرخ تبدیل <span className="font-bold text-gray-400">(۱ یورو = چند تومان)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="مثال: 75000"
                  dir="ltr"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-[var(--radius)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">تومان</span>
              </div>

              {/* Live preview */}
              {rateNum > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex flex-wrap gap-2 pt-2"
                >
                  {[1, 10, 50, 100, 500].map((eur) => (
                    <span
                      key={eur}
                      dir="ltr"
                      className="text-xs bg-gray-100 px-3 py-1 rounded-lg font-bold text-gray-600 flex items-center gap-1"
                    >
                      {eur} EUR = <span dir="rtl" style={{ color: 'var(--color-primary)' }}>{(eur * rateNum).toLocaleString("fa-IR")} ت</span>
                    </span>
                  ))}
                </motion.div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                یادداشت <span className="font-bold text-gray-400">(اختیاری)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: نرخ بانک مرکزی ۱۴۰۳/۰۴/۰۵"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-[var(--radius)] px-4 py-2.5 text-sm font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !rateNum}
              className="flex items-center gap-2 text-white px-6 py-2.5 rounded-[var(--radius)] font-bold text-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{ background: 'var(--color-primary)' }}
            >
              <FiSave size={15} />
              {saving ? "در حال ذخیره..." : "ذخیره نرخ"}
            </button>
          </div>
        </motion.form>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: '#e8e4df' }}
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#f0ede9' }}>
            <FiClock size={14} style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-bold text-gray-800 text-sm">تاریخچه تغییرات</h2>
          </div>

          {loading ? (
            <div className="divide-y" style={{ borderColor: '#f5f3f0' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
                  <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm font-bold">
              هنوز تغییری ثبت نشده
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f5f3f0' }}>
              {history.map((item, idx) => {
                const prev = history[idx + 1]?.rateToToman;
                return (
                  <div key={item._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-shrink-0">
                      <TrendIcon current={item.rateToToman} prev={prev} />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">
                          {item.rateToToman.toLocaleString("fa-IR")}
                          <span className="text-xs font-bold text-gray-400 mr-1">تومان</span>
                        </span>
                        {prev && item.rateToToman !== prev && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.rateToToman > prev ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                            {item.rateToToman > prev ? "+" : ""}{((item.rateToToman - prev) / prev * 100).toFixed(1)}%
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,71,37,0.1)', color: 'var(--color-primary)' }}>
                            فعلی
                          </span>
                        )}
                      </div>
                      {item.note && <p className="text-xs text-gray-400 font-bold mt-0.5">{item.note}</p>}
                    </div>
                    <div className="text-xs text-gray-400 font-bold flex-shrink-0">{formatDate(item.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}