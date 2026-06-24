"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Upload, StickyNote,
  Loader2, X, BadgeCheck, Image as ImageIcon, ExternalLink, ShieldCheck,
} from "lucide-react";

const fa = (n) => new Intl.NumberFormat("fa-IR").format(Number(n ?? 0));
const faDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(d))
    : "—";

const CHECK_STATUS = {
  PENDING: { label: "در انتظار", cls: "bg-amber-50 text-amber-600 border-amber-200", icon: Clock },
  OVERDUE: { label: "سررسید گذشته", cls: "bg-red-50 text-red-600 border-red-200", icon: AlertTriangle },
  CLEARED: { label: "پاس شده", cls: "bg-green-50 text-green-600 border-green-200", icon: CheckCircle },
  BOUNCED: { label: "برگشت خورده", cls: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
};

/* ─── Confirm "mark cleared" modal ─── */
function MarkClearedModal({ check, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  return (
    <Modal onClose={onClose} title="تأیید پاس‌شدن چک" icon={BadgeCheck}>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
        با تأیید، این چک «پاس‌شده» ثبت می‌شود. این عملِ مالی قابل بازگشت نیست.
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Cell label="شماره قسط" value={`قسط ${fa(check.number)}`} />
        <Cell label="مبلغ" value={`${fa(check.amount)} تومان`} />
        <Cell label="سررسید" value={faDate(check.dueDate)} />
        <Cell label="شماره چک" value={check.checkNumber || "—"} />
      </div>
      <div className="flex gap-3 pt-1">
        <button
          disabled={loading}
          onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
          تأیید پاس‌شدن
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition">انصراف</button>
      </div>
    </Modal>
  );
}

/* ─── Bounce modal (reason required) ─── */
function BounceModal({ check, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Modal onClose={onClose} title="ثبت برگشت چک" icon={XCircle} accent="#ef4444">
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
        قسط {fa(check.number)} به مبلغ {fa(check.amount)} تومان به‌عنوان «برگشت‌خورده» ثبت می‌شود.
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">دلیل برگشت <span className="text-red-500">*</span></label>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder="مثلاً: کسر موجودی"
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition"
        />
      </div>
      <div className="flex gap-3">
        <button
          disabled={loading || !reason.trim()}
          onClick={async () => { setLoading(true); await onConfirm(reason.trim()); setLoading(false); }}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
          ثبت برگشت
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition">انصراف</button>
      </div>
    </Modal>
  );
}

/* ─── Notes modal ─── */
function NotesModal({ check, onConfirm, onClose }) {
  const [notes, setNotes] = useState(check.notes || "");
  const [loading, setLoading] = useState(false);
  return (
    <Modal onClose={onClose} title="یادداشت قسط" icon={StickyNote}>
      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
        placeholder="یادداشت داخلی برای این قسط..."
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725] transition"
      />
      <div className="flex gap-3">
        <button
          disabled={loading}
          onClick={async () => { setLoading(true); await onConfirm(notes); setLoading(false); }}
          className="flex-1 bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <StickyNote size={15} />}
          ذخیره یادداشت
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition">انصراف</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title, icon: Icon, accent = "#aa4725" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 18, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.92, y: 18, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: accent }}>
          <div className="flex items-center gap-2 text-white">
            <Icon size={17} /><span className="font-bold text-sm">{title}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function Cell({ label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-bold text-gray-700">{value}</p>
    </div>
  );
}

/* ─── Main panel ─── */
export default function InstallmentChecksPanel({ installment, orderFulfillmentStatus, onChanged, onViewImage }) {
  const [modal, setModal] = useState(null); // {type, check}
  const [busyCheck, setBusyCheck] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const fileRefs = useRef({});

  const id = installment._id;
  const fulfillment = orderFulfillmentStatus || installment.order?.fulfillmentStatus;
  const downPaid = installment.downPayment?.paid;
  const alreadyConfirmed = !!installment.orderConfirmedAt;
  const canConfirm = downPaid && !alreadyConfirmed && fulfillment !== "CANCELED";

  const patchCheck = async (checkId, payload, successMsg) => {
    setBusyCheck(checkId);
    try {
      const res = await fetch(`/api/installments/checks/${checkId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا در بروزرسانی");
      toast.success(successMsg || "بروزرسانی شد");
      setModal(null);
      onChanged?.();
    } catch (e) {
      toast.error(e.message || "خطا در بروزرسانی");
    } finally {
      setBusyCheck(null);
    }
  };

  const uploadReceipt = async (check, file) => {
    if (!file) return;
    setBusyCheck(check._id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "checks");
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "خطا در آپلود تصویر");
      await patchCheck(check._id, { receiptImageUrl: upData.url }, "تصویر چک بارگذاری شد");
    } catch (e) {
      toast.error(e.message || "خطا در آپلود تصویر");
      setBusyCheck(null);
    }
  };

  const confirmOrder = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/installments/${id}/confirm-order`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا در تأیید سفارش");
      toast.success(data.message || "سفارش تأیید شد");
      onChanged?.();
    } catch (e) {
      toast.error(e.message || "خطا در تأیید سفارش");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Cell label="مبلغ کل سفارش" value={`${fa(installment.totalAmount)} تومان`} />
        <Cell label="پیش‌پرداخت" value={`${fa(installment.downPayment?.amount)} ${installment.downPayment?.paid ? "✓" : "(در انتظار)"}`} />
        <Cell label="پرداخت‌شده" value={`${fa(installment.paidAmount)} تومان`} />
        <Cell label="مانده چک‌ها" value={`${fa(installment.remainingAmount)} تومان`} />
      </div>

      {/* Confirm order gate */}
      <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between
        ${alreadyConfirmed ? "bg-green-50 border-green-200" : "bg-[#0d0d0d] border-transparent"}`}>
        <div className={`flex items-center gap-2.5 ${alreadyConfirmed ? "text-green-700" : "text-white"}`}>
          <ShieldCheck size={20} className={alreadyConfirmed ? "text-green-600" : "text-[#ffbf00]"} />
          <div>
            <p className="text-sm font-bold">
              {alreadyConfirmed ? "سفارش تأیید شده است" : "تأیید سفارش پس از بازبینی چک‌ها"}
            </p>
            <p className={`text-[11px] ${alreadyConfirmed ? "text-green-600" : "text-white/50"}`}>
              {alreadyConfirmed
                ? `تأیید شده در ${faDate(installment.orderConfirmedAt)} — سفارش وارد مرحله پردازش شد`
                : downPaid
                  ? "پیش‌پرداخت تأیید شده؛ پس از بررسی چک‌ها سفارش را تأیید کنید."
                  : "ابتدا رسید پیش‌پرداخت را در بخش پرداخت‌ها تأیید کنید."}
            </p>
          </div>
        </div>
        {!alreadyConfirmed && (
          <button
            onClick={confirmOrder}
            disabled={!canConfirm || confirming}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition flex-shrink-0
              bg-[#ffbf00] text-[#1a1a1a] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirming ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
            تأیید سفارش
          </button>
        )}
      </div>

      {/* Checks */}
      <div className="space-y-2.5">
        {installment.checks.map((c) => {
          const cs = CHECK_STATUS[c.displayStatus] || CHECK_STATUS.PENDING;
          const Icon = cs.icon;
          const locked = c.status === "CLEARED";
          const busy = busyCheck === c._id;
          return (
            <div key={c._id} className="bg-white rounded-xl border border-[var(--admin-border)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${cs.cls}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">قسط {fa(c.number)}</p>
                    <p className="text-[11px] text-gray-400">سررسید {faDate(c.dueDate)}{c.checkNumber ? ` · چک ${c.checkNumber}` : ""}</p>
                  </div>
                </div>
                <div className="text-left flex-shrink-0">
                  <p className="text-sm font-black text-gray-800">{fa(c.amount)}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cs.cls}`}>{cs.label}</span>
                </div>
              </div>

              {c.bounceReason && (
                <p className="mt-2 text-[11px] text-red-500">دلیل برگشت: {c.bounceReason}</p>
              )}
              {c.notes && (
                <p className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                  <StickyNote size={11} className="inline ml-1 -mt-0.5" />{c.notes}
                </p>
              )}

              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {c.receiptImageUrl && (
                  <button onClick={() => onViewImage?.(c.receiptImageUrl)}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#aa4725] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 transition">
                    <ImageIcon size={12} /> تصویر چک <ExternalLink size={10} />
                  </button>
                )}

                {!locked && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => setModal({ type: "clear", check: c })}
                      className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-100 transition disabled:opacity-50">
                      <CheckCircle size={12} /> پاس شد
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setModal({ type: "bounce", check: c })}
                      className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition disabled:opacity-50">
                      <XCircle size={12} /> برگشت
                    </button>
                  </>
                )}

                <button
                  disabled={busy}
                  onClick={() => fileRefs.current[c._id]?.click()}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition disabled:opacity-50">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {c.receiptImageUrl ? "تغییر تصویر" : "آپلود چک"}
                </button>
                <input
                  ref={(el) => (fileRefs.current[c._id] = el)}
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadReceipt(c, f); }}
                />

                <button
                  disabled={busy}
                  onClick={() => setModal({ type: "notes", check: c })}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition disabled:opacity-50">
                  <StickyNote size={12} /> یادداشت
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {modal?.type === "clear" && (
          <MarkClearedModal
            check={modal.check}
            onClose={() => setModal(null)}
            onConfirm={() => patchCheck(modal.check._id, { status: "CLEARED" }, "چک پاس‌شده ثبت شد")}
          />
        )}
        {modal?.type === "bounce" && (
          <BounceModal
            check={modal.check}
            onClose={() => setModal(null)}
            onConfirm={(reason) => patchCheck(modal.check._id, { status: "BOUNCED", bounceReason: reason }, "برگشت چک ثبت شد")}
          />
        )}
        {modal?.type === "notes" && (
          <NotesModal
            check={modal.check}
            onClose={() => setModal(null)}
            onConfirm={(notes) => patchCheck(modal.check._id, { notes }, "یادداشت ذخیره شد")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
