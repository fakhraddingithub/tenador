"use client";

import { getUserFullName } from "base/utils/userName";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap, Users, ArrowRight, Package, Clock,
  CheckCircle, XCircle, AlertCircle, Loader2, Wallet,
  Phone, Mail, Hash, Calendar, Eye,
} from "lucide-react";
import AdminLoader from "@/components/admin/AdminLoader";

/* ─── Status helpers ────────────────────────────────────────────────── */

const PAYMENT_LABELS = {
  UNPAID: { label: "پرداخت نشده", cls: "bg-red-50 text-red-600 border-red-200" },
  PARTIALLY_PAID: { label: "پرداخت ناقص", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  PAID: { label: "پرداخت شده", cls: "bg-green-50 text-green-600 border-green-200" },
};

const FULFILLMENT_LABELS = {
  WAITING: { label: "در انتظار", cls: "bg-gray-50 text-gray-500 border-gray-200" },
  NEEDS_PURCHASE: { label: "باید خریداری شود", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  PROCESSING: { label: "در پردازش", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  SENT: { label: "ارسال شد", cls: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  DELIVERED: { label: "تحویل داده شد", cls: "bg-green-50 text-green-600 border-green-200" },
  CANCELED: { label: "لغو شده", cls: "bg-red-50 text-red-500 border-red-200" },
};

function StatusBadge({ map, value }) {
  const cfg = map[value] || { label: value || "—", cls: "bg-gray-50 text-gray-500 border-gray-200" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── Order Row ─────────────────────────────────────────────────────── */

function OrderRow({ order, coachId }) {
  const isUnreviewed = !order.reviewedAt;
  const previewItem = order.items?.[0];
  const extraCount = (order.items?.length || 0) - 1;

  return (
    <Link
      href={`/p-admin/users/coaches/${coachId}/credit/${order._id}`}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors group hover:bg-gray-50 ${
        isUnreviewed
          ? "border border-amber-200 bg-amber-50/40 hover:bg-amber-50"
          : "border border-gray-100 bg-white"
      }`}
    >
      {/* Product thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
        {previewItem?.product?.mainImage ? (
          <img
            src={previewItem.product.mainImage}
            alt={previewItem.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package size={16} className="m-auto mt-2 text-gray-300" />
        )}
      </div>

      {/* Order info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isUnreviewed && (
            <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
              بررسی نشده
            </span>
          )}
          <span className="text-[10px] font-mono text-gray-400">
            {order.trackingCode || "—"}
          </span>
          {extraCount > 0 && (
            <span className="text-[10px] text-gray-400">+{extraCount} محصول دیگر</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge map={PAYMENT_LABELS} value={order.paymentStatus} />
          <StatusBadge map={FULFILLMENT_LABELS} value={order.fulfillmentStatus} />
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs font-bold text-gray-800">
          {(order.totalPrice || 0).toLocaleString("fa-IR")} تومان
        </span>
        <span className="text-[10px] text-gray-400">{formatDate(order.orderDate)}</span>
      </div>

      <Eye size={14} className="text-gray-300 group-hover:text-[#aa4725] transition-colors flex-shrink-0" />
    </Link>
  );
}

/* ─── Student Section ───────────────────────────────────────────────── */

function StudentSection({ student, coachId }) {
  const [open, setOpen] = useState(true);
  const unreviewedCount = student.orders.filter((o) => !o.reviewedAt).length;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50/60 transition-colors text-right"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm flex-shrink-0">
            {getUserFullName(student)?.charAt(0) || "ش"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{getUserFullName(student)}</p>
            <p className="text-[10px] text-slate-400 dir-ltr">{student.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400">
            {student.orders.length} سفارش
          </span>
          {unreviewedCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
              {unreviewedCount} بررسی نشده
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {student.orders.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-4">
              هیچ سفارشی ثبت نشده است.
            </p>
          ) : (
            student.orders.map((order) => (
              <OrderRow key={order._id} order={order} coachId={coachId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function CoachDetailPage() {
  const router = useRouter();
  const params = useParams();
  const coachId = params.coachId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) return;
    setLoading(true);
    fetch(`/api/admin/coaches/${coachId}/orders`)
      .then((r) => r.json())
      .then((d) => {
        if (d.message && !d.coach) throw new Error(d.message);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [coachId]);

  if (loading) return <AdminLoader />;

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 text-sm" dir="rtl">
        <AlertCircle size={28} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  const { coach, students, unreviewedCount } = data;
  const totalOrders = students.reduce((sum, s) => sum + s.orders.length, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/p-admin/users/coaches")}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowRight size={14} />
          بازگشت
        </button>
        <span className="text-slate-300">/</span>
        <h1 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <GraduationCap size={16} className="text-[var(--color-primary)]" />
          {getUserFullName(coach)}
        </h1>
      </div>

      {/* Coach Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {coach.avatar ? (
              <img
                src={coach.avatar}
                alt={getUserFullName(coach)}
                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-2xl">
                {getUserFullName(coach)?.charAt(0) || "م"}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800">{getUserFullName(coach)}</h2>
              {coach.coachCode && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  {coach.coachCode}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {coach.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} /> {coach.phone}
                </span>
              )}
              {coach.email && (
                <span className="flex items-center gap-1">
                  <Mail size={11} /> {coach.email}
                </span>
              )}
            </div>
          </div>

          {/* Wallet balance */}
          <div className="flex-shrink-0 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-center mb-1">
              <Wallet size={11} /> موجودی کیف پول
            </p>
            <p className="text-lg font-bold text-emerald-700">
              {(coach.walletBalance || 0).toLocaleString("fa-IR")}
            </p>
            <p className="text-[10px] text-emerald-500">تومان</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-2xl font-bold text-slate-800">
            {students.length.toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <Users size={10} /> شاگرد
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-2xl font-bold text-slate-800">
            {totalOrders.toLocaleString("fa-IR")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
            <Package size={10} /> سفارش کل
          </p>
        </div>
        <div className={`border rounded-2xl p-4 text-center shadow-xs ${unreviewedCount > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"}`}>
          <p className={`text-2xl font-bold ${unreviewedCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
            {unreviewedCount.toLocaleString("fa-IR")}
          </p>
          <p className={`text-[10px] mt-0.5 flex items-center justify-center gap-1 ${unreviewedCount > 0 ? "text-amber-500" : "text-slate-400"}`}>
            <Clock size={10} /> بررسی نشده
          </p>
        </div>
      </div>

      {/* Students + Orders */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Users size={14} className="text-[var(--color-primary)]" />
          شاگردان و سفارشات
        </h2>

        {students.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-sm shadow-xs">
            این مربی هنوز هیچ شاگردی ندارد.
          </div>
        ) : (
          students.map((student) => (
            <StudentSection
              key={student._id}
              student={student}
              coachId={coachId}
            />
          ))
        )}
      </div>
    </div>
  );
}
