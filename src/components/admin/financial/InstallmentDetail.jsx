"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Loader2, User, Phone, Hash, Calendar, ExternalLink,
  Euro, X, Package,
} from "lucide-react";
import InstallmentChecksPanel from "./InstallmentChecksPanel";

const fa = (n) => new Intl.NumberFormat("fa-IR").format(Number(n ?? 0));
const faDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(d))
    : "—";

const STATUS = {
  PENDING: { label: "در انتظار تأیید", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  ACTIVE: { label: "در حال پرداخت", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  OVERDUE: { label: "سررسید گذشته", cls: "bg-red-50 text-red-600 border-red-200" },
  COMPLETED: { label: "تکمیل شده", cls: "bg-green-50 text-green-600 border-green-200" },
  DEFAULTED: { label: "چک برگشتی", cls: "bg-red-50 text-red-600 border-red-200" },
};

function Lightbox({ url, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <button className="absolute top-5 left-5 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white"><X size={18} /></button>
      <img src={url} alt="رسید" className="max-w-2xl w-full rounded-2xl shadow-2xl object-contain max-h-[85vh]" onClick={(e) => e.stopPropagation()} />
    </motion.div>
  );
}

export default function InstallmentDetail({ id }) {
  const [inst, setInst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/installments/${id}`);
        const data = await res.json();
        if (active && res.ok) setInst(data.installment);
      } catch {
        /* silent */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, reloadKey]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#aa4725]" /></div>;
  }
  if (!inst) {
    return (
      <div dir="rtl" className="text-center py-20 text-gray-400">
        طرح اقساط یافت نشد.
        <div className="mt-3"><Link href="/p-admin/financial/installments" className="text-[#aa4725] font-bold text-sm">بازگشت به فهرست</Link></div>
      </div>
    );
  }

  const st = STATUS[inst.derivedStatus] || STATUS.PENDING;

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/p-admin/financial/installments" className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-[#aa4725] transition">
          <ArrowRight size={16} /> فهرست اقساط
        </Link>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
      </div>

      {/* Customer + order card */}
      <div className="bg-white rounded-xl border border-[var(--admin-border)] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-gray-400">مشتری</p>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800"><User size={14} className="text-gray-400" /> {inst.customer.name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500"><Phone size={13} className="text-gray-400" /> {inst.customer.phone || "—"}</div>
          {inst.customer.email && <div className="text-xs text-gray-400 truncate">{inst.customer.email}</div>}
        </div>
        <div className="space-y-2 sm:border-r sm:border-gray-100 sm:pr-4">
          <p className="text-[11px] font-bold text-gray-400">سفارش</p>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 font-mono"><Hash size={14} className="text-gray-400" /> {inst.order.trackingCode}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500"><Calendar size={13} className="text-gray-400" /> {faDate(inst.order.orderDate)}</div>
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <Link href={`/p-admin/admin-orders/${inst.order._id}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#aa4725] bg-[#aa4725]/10 rounded-lg px-2.5 py-1.5 hover:bg-[#aa4725]/20 transition">
              <Package size={12} /> مشاهده سفارش <ExternalLink size={10} />
            </Link>
            {inst.order.priceEUR != null && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5">
                <Euro size={12} /> {new Intl.NumberFormat("en-US").format(inst.order.priceEUR)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Checks panel */}
      <InstallmentChecksPanel
        installment={inst}
        orderFulfillmentStatus={inst.order.fulfillmentStatus}
        onChanged={reload}
        onViewImage={setLightbox}
      />

      <AnimatePresence>{lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}</AnimatePresence>
    </div>
  );
}
