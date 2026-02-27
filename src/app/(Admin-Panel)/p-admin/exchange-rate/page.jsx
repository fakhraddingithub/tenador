"use client";

import { useState, useEffect } from "react";
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
  const [current, setCurrent]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/exchange-rate");
      const data = await res.json();
      setCurrent(data.current);
      setHistory(data.history || []);
      if (data.current?.rateToToman) {
        setRate(String(data.current.rateToToman));
      }
    } catch {
      showToast.error("خطا در بارگذاری");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const rateNum = Number(rate.replace(/,/g, ""));
    if (!rateNum || rateNum < 1000) {
      return showToast.warning("نرخ معتبر وارد کنید (حداقل ۱۰۰۰ تومان)");
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/exchange-rate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rateToToman: rateNum, note }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast.success("نرخ تبدیل ذخیره شد");
        setNote("");
        fetchData();
      } else {
        showToast.error(data.error);
      }
    } catch {
      showToast.error("خطای ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  const rateNum    = Number(rate.replace(/,/g, "")) || 0;
  const previewToman = rateNum ? (100 * rateNum).toLocaleString("fa-IR") : "—";

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-20">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-5 py-5 flex items-center gap-4">
          <Link href="/p-admin" className="p-2 hover:bg-neutral-100 rounded-xl transition-all text-neutral-400">
            <FiArrowRight size={19} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-primary)]/10 rounded-xl">
              <FiDollarSign size={20} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">نرخ تبدیل ارز</h1>
              <p className="text-xs text-neutral-400 mt-0.5">یورو به تومان</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-10 space-y-8">

        {/* نرخ فعلی */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-100 rounded-[var(--radius)] px-6 py-5 shadow-sm sm:col-span-2">
            <p className="text-xs font-semibold text-neutral-400 mb-1">نرخ فعلی ۱ یورو</p>
            {loading ? (
              <div className="h-8 w-40 bg-neutral-100 animate-pulse rounded mt-1" />
            ) : current ? (
              <>
                <p className="text-3xl font-bold text-neutral-800">
                  {current.rateToToman.toLocaleString("fa-IR")}
                  <span className="text-base font-normal text-neutral-400 mr-2">تومان</span>
                </p>
                <p className="text-xs text-neutral-400 mt-2">
                  آخرین بروزرسانی: {formatDate(current.updatedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-red-400 font-bold mt-1">نرخ تنظیم نشده</p>
            )}
          </div>

          <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)] rounded-[var(--radius)] px-6 py-5 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-semibold text-[var(--color-primary)] mb-1">مثال — ۱۰۰ یورو</p>
            <p className="text-2xl font-bold text-[var(--color-primary)]">
              {loading ? "..." : previewToman}
            </p>
            <p className="text-xs text-[var(--color-primary)] mt-1">تومان</p>
          </div>
        </div>

        {/* فرم ثبت نرخ جدید */}
        <form
          onSubmit={handleSave}
          className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-neutral-50">
            <h2 className="font-bold text-neutral-700">ثبت نرخ جدید</h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-600">
                نرخ تبدیل <span className="font-normal text-neutral-400">(۱ یورو = چند تومان)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="مثال: 75000"
                  dir="ltr"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3.5 text-lg font-bold outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-300 transition-all"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                  تومان
                </span>
              </div>
              {/* پیش‌نمایش زنده */}
              {rateNum > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {[1, 10, 50, 100, 500].map((eur) => (
                    <span 
                    dir="ltr" 
                    key={eur} 
                    className="text-xs bg-neutral-100 px-3 py-1 rounded-full text-neutral-600 font-medium flex items-center gap-1.5"
                  >
                    {eur} EUR = <span dir="rtl">{(eur * rateNum).toLocaleString("fa-IR")} تومان</span>
                  </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-600">
                یادداشت <span className="font-normal text-neutral-400">(اختیاری)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: نرخ بانک مرکزی ۱۴۰۳/۰۴/۰۵"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-[var(--radius)] px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !rateNum}
              className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-8 py-3 rounded-[var(--radius)] font-bold hover:bg-[var(--color-primary)]/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <FiSave size={16} />
              {saving ? "در حال ذخیره..." : "ذخیره نرخ"}
            </button>
          </div>
        </form>

        {/* تاریخچه */}
        <div className="bg-white border border-neutral-100 rounded-[var(--radius)] shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-neutral-50">
            <FiClock size={15} className="text-neutral-400" />
            <h2 className="font-bold text-neutral-700">تاریخچه تغییرات</h2>
          </div>

          {loading ? (
            <div className="divide-y divide-neutral-50">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-4 w-28 bg-neutral-100 animate-pulse rounded" />
                  <div className="h-4 w-20 bg-neutral-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              هنوز تغییری ثبت نشده
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {history.map((item, idx) => {
                const prev = history[idx + 1]?.rateToToman;
                return (
                  <div key={item._id} className="flex items-center gap-4 px-6 py-4">
                    {/* trend */}
                    <div className="flex-shrink-0">
                      <TrendIcon current={item.rateToToman} prev={prev} />
                    </div>

                    {/* نرخ */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-neutral-800">
                          {item.rateToToman.toLocaleString("fa-IR")}
                          <span className="text-xs font-normal text-neutral-400 mr-1">تومان</span>
                        </span>
                        {prev && item.rateToToman !== prev && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            item.rateToToman > prev
                              ? "bg-red-50 text-red-500"
                              : "bg-green-50 text-green-600"
                          }`}>
                            {item.rateToToman > prev ? "+" : ""}
                            {((item.rateToToman - prev) / prev * 100).toFixed(1)}%
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold px-2 py-0.5 rounded-full">
                            فعلی
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-xs text-neutral-400 mt-0.5">{item.note}</p>
                      )}
                    </div>

                    {/* تاریخ */}
                    <div className="text-xs text-neutral-400 text-left flex-shrink-0">
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}