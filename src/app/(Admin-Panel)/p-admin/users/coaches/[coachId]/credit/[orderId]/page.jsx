"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  GraduationCap, ArrowRight, Wallet, Package, Users,
  Phone, CheckCircle, AlertCircle, Loader2, Receipt,
  Calendar, Hash, CreditCard,
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
    month: "long",
    day: "numeric",
  });
}

/* ─── Order Summary ─────────────────────────────────────────────────── */

function OrderSummary({ order }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Receipt size={14} className="text-[#aa4725]" />
        خلاصه سفارش
      </h3>

      {/* Buyer */}
      {order.user && (
        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
          <Users size={13} className="text-gray-400 flex-shrink-0" />
          <span className="font-bold">{order.user.name}</span>
          {order.user.phone && (
            <span className="text-gray-400 flex items-center gap-1">
              <Phone size={10} /> {order.user.phone}
            </span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
        {order.trackingCode && (
          <span className="flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded-md">
            <Hash size={9} /> {order.trackingCode}
          </span>
        )}
        {order.orderDate && (
          <span className="flex items-center gap-1">
            <Calendar size={9} /> {formatDate(order.orderDate)}
          </span>
        )}
        <StatusBadge map={PAYMENT_LABELS} value={order.paymentStatus} />
        <StatusBadge map={FULFILLMENT_LABELS} value={order.fulfillmentStatus} />
        {!order.reviewedAt && (
          <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            بررسی نشده
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {(order.items || []).map((item, i) => (
          <div key={i} className="py-3 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
              {item.product?.mainImage ? (
                <img
                  src={item.product.mainImage}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package size={16} className="m-auto mt-3 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">
                {item.product?.name || "محصول"}
              </p>
              {item.variant?.sku && (
                <p className="text-[10px] text-gray-400 font-mono">{item.variant.sku}</p>
              )}
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.quantity} عدد × {(item.price || 0).toLocaleString("fa-IR")} تومان
              </p>
            </div>
            <p className="text-xs font-bold text-gray-800 flex-shrink-0">
              {((item.quantity || 1) * (item.price || 0)).toLocaleString("fa-IR")} تومان
            </p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        {order.discountedAmount > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>تخفیف:</span>
            <span className="text-green-600 font-bold">
              −{order.discountedAmount.toLocaleString("fa-IR")} تومان
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-gray-800">
          <span>جمع قابل پرداخت:</span>
          <span>{(order.finalPrice || order.totalPrice || 0).toLocaleString("fa-IR")} تومان</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function CoachCreditPage() {
  const router = useRouter();
  const params = useParams();
  const { coachId, orderId } = params;

  const [coach, setCoach] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { newBalance }

  useEffect(() => {
    if (!coachId || !orderId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/admin/coaches?id=${coachId}`).then((r) => r.json()),
      fetch(`/api/admin/orders/${orderId}`).then((r) => r.json()),
    ])
      .then(([coachData, orderData]) => {
        if (!coachData.coach) throw new Error(coachData.message || "مربی یافت نشد");
        if (!orderData.order) throw new Error(orderData.message || "سفارش یافت نشد");
        setCoach(coachData.coach);
        setOrder(orderData.order);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [coachId, orderId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, orderId }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "خطا در افزودن کردیت");

      setSuccess({ newBalance: data.newBalance, added: num });
      setCoach((prev) => ({ ...prev, walletBalance: data.newBalance }));
      setAmount("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLoader />;

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 text-sm" dir="rtl">
        <AlertCircle size={28} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/p-admin/users/coaches/${coachId}`)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowRight size={14} />
          بازگشت به صفحه مربی
        </button>
        <span className="text-slate-300">/</span>
        <h1 className="text-sm font-bold text-slate-800">افزودن کردیت</h1>
      </div>

      {/* Coach Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <GraduationCap size={14} className="text-[var(--color-primary)]" />
              <h2 className="text-sm font-bold text-slate-800">{coach.name}</h2>
              {coach.coachCode && (
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  {coach.coachCode}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-left">
            <p className="text-[10px] text-slate-500 flex items-center gap-1 justify-end mb-0.5">
              <Wallet size={10} /> موجودی فعلی
            </p>
            <p className="text-base font-bold text-emerald-600">
              {(coach.walletBalance || 0).toLocaleString("fa-IR")} تومان
            </p>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <OrderSummary order={order} />

      {/* Credit Form */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <CreditCard size={14} className="text-[#aa4725]" />
          افزودن کردیت به کیف پول مربی
        </h3>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle size={36} className="text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-emerald-700">
                {success.added.toLocaleString("fa-IR")} تومان با موفقیت افزوده شد
              </p>
              <p className="text-xs text-slate-500 mt-1">
                موجودی جدید کیف پول:{" "}
                <span className="font-bold text-emerald-600">
                  {(success.newBalance || 0).toLocaleString("fa-IR")} تومان
                </span>
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSuccess(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                افزودن کردیت جدید
              </button>
              <button
                onClick={() => router.push(`/p-admin/users/coaches/${coachId}`)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#aa4725] text-white hover:bg-[#8f3b1e] transition-colors"
              >
                بازگشت به صفحه مربی
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">
                مبلغ کردیت (تومان)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: ۵۰۰۰۰۰"
                min="1"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725] transition-colors"
              />
              {amount && Number(amount) > 0 && (
                <p className="text-[10px] text-slate-400">
                  معادل: {Number(amount).toLocaleString("fa-IR")} تومان
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !amount || Number(amount) <= 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#aa4725] text-white text-sm font-bold rounded-xl hover:bg-[#8f3b1e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  در حال پردازش...
                </>
              ) : (
                <>
                  <Wallet size={15} />
                  افزودن کردیت به کیف پول
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
