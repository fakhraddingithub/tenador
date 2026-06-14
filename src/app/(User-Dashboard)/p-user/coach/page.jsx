"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap, Users, Wallet, Phone, Mail,
  ChevronDown, ChevronUp, Calendar, AlertCircle, Loader2,
  TrendingUp,
} from "lucide-react";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

/* ── Student Card ──────────────────────────────────────────────────── */

function StudentCard({ student }) {
  const [open, setOpen] = useState(false);
  const hasCredit = student.creditEarned > 0;

  return (
    <div className={`rounded-2xl border transition-all ${hasCredit ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 bg-white"}`}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 p-4 text-right"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm flex-shrink-0">
          {student.name?.charAt(0) || "ش"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{student.name}</p>
          <p className="text-[10px] text-slate-400">{student.phone}</p>
        </div>

        {/* Credit */}
        <div className="flex-shrink-0 text-left ml-2">
          <p className={`text-sm font-bold ${hasCredit ? "text-emerald-600" : "text-slate-400"}`}>
            {student.creditEarned.toLocaleString("fa-IR")} تومان
          </p>
          <p className="text-[10px] text-slate-400">کردیت دریافتی</p>
        </div>

        {student.transactions.length > 0 && (
          open
            ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" />
            : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Transactions */}
      {open && student.transactions.length > 0 && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-2 space-y-2">
          <p className="text-[10px] text-slate-400 font-bold mb-2">تاریخچه کردیت‌های دریافتی</p>
          {student.transactions.map((tx, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <Calendar size={10} />
                {formatDate(tx.createdAt)}
              </div>
              <span className="text-xs font-bold text-emerald-600">
                +{tx.amount.toLocaleString("fa-IR")} تومان
              </span>
            </div>
          ))}
        </div>
      )}

      {open && student.transactions.length === 0 && (
        <div className="border-t border-slate-100 px-4 py-3 text-center text-[10px] text-slate-400">
          هنوز کردیتی برای این شاگرد ثبت نشده است.
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function CoachDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/coach/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!d.coach) throw new Error(d.message || "خطا در دریافت اطلاعات");
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400" dir="rtl">
        <Loader2 size={24} className="animate-spin ml-2" />
        در حال بارگذاری...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 text-sm" dir="rtl">
        <AlertCircle size={28} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  const { coach, students, totalCreditEarned } = data;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GraduationCap size={20} className="text-[var(--color-primary)]" />
        <h1 className="text-base font-bold text-slate-800">داشبورد مربی</h1>
      </div>

      {/* Coach Info Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {coach.avatar ? (
            <img
              src={coach.avatar}
              alt={coach.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-xl flex-shrink-0">
              {coach.name?.charAt(0) || "م"}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800">{coach.name}</h2>
              {coach.coachCode && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  {coach.coachCode}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
              {coach.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={9} /> {coach.phone}
                </span>
              )}
              {coach.email && (
                <span className="flex items-center gap-1">
                  <Mail size={9} /> {coach.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-xl font-bold text-slate-800">
            {students.length.toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <Users size={9} /> شاگرد
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-xl font-bold text-emerald-700">
            {(coach.walletBalance || 0).toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center justify-center gap-1">
            <Wallet size={9} /> موجودی (تومان)
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-xl font-bold text-blue-700">
            {totalCreditEarned.toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-blue-500 mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp size={9} /> کل کردیت (تومان)
          </p>
        </div>
      </div>

      {/* Students Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-600 flex items-center gap-2">
          <Users size={13} className="text-[var(--color-primary)]" />
          شاگردان و کردیت دریافتی
        </h2>

        {students.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm shadow-xs">
            هنوز هیچ شاگردی با کد معرف شما ثبت‌نام نکرده است.
          </div>
        ) : (
          students.map((student) => (
            <StudentCard key={student._id} student={student} />
          ))
        )}
      </div>
    </div>
  );
}
