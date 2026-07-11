"use client";

import AdminInput from "@/components/admin/AdminInput";
import { getUserFullName } from "base/utils/userName";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import {
  ShoppingCart, ChevronRight, Eye, CheckCircle, XCircle,
  Clock, Package, Truck, Home, AlertCircle, RefreshCw,
  Receipt, CreditCard, Users, BadgeCheck, X, Image as ImageIcon,
  Edit3, Save, DollarSign, Ban, Loader2, ReceiptText,
  ExternalLink, MapPin, Phone, Mail, Hash, Calendar, Tag,
  ArrowLeft, Scan, QrCode, Barcode, CheckSquare, Square,
  ShoppingBag, Warehouse, Plus, Trash2, AlertTriangle,
  ChevronDown, ChevronUp, GraduationCap, Euro, Wallet,
  Search, Minus, Pencil,
} from "lucide-react";
import OrderFlowSelectionsView from "@/components/order/OrderFlowSelectionsView";
import VariantSummary from "@/components/order/VariantSummary";
import InstallmentChecksPanel from "@/components/admin/financial/InstallmentChecksPanel";

/* ─── Constants ─────────────────────────────────────────────────────── */

const PAYMENT_STATUS = {
  UNPAID: { label: "پرداخت نشده", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500", icon: XCircle },
  PARTIALLY_PAID: { label: "پرداخت ناقص", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500", icon: Clock },
  PAID: { label: "پرداخت کامل", color: "bg-green-50 text-green-600 border-green-200", dot: "bg-green-500", icon: CheckCircle },
};

const FULFILLMENT_STATUS = {
  WAITING: { label: "در انتظار", color: "bg-gray-50 text-gray-500 border-gray-200", dot: "bg-gray-400", icon: Clock },
  NEEDS_PURCHASE: { label: "باید خریداری شود", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500", icon: ShoppingBag },
  PROCESSING: { label: "در حال پردازش", color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500", icon: Package },
  SENT: { label: "ارسال شده", color: "bg-purple-50 text-purple-600 border-purple-200", dot: "bg-purple-500", icon: Truck },
  DELIVERED: { label: "تحویل داده شد", color: "bg-teal-50 text-teal-600 border-teal-200", dot: "bg-teal-500", icon: Home },
  CANCELED: { label: "لغو شده", color: "bg-red-50 text-red-500 border-red-200", dot: "bg-red-400", icon: Ban },
};

const PAYMENT_METHOD = {
  ONLINE: { label: "پرداخت آنلاین", icon: CreditCard },
  BANK_RECEIPT: { label: "رسید بانکی", icon: Receipt },
  INSTALLMENT: { label: "اقساطی", icon: Calendar },
};

const RECEIPT_STATUS = {
  PENDING: { label: "در انتظار بررسی", color: "bg-amber-50 text-amber-600 border-amber-200" },
  APPROVED: { label: "تأیید شده", color: "bg-green-50 text-green-600 border-green-200" },
  REJECTED: { label: "رد شده", color: "bg-red-50 text-red-600 border-red-200" },
};

const TRACKING_STATUS_LABELS = {
  FR_WAREHOUSE: "انبار فرانسه",
  READY_TO_SHIP: "آماده ارسال",
  IN_TRANSIT: "در راه",
  CUSTOMS_HOLD: "گمرک",
  IR_WAREHOUSE: "انبار ایران",
  SOLD: "فروخته شده",
  DELIVERED: "تحویل داده شده",
  RETURNED: "مرجوعی",
};

function readAdminThemeColor(token, fallback) {
  if (typeof document === "undefined") return fallback;
  const scope = document.querySelector(".admin-scope") || document.documentElement;
  return getComputedStyle(scope).getPropertyValue(token).trim() || fallback;
}

function getSwalTheme() {
  return {
    confirmButtonColor: readAdminThemeColor("--color-primary", "#004225"),
    cancelButtonColor: "#9ca3af",
    customClass: {
      popup: "rounded-2xl font-[Vazirmatn] text-right",
      confirmButton: "rounded-[6px] font-bold",
      cancelButton: "rounded-[6px] font-bold",
    },
    rtl: true,
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatPrice(v) {
  return new Intl.NumberFormat("fa-IR").format(Number(v ?? 0));
}

// قالب‌بندی مبلغ یورو — جدا از تومان، با ارقام لاتین و حداکثر دو رقم اعشار
function formatEUR(v) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(v ?? 0));
}

function toFarsiDate(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(new Date(dateStr));
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatusBadge({ config, size = "sm" }) {
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold border rounded-full
      ${size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}
      ${config.color}`}>
      {Icon && <Icon size={size === "xs" ? 9 : 11} />}
      {config.label}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon size={12} className="text-gray-400 flex-shrink-0" />
      <span className="text-gray-400 w-14 flex-shrink-0">{label}:</span>
      <span className="font-semibold text-gray-700 truncate">{value}</span>
    </div>
  );
}

/* ─── Receipt Lightbox ──────────────────────────────────────────────── */
function ReceiptLightbox({ url, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute -top-10 left-0 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition">
          <X size={16} />
        </button>
        <img src={url} alt="تصویر رسید" className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
      </motion.div>
    </motion.div>
  );
}

/* ─── Approve Payment Modal ─────────────────────────────────────────── */
function ApproveModal({ payment, orderTotal, onConfirm, onClose }) {
  const [amount, setAmount] = useState(String(payment.amount || ""));
  // مبلغ یورو — اختیاری و کاملاً مستقل از تومان
  const [eurAmount, setEurAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const handleSubmit = async () => {
    // فقط مبلغ تومان الزامی است
    const parsed = Number(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) { toast.error("مبلغ تومان معتبر وارد کنید"); return; }

    // مبلغ یورو اختیاری است؛ اگر خالی بود نادیده گرفته می‌شود (بدون اعتبارسنجی مسدودکننده).
    const eurRaw = String(eurAmount).replace(/,/g, "").trim();
    const eurParsed = eurRaw === "" ? null : Number(eurRaw);
    const eurToSend =
      eurParsed !== null && !isNaN(eurParsed) && eurParsed > 0 ? eurParsed : null;

    setLoading(true);
    await onConfirm(parsed, eurToSend);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        dir="rtl" onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--color-primary)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <BadgeCheck size={18} />
            <span className="font-bold text-sm">تأیید پرداخت رسید بانکی</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertCircle size={12} /><span>مبلغ درج‌شده توسط کاربر</span>
            </div>
            <p>مبلغ اعلامی کاربر: <strong>{formatPrice(payment.amount)} تومان</strong></p>
            <p className="mt-0.5">مبلغ کل سفارش: <strong>{formatPrice(orderTotal)} تومان</strong></p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              مبلغ تأیید شده (تومان) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AdminInput
                ref={inputRef} type="number" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="مبلغ را به تومان وارد کنید"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">تومان</span>
            </div>
          </div>

          {/* ─── مبلغ یورو (اختیاری) — مستقل از تومان ─── */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
              <Euro size={13} className="text-[var(--color-primary)]" />
              مبلغ یورو
              <span className="text-[10px] font-medium text-gray-400">(اختیاری)</span>
            </label>
            <div className="relative">
              <AdminInput
                type="number" step="any" min="0" value={eurAmount}
                onChange={(e) => setEurAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="در صورت پرداخت یورویی، مبلغ را وارد کنید"
                dir="ltr"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 text-left
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
              این مبلغ مستقل از تومان است و فقط مانده و تاریخچه‌ی یورو را بروزرسانی می‌کند.
              خالی بگذارید تا فقط پرداخت تومانی ثبت شود.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 rounded-xl text-sm
                transition flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
              تأیید پرداخت
            </button>
            <button onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition">
              انصراف
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Edit Payment Modal (تومان و یورو) ─────────────────────────────── */
// تأییدِ ویرایش مبلغ پرداخت با نمایش «مبلغ قبلی → مبلغ جدید».
// currency: "toman" | "eur"
function EditPaymentModal({ payment, currency, onConfirm, onClose }) {
  const isEUR = currency === "eur";
  const fmt = isEUR ? formatEUR : formatPrice;
  const unit = isEUR ? "€" : "تومان";
  const [value, setValue] = useState(String(payment.amount ?? ""));
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const parsed = Number(String(value).replace(/,/g, ""));
  const valid = !isNaN(parsed) && parsed > 0;
  const changed = valid && Math.round(parsed) !== Math.round(Number(payment.amount) || 0);
  const diff = valid ? parsed - (Number(payment.amount) || 0) : 0;

  const handleSubmit = async () => {
    if (!valid) { toast.error(`مبلغ ${isEUR ? "یورو" : "تومان"} معتبر وارد کنید`); return; }
    setLoading(true);
    await onConfirm(parsed);
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[260] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        dir="rtl" onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--color-primary)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Pencil size={16} />
            <span className="font-bold text-sm">ویرایش مبلغ پرداخت {isEUR ? "(یورو)" : "(تومان)"}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertCircle size={12} /><span>ویرایش سابقه‌ی مالی</span>
            </div>
            <p>این تغییر فقط مانده و وضعیت {isEUR ? "یورو" : "تومان"} را بروزرسانی می‌کند و در تاریخچه‌ی ممیزی ثبت می‌شود.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              مبلغ جدید ({unit}) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AdminInput
                ref={inputRef} type="number" step={isEUR ? "any" : "1"} min="0" value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                dir="ltr"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 text-left
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
            </div>
          </div>

          {/* قبلی → جدید */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-xs">
            <div className="text-center flex-1">
              <p className="text-gray-400 mb-0.5">مبلغ قبلی</p>
              <p className="font-black text-gray-600" dir="ltr">{isEUR ? "€ " : ""}{fmt(payment.amount)}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 rotate-180" />
            <div className="text-center flex-1">
              <p className="text-gray-400 mb-0.5">مبلغ جدید</p>
              <p className={`font-black ${changed ? "text-[var(--color-primary)]" : "text-gray-600"}`} dir="ltr">
                {valid ? <>{isEUR ? "€ " : ""}{fmt(parsed)}</> : "—"}
              </p>
            </div>
          </div>
          {changed && (
            <p className={`text-[11px] font-bold text-center ${diff > 0 ? "text-blue-600" : "text-amber-600"}`} dir="ltr">
              {diff > 0 ? "▲ +" : "▼ "}{isEUR ? "€ " : ""}{fmt(Math.abs(diff))}{!isEUR ? " تومان" : ""}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={loading || !valid}
              className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 rounded-xl text-sm
                transition flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              ذخیره تغییر
            </button>
            <button onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition">
              انصراف
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Add Item Modal ────────────────────────────────────────────────── */
// جستجوی محصول (همان API بخش تخفیف‌ها) → انتخاب واریانت (در صورت وجود) → تعداد.
// قیمت در سرور و از همان مسیر priceEngine ثبت می‌شود؛ اینجا فقط انتخاب انجام می‌شود.
function AddItemModal({ orderId, onSuccess, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [product, setProduct] = useState(null);     // {_id, label, image}
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantId, setVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (!q?.trim()) { setResults([]); setOpenList(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/discounts/search?type=product&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.items || []);
      setOpenList(true);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleQuery = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); setOpenList(false); return; }
    timer.current = setTimeout(() => runSearch(val), 300);
  };

  const selectProduct = async (item) => {
    setProduct(item);
    setOpenList(false);
    setQuery("");
    setResults([]);
    setVariantId(null);
    setVariants([]);
    setLoadingVariants(true);
    try {
      const res = await fetch(`/api/admin/discounts/search?type=variant&productId=${item._id}`);
      const data = await res.json();
      setVariants(data.items || []);
    } catch { toast.error("خطا در دریافت واریانت‌ها"); }
    finally { setLoadingVariants(false); }
  };

  const resetProduct = () => {
    setProduct(null);
    setVariants([]);
    setVariantId(null);
    setQuantity(1);
  };

  const needsVariant = variants.length > 0;
  const canSubmit = product && (!needsVariant || variantId) && quantity >= 1 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (needsVariant && !variantId) toast.error("لطفاً یک واریانت انتخاب کنید");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product._id,
          variantId: variantId || null,
          quantity: Math.max(1, Math.floor(quantity)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا در افزودن آیتم");
      toast.success(data.message || "آیتم افزوده شد");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || "خطا در افزودن آیتم");
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[260] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        dir="rtl" onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--color-primary)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Plus size={18} />
            <span className="font-bold text-sm">افزودن آیتم به سفارش</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!product ? (
            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-2">جستجوی محصول</label>
              <div className="relative">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={query} autoComplete="off"
                  onChange={(e) => handleQuery(e.target.value)}
                  onFocus={() => query && results.length && setOpenList(true)}
                  placeholder="نام محصول را تایپ کنید..."
                  className="w-full border border-gray-300 rounded-xl pr-9 pl-3 py-2.5 text-sm font-bold text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
                />
                {searching && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">جستجو...</span>}
              </div>
              {openList && (
                <ul className="mt-2 bg-white border border-gray-200 rounded-xl shadow-sm
                  min-h-[4rem] max-h-[18rem] overflow-y-auto">
                  {results.length === 0
                    ? <li className="px-4 py-6 text-sm text-gray-400 text-center">محصولی یافت نشد</li>
                    : results.map((item) => (
                      <li key={String(item._id)} onMouseDown={() => selectProduct(item)}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50 last:border-none">
                        {item.image
                          ? <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />}
                        <div className="text-right min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{item.label}</p>
                          {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* محصول انتخاب‌شده */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                {product.image
                  ? <img src={product.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                  : <div className="w-12 h-12 rounded-xl bg-gray-100" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{product.label}</p>
                  <p className="text-xs text-gray-400">{product.sub || ""}</p>
                </div>
                <button onClick={resetProduct} className="text-xs text-gray-400 hover:text-gray-600 font-bold">× تغییر</button>
              </div>

              {/* واریانت‌ها */}
              {loadingVariants ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400">
                  <Loader2 size={15} className="animate-spin text-[var(--color-primary)]" /> بارگذاری واریانت‌ها...
                </div>
              ) : needsVariant ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500">انتخاب واریانت <span className="text-red-500">*</span></label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {variants.map((v) => {
                      const selected = variantId === String(v._id);
                      return (
                        <label key={String(v._id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition border
                            ${selected ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30" : "bg-white border-gray-100 hover:border-[var(--color-primary)]/30"}`}>
                          <input type="radio" name="variant" checked={selected}
                            onChange={() => setVariantId(String(v._id))} className="accent-[var(--color-primary)]" />
                          <div className="text-right flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{v.label}</p>
                            {v.sub && <p className="text-[10px] text-gray-400 truncate">{v.sub}</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  این محصول واریانت ندارد؛ قیمت پایه‌ی محصول ثبت می‌شود.
                </p>
              )}

              {/* تعداد */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">تعداد</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition">
                    <Minus size={14} />
                  </button>
                  <input type="number" min="1" value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="w-16 text-center border border-gray-300 rounded-xl py-2 text-sm font-black text-gray-800
                      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
                  <button onClick={() => setQuantity((q) => q + 1)}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed bg-[color:var(--color-primary)]/5 border border-[color:var(--color-primary)]/15 rounded-xl px-3 py-2">
                قیمت این آیتم سمت سرور و دقیقاً از همان موتور قیمت‌گذاری سفارش (شامل تخفیف‌های فعال) محاسبه و به‌صورت اسنپ‌شات ثبت می‌شود.
              </p>

              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 rounded-xl text-sm
                  transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                افزودن به سفارش
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Barcode Scanner Component ─────────────────────────────────────── */
function BarcodeScanner({ onScan, onClose }) {
  const [phase, setPhase] = useState("idle");
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const inputRef = useRef(null);

  const handleScanResult = useCallback((code) => {
    const trimmed = code.trim();
    if (!trimmed || processingRef.current) return;
    processingRef.current = true;
    stopScanner();
    onScan(trimmed);
    onClose();
  }, [onScan, onClose]);

  const startScanner = async () => {
    setPhase("starting");
    setCameraError("");
    processingRef.current = false;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const el = document.getElementById("order-qr-reader");
      if (el) el.innerHTML = "";
      const scanner = new Html5Qrcode("order-qr-reader");
      scannerRef.current = scanner;
      const devices = await Html5Qrcode.getCameras();
      if (!devices?.length) throw new Error("دوربینی یافت نشد");
      const back = devices.find((d) => /back|rear|environment/i.test(d.label));
      await scanner.start(
        back ? back.id : devices[0].id,
        { fps: 15, qrbox: { width: 240, height: 140 }, aspectRatio: 1.6 },
        (decoded) => { if (!processingRef.current) handleScanResult(decoded); },
        () => { }
      );
      setPhase("scanning");
    } catch (err) {
      setCameraError(err.message || "خطا در باز کردن دوربین");
      setPhase("error");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch { }
      scannerRef.current = null;
    }
    processingRef.current = false;
    setPhase("idle");
  };

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
    return () => { stopScanner(); };
  }, []);

  const handleManual = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopScanner();
    onScan(manualCode.trim());
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Manual Input */}
      <form onSubmit={handleManual} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="کد رهگیری یا بارکد را وارد کنید..."
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
          dir="ltr"
        />
        <button type="submit"
          className="bg-[var(--color-primary)] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-[var(--color-primary-hover)] transition">
          تأیید
        </button>
      </form>

      {/* Camera Scanner */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        {phase === "idle" && (
          <button onClick={startScanner}
            className="w-full flex items-center justify-center gap-2 py-4 text-sm font-bold text-gray-600
              hover:bg-gray-50 transition">
            <QrCode size={18} className="text-[var(--color-primary)]" />
            اسکن با دوربین
          </button>
        )}
        {phase === "starting" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
            در حال راه‌اندازی دوربین...
          </div>
        )}
        {(phase === "scanning" || phase === "starting") && (
          <div>
            <div id="order-qr-reader" className="w-full" />
            {phase === "scanning" && (
              <button onClick={stopScanner}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold
                  text-gray-500 hover:text-red-500 border-t border-gray-100 transition">
                <X size={13} /> توقف اسکن
              </button>
            )}
          </div>
        )}
        {phase === "error" && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
              <AlertTriangle size={13} /> {cameraError}
            </p>
            <button onClick={() => { setCameraError(""); setPhase("idle"); }}
              className="text-xs text-[var(--color-primary)] font-bold hover:underline">
              تلاش مجدد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Procurement Choice Modal ───────────────────────────────────────── */
function ProcurementModal({ item, onConfirm, onClose }) {
  const [choice, setChoice] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        dir="rtl" onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--admin-sidebar-bg)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Package size={16} />
            <span className="font-bold text-sm">وضعیت تأمین محصول</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            {item.product?.mainImage && (
              <img src={item.product.mainImage} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
            )}
            <div>
              <p className="text-sm font-bold text-gray-800">{item.product?.name}</p>
              <p className="text-xs text-gray-400">{item.product?.sku}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 font-bold text-center">
            این محصول را از چه طریقی تأمین می‌کنید؟
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setChoice("IN_STOCK")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-bold text-sm
                ${choice === "IN_STOCK"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-600 hover:border-green-300"}`}
            >
              <Warehouse size={22} className={choice === "IN_STOCK" ? "text-green-600" : "text-gray-400"} />
              موجود در انبار
            </button>
            <button
              onClick={() => setChoice("TO_PURCHASE")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-bold text-sm
                ${choice === "TO_PURCHASE"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
            >
              <ShoppingBag size={22} className={choice === "TO_PURCHASE" ? "text-amber-600" : "text-gray-400"} />
              باید خریداری شود
            </button>
          </div>

          <button
            onClick={() => choice && onConfirm(choice)}
            disabled={!choice}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-3 rounded-xl text-sm
              transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scan size={16} />
            تأیید و ادامه به اسکن بارکد
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Scan Modal (combined procurement + scan) ──────────────────────── */
// target: { productName, productImage, productSku, expectedProductId,
//           orderItemIndex, flowNodeId, quantity }
// mode: "choose" → ابتدا انتخاب وضعیت تأمین | "scan_purchased" → مستقیم اسکن بارکدِ خریداری‌شده
function ScanModal({ target, orderId, mode = "choose", onSuccess, onClose }) {
  const [step, setStep] = useState(mode === "scan_purchased" ? "scan" : "procurement");
  const [procurementStatus, setProcurementStatus] = useState(
    mode === "scan_purchased" ? "PURCHASED" : null
  );
  const [scanning, setScanning] = useState(false);
  const [marking, setMarking] = useState(false);
  const [scanResult, setScanResult] = useState(null); // null | {success, message, item}

  // علامت‌گذاری «باید خریداری شود» — بدون نیاز به بارکد
  const handleMarkToPurchase = async () => {
    setMarking(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_purchase",
          orderItemIndex: target.orderItemIndex,
          flowNodeId: target.flowNodeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "خطا در علامت‌گذاری");
        setMarking(false);
        return;
      }
      toast.success(data.message || "به عنوان «باید خریداری شود» علامت‌گذاری شد");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("خطا در اتصال به سرور");
      setMarking(false);
    }
  };

  const handleScan = async (code) => {
    setScanning(true);
    setScanResult(null);
    try {
      // اول lookup کن
      const lookupRes = await fetch(
        `/api/admin/orders/tracking-items/lookup?code=${encodeURIComponent(code)}`
      );
      const lookupData = await lookupRes.json();

      if (!lookupData.found) {
        setScanResult({ success: false, message: "آیتمی با این کد در سیستم ترکینگ یافت نشد" });
        setScanning(false);
        return;
      }

      // بررسی محصول
      if (lookupData.item.productRef?.toString() !== target.expectedProductId?.toString()) {
        setScanResult({
          success: false,
          message: "این بارکد متعلق به محصول دیگری است. بارکد محصول درست را اسکن کنید.",
        });
        setScanning(false);
        return;
      }

      // ثبت به سفارش
      const assignRes = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: code,
          orderItemIndex: target.orderItemIndex,
          flowNodeId: target.flowNodeId || null,
          procurementStatus: procurementStatus || "IN_STOCK",
        }),
      });
      const assignData = await assignRes.json();

      if (!assignRes.ok) {
        setScanResult({ success: false, message: assignData.message || "خطا در ثبت بارکد" });
        setScanning(false);
        return;
      }

      setScanResult({
        success: true,
        message: assignData.message,
        trackingId: lookupData.item.trackingId,
        barcode: lookupData.item.barcode,
        scannedCount: assignData.scannedCount,
        remainingCount: assignData.remainingCount,
      });

      onSuccess();
    } catch (err) {
      setScanResult({ success: false, message: "خطا در اتصال به سرور" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        dir="rtl" onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--admin-sidebar-bg)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === "procurement" ? (
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <Package size={15} className="text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <Scan size={15} className="text-white" />
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm">
                {step === "procurement" ? "وضعیت تأمین" : "اسکن بارکد"}
              </p>
              <p className="text-white/50 text-xs truncate max-w-[200px]">
                {target.productName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            {target.productImage && (
              <img src={target.productImage} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{target.productName}</p>
              {target.productSku && (
                <p className="text-xs text-gray-400 font-mono">{target.productSku}</p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">
                تعداد مورد نیاز: <strong>{target.quantity}</strong> عدد
              </p>
            </div>
          </div>

          {/* Step 1: Procurement choice */}
          {step === "procurement" && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-700">این محصول از چه طریقی تأمین می‌شود؟</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setProcurementStatus("IN_STOCK"); setStep("scan"); }}
                  disabled={marking}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                    hover:border-green-400 hover:bg-green-50 transition font-bold text-sm text-gray-600 hover:text-green-700
                    disabled:opacity-50"
                >
                  <Warehouse size={24} className="text-green-500" />
                  موجود در انبار
                  <span className="text-[10px] text-gray-400 font-normal">بارکد از انبار اسکن شود</span>
                </button>
                <button
                  onClick={handleMarkToPurchase}
                  disabled={marking}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                    hover:border-amber-400 hover:bg-amber-50 transition font-bold text-sm text-gray-600 hover:text-amber-700
                    disabled:opacity-50"
                >
                  {marking
                    ? <Loader2 size={24} className="animate-spin text-amber-500" />
                    : <ShoppingBag size={24} className="text-amber-500" />}
                  باید خریداری شود
                  <span className="text-[10px] text-gray-400 font-normal">وضعیت سفارش بروزرسانی می‌شود</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                با انتخاب «باید خریداری شود» این سفارش در لیست سفارش‌ها با وضعیت «باید خریداری شود»
                نشان داده می‌شود تا بعداً پس از خرید، بارکد آن اسکن شود.
              </p>
            </div>
          )}

          {/* Step 2: Scan */}
          {step === "scan" && (
            <div className="space-y-3">
              {/* Procurement status indicator */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold
                ${procurementStatus === "IN_STOCK"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                {procurementStatus === "IN_STOCK"
                  ? <><Warehouse size={13} /> موجود در انبار — بارکد را اسکن کنید</>
                  : <><ShoppingBag size={13} /> خریداری‌شده — بارکد محصول خریداری‌شده را اسکن کنید</>
                }
              </div>

              {scanning && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
                  در حال بررسی بارکد...
                </div>
              )}

              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center gap-2
                    ${scanResult.success
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"}`}
                >
                  {scanResult.success
                    ? <CheckCircle size={16} />
                    : <XCircle size={16} />}
                  <div>
                    <p>{scanResult.message}</p>
                    {scanResult.success && scanResult.trackingId && (
                      <p className="text-xs font-mono mt-0.5 text-green-600">
                        {scanResult.trackingId}
                      </p>
                    )}
                    {scanResult.success && scanResult.remainingCount > 0 && (
                      <p className="text-xs mt-0.5 text-green-600">
                        {scanResult.remainingCount} عدد دیگر باقی مانده
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {!scanning && (
                <BarcodeScanner
                  onScan={handleScan}
                  onClose={() => { }}
                />
              )}

              {mode === "choose" && (
                <button onClick={() => setStep("procurement")}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
                  <ChevronRight size={12} /> برگشت به انتخاب تأمین
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Payment Card ──────────────────────────────────────────────────── */
function PaymentCard({ payment, orderTotal, onViewReceipt, onApprove, onReject, onEdit }) {
  const isPending = payment.status === "PENDING";
  const isPaid = payment.status === "PAID";
  const isBankReceipt = payment.method === "BANK_RECEIPT";
  const receiptStatus = payment.bankReceipt?.reviewStatus;
  const receiptCfg = RECEIPT_STATUS[receiptStatus] || RECEIPT_STATUS.PENDING;

  // ─── چند عکس: هم imageUrls (آرایه جدید) هم imageUrl (تکی قدیمی) پشتیبانی می‌شه
  const images = payment.bankReceipt?.imageUrls?.length
    ? payment.bankReceipt.imageUrls
    : payment.bankReceipt?.imageUrl
      ? [payment.bankReceipt.imageUrl]
      : [];


  return (
    <div className={`rounded-xl border p-3.5 space-y-3 transition
      ${isPending && isBankReceipt
        ? "border-amber-300 bg-amber-50/50"
        : "border-gray-200 bg-gray-50/50"}`}
    >
      {/* ردیف اول: نوع پرداخت + مبلغ */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
            ${isPaid ? "bg-green-100" : isPending ? "bg-amber-100" : "bg-red-100"}`}>
            {payment.method === "ONLINE"
              ? <CreditCard size={14} className={isPaid ? "text-green-600" : "text-amber-600"} />
              : <Receipt size={14} className={isPaid ? "text-green-600" : isPending ? "text-amber-600" : "text-red-600"} />
            }
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700">
              {PAYMENT_METHOD[payment.method]?.label || payment.method}
            </p>
            <p className="text-[10px] text-gray-400">{toFarsiDate(payment.createdAt)}</p>
          </div>
        </div>

        <div className="text-left space-y-0.5">
          <div className="flex items-center gap-1.5">
            {onEdit && (
              <button onClick={onEdit} title="ویرایش مبلغ"
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400
                  hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition">
                <Pencil size={12} />
              </button>
            )}
            <p className="text-sm font-black text-gray-800">{formatPrice(payment.amount)}</p>
          </div>
          <p className="text-[10px] text-gray-400">تومان پرداخت شده</p>
          {payment.meta?.editedAt && (
            <p className="text-[9px] text-amber-500 font-medium">ویرایش‌شده</p>
          )}
        </div>
      </div>


      {/* ─── رسید بانکی ─── */}
      {isBankReceipt && (
        <div className="space-y-2">

          {/* وضعیت رسید */}
          {receiptStatus && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${receiptCfg.color}`}>
                {receiptCfg.label}
              </span>
              {payment.bankReceipt?.rejectReason && (
                <span className="text-[10px] text-red-500 truncate">
                  علت: {payment.bankReceipt.rejectReason}
                </span>
              )}
            </div>
          )}

          {/* ─── گالری تصاویر ─── */}
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
              {images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => onViewReceipt(url)}
                  className="group relative rounded-xl overflow-hidden border border-gray-200
                    hover:border-[var(--color-primary)] transition aspect-video bg-gray-100"
                >
                  <img
                    src={url}
                    alt={`رسید ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {/* overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                    <ExternalLink
                      size={18}
                      className="text-white opacity-0 group-hover:opacity-100 transition drop-shadow"
                    />
                  </div>
                  {/* شماره عکس */}
                  {images.length > 1 && (
                    <span className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] font-bold
                      px-1.5 py-0.5 rounded-full">
                      {idx + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* دکمه‌های تأیید/رد */}
          {isPending && (
            <div className="flex gap-2 pt-1">
              <button onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600
                  text-white text-xs font-bold py-2 rounded-xl transition">
                <BadgeCheck size={13} /> تأیید با ورود مبلغ
              </button>
              <button onClick={onReject}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100
                  text-red-600 text-xs font-bold py-2 rounded-xl border border-red-200 transition">
                <XCircle size={13} /> رد رسید
              </button>
            </div>
          )}

          {isPaid && payment.bankReceipt?.reviewedAt && (
            <p className="text-[10px] text-green-600 font-medium">
              تأیید شده در {toFarsiDate(payment.bankReceipt.reviewedAt)}
            </p>
          )}
        </div>
      )}

      {payment.method === "ONLINE" && payment.onlinePayment?.refId && (
        <p className="text-[10px] text-gray-400 font-mono">
          شماره پیگیری: {payment.onlinePayment.refId}
        </p>
      )}
    </div>
  );
}

/* ─── Tracking Item Badge ────────────────────────────────────────────── */
function TrackingItemBadge({ trackingItem, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 group">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold text-gray-700 truncate">
          {trackingItem.trackingId}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400 font-mono truncate">
            {trackingItem.barcode}
          </span>
          {trackingItem.procurementStatus && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
              ${trackingItem.procurementStatus === "IN_STOCK"
                ? "bg-green-50 text-green-600 border border-green-200"
                : trackingItem.procurementStatus === "TO_PURCHASE"
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-blue-50 text-blue-600 border border-blue-200"}`}>
              {trackingItem.procurementStatus === "IN_STOCK" ? "انبار"
                : trackingItem.procurementStatus === "TO_PURCHASE" ? "خرید"
                  : "خریداری شد"}
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {TRACKING_STATUS_LABELS[trackingItem.status] || trackingItem.status}
          </span>
        </div>
      </div>
      <button onClick={() => onRemove(trackingItem._id)}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center
          text-red-400 hover:text-red-600 transition rounded-lg hover:bg-red-50">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/* ─── Order Items Tracking Panel ─────────────────────────────────────── */
function TrackingPanel({ orderId, orderFulfillmentStatus, onStatusChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanModal, setScanModal] = useState(null); // {item, itemIndex}
  const [expanded, setExpanded] = useState({});

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`);
      const d = await res.json();
      if (res.ok) setData(d);
    } catch (err) {
      toast.error("خطا در دریافت اطلاعات ترکینگ");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchTracking(); }, [fetchTracking]);

  const handleRemoveTracking = async (trackingItemId) => {
    const result = await Swal.fire({
      ...getSwalTheme(),
      title: "حذف بارکد از سفارش",
      text: "آیا مطمئن هستید که می‌خواهید این بارکد را از سفارش جدا کنید؟",
      showCancelButton: true,
      confirmButtonText: "بله، جدا کن",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingItemId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      toast.success(d.message);
      fetchTracking();
    } catch (err) {
      toast.error(err.message || "خطا در حذف");
    }
  };

  // بلوک نمایش بارکدهای اسکن‌شده + دکمه افزودن، برای یک خط (اصلی یا انتخاب فرایند)
  // target: داده‌ی موردنیاز برای باز کردن ScanModal
  // procurementStatus: وضعیت تأمینِ این خط روی سفارش (TO_PURCHASE یعنی منتظر خرید)
  const renderTrackingBlock = ({
    trackingItems,
    scannedCount,
    quantity,
    remainingCount,
    procurementStatus,
    target,
    addLabel = "اسکن بارکد",
  }) => {
    const complete = scannedCount >= quantity;
    const isToPurchase = procurementStatus === "TO_PURCHASE";
    const remainText = new Intl.NumberFormat("fa-IR").format(remainingCount);
    return (
      <div className="space-y-2">
        {trackingItems.length > 0 && (
          <div className="space-y-2">
            {trackingItems.map((t) => (
              <TrackingItemBadge
                key={t._id}
                trackingItem={t}
                onRemove={handleRemoveTracking}
              />
            ))}
          </div>
        )}

        {/* خطی که «باید خریداری شود» علامت خورده و هنوز خریداری/اسکن نشده */}
        {!complete && isToPurchase && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50
              border border-amber-200 rounded-xl px-3 py-2">
              <ShoppingBag size={13} className="shrink-0" />
              باید خریداری شود — پس از خرید، بارکد را وارد/اسکن کنید
            </div>
            <button
              onClick={() => setScanModal({ ...target, mode: "scan_purchased" })}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold
                bg-amber-500 hover:bg-amber-600 text-white transition"
            >
              <Scan size={16} />
              خریداری شد — ثبت بارکد ({remainText} عدد باقی‌مانده)
            </button>
          </div>
        )}

        {!complete && !isToPurchase && (
          <button
            onClick={() => setScanModal({ ...target, mode: "choose" })}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed
              border-[var(--color-primary)]/40 hover:border-[var(--color-primary)] rounded-xl text-sm font-bold
              text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10 transition"
          >
            <Plus size={16} />
            {addLabel} ({remainText} عدد باقی‌مانده)
          </button>
        )}

        {complete && (
          <div className="flex items-center gap-2 text-xs text-green-600 font-bold">
            <CheckCircle size={13} />
            تمام {new Intl.NumberFormat("fa-IR").format(quantity)} عدد شناسایی شد
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
        در حال بارگذاری اطلاعات ترکینگ...
      </div>
    );
  }

  if (!data) return null;

  const allComplete = data.totalScanned >= data.totalRequired && data.totalRequired > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`rounded-2xl p-4 border ${allComplete
          ? "bg-green-50 border-green-200"
          : "bg-blue-50 border-blue-200"
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allComplete
              ? <CheckCircle size={18} className="text-green-600" />
              : <Scan size={18} className="text-blue-600" />}
            <div>
              <p className={`text-sm font-black ${allComplete ? "text-green-800" : "text-blue-800"}`}>
                {allComplete ? "همه محصولات شناسایی شدند" : "در حال شناسایی محصولات"}
              </p>
              <p className={`text-xs mt-0.5 ${allComplete ? "text-green-600" : "text-blue-600"}`}>
                {new Intl.NumberFormat("fa-IR").format(data.totalScanned)} از{" "}
                {new Intl.NumberFormat("fa-IR").format(data.totalRequired)} عدد اسکن شده
              </p>
            </div>
          </div>
          <button onClick={fetchTracking}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/70 hover:bg-white text-gray-500 transition">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 bg-white/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allComplete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${data.totalRequired > 0 ? Math.min(100, (data.totalScanned / data.totalRequired) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Per-item tracking */}
      {data.itemsWithTracking.map((item) => {
        const flowList = item.flowTracking || [];
        const mainRequired = item.isUsed ? 1 : item.quantity;
        const itemRequired =
          mainRequired + flowList.reduce((s, f) => s + f.quantity, 0);
        const itemScanned =
          item.scannedCount + flowList.reduce((s, f) => s + f.scannedCount, 0);
        const isComplete = itemScanned >= itemRequired && itemRequired > 0;
        const isExpanded = expanded[item.index] !== false; // default open

        return (
          <div key={item.index}
            className={`border rounded-2xl overflow-hidden transition ${isComplete ? "border-green-200" : "border-gray-200"
              }`}>
            {/* Item header */}
            <button
              onClick={() => setExpanded((e) => ({ ...e, [item.index]: !isExpanded }))}
              className="w-full flex items-center gap-3 p-4 bg-gray-50/80 hover:bg-gray-100/80 transition text-right"
            >
              {item.product?.mainImage && (
                <img src={item.product.mainImage} alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate flex items-center gap-1.5">
                  {item.product?.name}
                  {item.isUsed && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                      دست‌دوم
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 font-mono">{item.product?.sku}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${isComplete
                    ? "bg-green-100 text-green-700"
                    : itemScanned > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                  {new Intl.NumberFormat("fa-IR").format(itemScanned)}/
                  {new Intl.NumberFormat("fa-IR").format(itemRequired)}
                </span>
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </button>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-4 border-t border-gray-100">
                    {/* ─── خط محصول اصلی ─── */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                        <Package size={12} className="text-[var(--color-primary)]" />
                        محصول اصلی
                      </p>

                      {item.isUsed ? (
                        // محصول دست‌دوم — اختصاص خودکار، فقط نمایش
                        item.trackingItems.length > 0 ? (
                          <div className="space-y-2">
                            {item.trackingItems.map((t) => (
                              <TrackingItemBadge
                                key={t._id}
                                trackingItem={t}
                                onRemove={handleRemoveTracking}
                              />
                            ))}
                            <p className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
                              <CheckCircle size={12} />
                              کد رهگیری به‌صورت خودکار اختصاص یافت
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                            <AlertTriangle size={13} className="shrink-0" />
                            کد رهگیری انبار برای این محصول دست‌دوم هنوز ثبت/اختصاص نشده است
                          </div>
                        )
                      ) : (
                        renderTrackingBlock({
                          trackingItems: item.trackingItems,
                          scannedCount: item.scannedCount,
                          quantity: item.quantity,
                          remainingCount: item.remainingCount,
                          procurementStatus: item.procurementStatus,
                          addLabel: "اسکن بارکد",
                          target: {
                            productName: item.product?.name,
                            productImage: item.product?.mainImage,
                            productSku: item.product?.sku,
                            expectedProductId: item.product?._id,
                            orderItemIndex: item.index,
                            flowNodeId: null,
                            quantity: item.quantity,
                          },
                        })
                      )}
                    </div>

                    {/* ─── خطوط انتخاب‌های فرایند سفارش ─── */}
                    {flowList.map((f) => (
                      <div key={f.nodeId} className="space-y-2 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-2">
                          {f.product?.mainImage ? (
                            <img src={f.product.mainImage} alt=""
                              className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                              <Tag size={13} className="text-[var(--color-primary)]" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] text-gray-400 leading-tight">
                              {f.nodeLabel} <span className="text-[var(--color-primary)]">(انتخاب فرایند)</span>
                            </p>
                            <p className="text-xs font-bold text-gray-700 truncate leading-snug">
                              {f.product?.name}
                              {f.variantLabel ? ` (${f.variantLabel})` : ""}
                            </p>
                          </div>
                        </div>

                        {renderTrackingBlock({
                          trackingItems: f.trackingItems,
                          scannedCount: f.scannedCount,
                          quantity: f.quantity,
                          remainingCount: f.remainingCount,
                          procurementStatus: f.procurementStatus,
                          addLabel: "اسکن بارکد این مورد",
                          target: {
                            productName: `${f.product?.name || ""}${f.variantLabel ? ` (${f.variantLabel})` : ""}`,
                            productImage: f.product?.mainImage,
                            productSku: f.product?.sku,
                            expectedProductId: f.product?._id,
                            orderItemIndex: item.index,
                            flowNodeId: f.nodeId,
                            quantity: f.quantity,
                          },
                        })}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Scan Modal */}
      <AnimatePresence>
        {scanModal && (
          <ScanModal
            target={scanModal}
            mode={scanModal.mode || "choose"}
            orderId={orderId}
            onSuccess={() => { fetchTracking(); onStatusChange?.(); }}
            onClose={() => setScanModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── EUR Panel (سیستم یورو — کاملاً مستقل از تومان) ─────────────────── */
// این پنل فقط فیلدهای یورویی سفارش را می‌خواند/می‌نویسد و هیچ تأثیری روی
// مبلغ، پرداخت‌ها یا مانده‌ی تومانی ندارد. مانده‌ی یورو دقیقاً مثل مانده‌ی
// تومان، سمت کلاینت از روی priceEUR و paymentsEUR محاسبه می‌شود.
function EurPanel({ orderId, priceEUR, paymentsEUR = [], onChange, onEditPayment }) {
  const [editPrice, setEditPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(
    priceEUR === null || priceEUR === undefined ? "" : String(priceEUR)
  );
  const [savingPrice, setSavingPrice] = useState(false);

  // باز/بستن حالت ویرایش قیمت — هنگام باز شدن، ورودی را از مقدار فعلی پر می‌کند.
  // (نمایش حالت غیرویرایش مستقیماً از priceEUR خوانده می‌شود، پس نیازی به sync افکتی نیست)
  const toggleEditPrice = () => {
    setEditPrice((open) => {
      if (!open) {
        setPriceInput(
          priceEUR === null || priceEUR === undefined ? "" : String(priceEUR)
        );
      }
      return !open;
    });
  };

  const hasPrice = priceEUR !== null && priceEUR !== undefined;
  const totalPaidEUR = paymentsEUR.reduce((s, p) => s + (p.amount || 0), 0);
  const remainingEUR = hasPrice ? priceEUR - totalPaidEUR : null;

  const handleSavePrice = async () => {
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/eur`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceEUR: priceInput.trim() === "" ? null : Number(priceInput),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success(data.message || "قیمت یورو ذخیره شد");
      setEditPrice(false);
      onChange?.();
    } catch (err) {
      toast.error(err.message || "خطا در ذخیره قیمت یورو");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    const result = await Swal.fire({
      ...getSwalTheme(),
      title: "حذف پرداخت یورویی",
      text: "آیا از حذف این پرداخت یورو مطمئن هستید؟",
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/eur`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success(data.message || "پرداخت یورویی حذف شد");
      onChange?.();
    } catch (err) {
      toast.error(err.message || "خطا در حذف پرداخت یورو");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
            <Euro size={14} className="text-white" />
          </span>
          سیستم یورو (EUR)
        </h3>
        <span className="text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full">
          مستقل از تومان
        </span>
      </div>

      {/* ─── قیمت یورویی سفارش ─── */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">قیمت سفارش (یورو)</span>
          <button
            onClick={toggleEditPrice}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition
              ${editPrice
                ? "bg-gray-200 text-gray-600"
                : "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"}`}
          >
            <Edit3 size={10} />
            {editPrice ? "انصراف" : hasPrice ? "ویرایش" : "تعیین قیمت"}
          </button>
        </div>

        {editPrice ? (
          <div className="space-y-2">
            <div className="relative">
              <AdminInput
                type="number"
                step="any"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePrice()}
                placeholder="مبلغ را به یورو وارد کنید"
                dir="ltr"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 text-left
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
            </div>
            <button
              onClick={handleSavePrice}
              disabled={savingPrice}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 rounded-xl text-sm
                transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {savingPrice ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              ذخیره قیمت یورو
            </button>
          </div>
        ) : (
          <p className="text-2xl font-black text-gray-900 tabular-nums" dir="ltr">
            {hasPrice ? (
              <>€ {formatEUR(priceEUR)}</>
            ) : (
              <span className="text-sm text-gray-400 font-bold">قیمت یورویی تعیین نشده</span>
            )}
          </p>
        )}
      </div>

      {/* ─── تاریخچه‌ی پرداخت‌های یورویی ─── */}
      {/* پرداخت‌های یورویی از داخل مودال «تأیید رسید» ثبت می‌شوند (اختیاری، در کنار مبلغ تومان) */}
      {paymentsEUR.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
            <Wallet size={12} className="text-[var(--color-primary)]" />
            پرداخت‌های یورویی
          </p>
          {paymentsEUR.map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 group"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-800" dir="ltr">€ {formatEUR(p.amount)}</p>
                <p className="text-[10px] text-gray-400">
                  {toFarsiDate(p.confirmedAt || p.createdAt)}
                  {p.note ? ` — ${p.note}` : ""}
                  {p.editedAt ? " — ویرایش‌شده" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEditPayment?.(p)}
                  title="ویرایش مبلغ"
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center
                    text-gray-400 hover:text-[var(--color-primary)] transition rounded-lg hover:bg-[var(--color-primary)]/10"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDeletePayment(p._id)}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center
                    text-red-400 hover:text-red-600 transition rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          پرداخت یورویی هنگام «تأیید رسید» و با پر کردن فیلد اختیاری یورو ثبت می‌شود.
        </p>
      )}

      {/* ─── خلاصه‌ی مالی یورو ─── */}
      <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>قیمت سفارش (یورو)</span>
          <span className="font-bold text-gray-700" dir="ltr">
            {hasPrice ? `€ ${formatEUR(priceEUR)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>مجموع پرداخت‌های یورویی</span>
          <span className="font-bold text-green-600" dir="ltr">€ {formatEUR(totalPaidEUR)}</span>
        </div>
        {hasPrice && (
          <div className={`flex justify-between font-black text-sm pt-1 border-t border-gray-100
            ${remainingEUR < 0 ? "text-blue-600" : remainingEUR > 0 ? "text-red-600" : "text-green-600"}`}>
            <span>
              {remainingEUR < 0 ? "اضافه‌پرداخت (یورو)" : remainingEUR > 0 ? "مانده پرداخت (یورو)" : "تسویه کامل یورو"}
            </span>
            <span dir="ltr">€ {formatEUR(Math.abs(remainingEUR))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function AdminOrderDetailClient({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [installment, setInstallment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [editStatus, setEditStatus] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [fulStatus, setFulStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details"); // "details" | "tracking"
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editPaymentTarget, setEditPaymentTarget] = useState(null); // { payment, currency }
  const [itemBusy, setItemBusy] = useState(null); // item._id در حال تغییر

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      setOrder(data.order);
      setInstallment(data.installment || null);
      setPayStatus(data.order.paymentStatus);
      setFulStatus(data.order.fulfillmentStatus);
    } catch (err) {
      toast.error(err.message || "خطا در دریافت سفارش");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleApprovePayment = async (confirmedAmount, eurAmount = null) => {
    try {
      // ۱) تأیید پرداخت تومانی — مسیر موجود و دست‌نخورده
      const res = await fetch(`/api/admin/payments/${approveTarget._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");

      // ۲) ثبت پرداخت یورویی (اختیاری) — کاملاً مستقل از تومان، مسیر جداگانه.
      //    اگر این مرحله خطا بدهد، تأیید تومانی که قبلاً موفق شده را خراب نمی‌کند.
      if (eurAmount && eurAmount > 0) {
        try {
          const eurRes = await fetch(`/api/admin/orders/${orderId}/eur`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: eurAmount, note: "ثبت همراه تأیید رسید" }),
          });
          const eurData = await eurRes.json();
          if (!eurRes.ok) {
            toast.error(eurData.message || "خطا در ثبت پرداخت یورو");
          } else {
            toast.success("پرداخت یورو نیز ثبت شد");
          }
        } catch {
          toast.error("خطا در ثبت پرداخت یورو");
        }
      }

      toast.success(data.message || "پرداخت تأیید شد");
      setApproveTarget(null);
      fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در تأیید پرداخت");
    }
  };

  const handleRejectPayment = async (paymentId) => {
    const result = await Swal.fire({
      ...getSwalTheme(),
      title: "رد رسید بانکی",
      html: `<div dir="rtl" class="text-right space-y-3">
        <p class="text-sm text-gray-600">دلیل رد (اختیاری):</p>
        <textarea id="swal-reason" class="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none
          focus:outline-none focus:ring-2 focus:ring-red-300" rows="3" placeholder="مثلاً: اطلاعات تراکنش مطابقت ندارد"></textarea>
      </div>`,
      showCancelButton: true,
      confirmButtonText: "رد رسید",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
      preConfirm: () => document.getElementById("swal-reason")?.value?.trim() || "",
    });
    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectReason: result.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success("رسید با موفقیت رد شد");
      fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در رد رسید");
    }
  };

  const handleSaveStatus = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: payStatus, fulfillmentStatus: fulStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success("وضعیت سفارش بروز شد");
      setEditStatus(false);
      fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در ذخیره وضعیت");
    } finally {
      setSaving(false);
    }
  };

  // ─── ویرایش تعداد یک آیتم ───
  const handleEditItemQty = async (item, newQty) => {
    if (!item._id || newQty < 1 || newQty === item.quantity) return;
    setItemBusy(item._id);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item._id, quantity: newQty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در تغییر تعداد");
    } finally {
      setItemBusy(null);
    }
  };

  // ─── حذف یک آیتم ───
  const handleRemoveItem = async (item) => {
    if (!item._id) return;
    const result = await Swal.fire({
      ...getSwalTheme(),
      title: "حذف آیتم از سفارش",
      text: `«${item.product?.name || "این آیتم"}» از سفارش حذف شود؟ مبلغ کل و مانده دوباره محاسبه می‌شوند.`,
      showCancelButton: true,
      confirmButtonText: "بله، حذف کن",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    setItemBusy(item._id);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success(data.message || "آیتم حذف شد");
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در حذف آیتم");
    } finally {
      setItemBusy(null);
    }
  };

  // ─── ویرایش مبلغ پرداخت (تومان یا یورو، مستقل) ───
  const handleEditPayment = async (newAmount) => {
    if (!editPaymentTarget) return;
    const { payment, currency } = editPaymentTarget;
    try {
      let res, data;
      if (currency === "eur") {
        res = await fetch(`/api/admin/orders/${orderId}/eur`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: payment._id, amount: newAmount }),
        });
      } else {
        res = await fetch(`/api/admin/payments/${payment._id}/edit`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: newAmount }),
        });
      }
      data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success(data.message || "مبلغ پرداخت ویرایش شد");
      setEditPaymentTarget(null);
      await fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در ویرایش پرداخت");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--admin-bg, #f4f5f2)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
          <p className="text-sm text-gray-500">در حال بارگذاری سفارش...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--admin-bg, #f4f5f2)" }}>
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <p className="text-sm text-gray-600 font-bold">سفارش یافت نشد</p>
          <button onClick={() => router.back()}
            className="text-sm text-[var(--color-primary)] hover:underline">
            بازگشت
          </button>
        </div>
      </div>
    );
  }

  const payCfg = PAYMENT_STATUS[order.paymentStatus];
  const fulCfg = FULFILLMENT_STATUS[order.fulfillmentStatus];
  const methodCfg = PAYMENT_METHOD[order.paymentMethod];
  const pendingReceipts = order.payments?.filter(
    (p) => p.method === "BANK_RECEIPT" && p.status === "PENDING"
  ).length || 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-bg, #f4f5f2)" }} dir="rtl">
      <div className="max-w-4xl mx-auto p-5 space-y-5">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/p-admin/admin-orders")}
              className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200
                rounded-xl hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-gray-500 transition"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <div className="w-7 h-7 bg-[var(--color-primary)] rounded-xl flex items-center justify-center">
                  <ShoppingCart size={13} className="text-white" />
                </div>
                جزئیات سفارش
              </h1>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{order.trackingCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingReceipts > 0 && (
              <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700
                text-xs font-bold px-3 py-1.5 rounded-xl animate-pulse">
                <AlertCircle size={12} />
                {new Intl.NumberFormat("fa-IR").format(pendingReceipts)} رسید در انتظار
              </span>
            )}
            <button
              onClick={fetchOrder} disabled={loading}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600
                hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-xs font-bold px-3 py-2 rounded-xl transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              بروزرسانی
            </button>
          </div>
        </div>

        {/* ─── Tabs ─── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-1.5 flex gap-1">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
              ${activeTab === "details"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
          >
            <Eye size={15} />
            جزئیات سفارش
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
              ${activeTab === "tracking"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
          >
            <Scan size={15} />
            ترکینگ محصولات
          </button>
          {installment && (
            <button
              onClick={() => setActiveTab("installment")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
                ${activeTab === "installment"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              <Calendar size={15} />
              اقساط
              {installment.overdueCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {Number(installment.overdueCount).toLocaleString("fa-IR")}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ─── Tab Content ─── */}
        {activeTab === "details" && (
          <div className="space-y-4">

            {/* Status Row */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">وضعیت سفارش</h3>
                <button
                  onClick={() => setEditStatus(!editStatus)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition
                    ${editStatus
                      ? "bg-gray-200 text-gray-600"
                      : "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"}`}
                >
                  <Edit3 size={11} />
                  {editStatus ? "انصراف" : "ویرایش وضعیت"}
                </button>
              </div>

              {editStatus ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">وضعیت پرداخت</label>
                      <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-700
                          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]">
                        {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">وضعیت ارسال</label>
                      <select value={fulStatus} onChange={(e) => setFulStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-700
                          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]">
                        {Object.entries(FULFILLMENT_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleSaveStatus} disabled={saving}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 rounded-xl text-sm
                      transition flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    ذخیره وضعیت
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <StatusBadge config={payCfg} />
                  <StatusBadge config={fulCfg} />
                  {methodCfg && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-full">
                      <methodCfg.icon size={10} />
                      {methodCfg.label}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* User & Address */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Users size={14} className="text-[var(--color-primary)]" />
                اطلاعات خریدار
              </h3>
              <div className="space-y-2">
                {getUserFullName(order.user) && <InfoRow icon={Users} label="نام" value={getUserFullName(order.user)} />}
                {order.user?.phone && <InfoRow icon={Phone} label="تلفن" value={order.user.phone} />}
                {order.user?.email && <InfoRow icon={Mail} label="ایمیل" value={order.user.email} />}
                {getUserFullName(order.user?.coach) && (
                  <div className="flex items-center gap-2 text-xs">
                    <GraduationCap size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-400 w-14 flex-shrink-0">مربی:</span>
                    <button
                      type="button"
                      onClick={() => router.push(`/p-admin/users/coaches/${order.user.coach._id}/credit/${order._id}`)}
                      className="font-semibold text-[var(--color-primary)] hover:underline truncate"
                    >
                      {getUserFullName(order.user.coach)}
                    </button>
                  </div>
                )}
              </div>
              {order.address?.snapshot && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                    <MapPin size={11} /> آدرس تحویل
                  </p>
                  <div className="text-xs text-gray-600 leading-6 bg-gray-50 rounded-xl px-3 py-2">
                    <p>{order.address.snapshot.province} — {order.address.snapshot.city}</p>
                    <p>{order.address.snapshot.addressLine}</p>
                    {order.address.snapshot.postalCode && (
                      <p className="text-gray-400">کد پستی: {order.address.snapshot.postalCode}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Package size={14} className="text-[var(--color-primary)]" />
                  اقلام سفارش
                </h3>
                <button
                  onClick={() => setAddItemOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg
                    bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition"
                >
                  <Plus size={12} /> افزودن آیتم
                </button>
              </div>
              {order.paymentStatus === "PAID" && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50
                  border border-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle size={12} className="shrink-0" />
                  این سفارش تسویه شده است؛ تغییر اقلام مانده/اضافه‌پرداخت ایجاد می‌کند.
                </div>
              )}
              <div className="space-y-2">
                {order.items?.map((item, i) => {
                  const itemId = item._id;
                  const isUsed = item.itemType === "used_product";
                  const busy = itemBusy === itemId;
                  return (
                  <div key={itemId || i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    {item.product?.mainImage && (
                      <img src={item.product.mainImage} alt={item.product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate flex items-center gap-1.5">
                        {item.product?.name || "محصول"}
                        {isUsed && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                            دست‌دوم
                          </span>
                        )}
                      </p>
                      {item.product?.sku && (
                        <p className="text-xs text-gray-400 font-mono">{item.product.sku}</p>
                      )}
                      {(item.variantSnapshot?.length ||
                        (item.variant?.attributes &&
                          Object.keys(item.variant.attributes).length > 0)) && (
                        <div className="mt-1.5">
                          <VariantSummary
                            snapshot={item.variantSnapshot}
                            attributes={item.variant?.attributes}
                          />
                        </div>
                      )}
                      {item.flowSelections?.length > 0 && (
                        <OrderFlowSelectionsView flowSelections={item.flowSelections} />
                      )}

                      {/* کنترل‌های ویرایش آیتم */}
                      <div className="flex items-center gap-2 mt-2">
                        {isUsed ? (
                          <span className="text-[11px] text-gray-400 font-medium">تعداد: ۱ (دست‌دوم)</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={busy || !itemId || item.quantity <= 1}
                              onClick={() => handleEditItemQty(item, item.quantity - 1)}
                              className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center
                                text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition
                                disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="min-w-7 text-center text-xs font-black text-gray-700">
                              {busy ? <Loader2 size={11} className="animate-spin inline" /> : new Intl.NumberFormat("fa-IR").format(item.quantity)}
                            </span>
                            <button
                              disabled={busy || !itemId}
                              onClick={() => handleEditItemQty(item, item.quantity + 1)}
                              className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center
                                text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition
                                disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        )}
                        <button
                          disabled={busy || !itemId}
                          onClick={() => handleRemoveItem(item)}
                          className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-600
                            hover:bg-red-50 px-2 py-1 rounded-lg transition disabled:opacity-40"
                        >
                          <Trash2 size={11} /> حذف
                        </button>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0 text-xs text-gray-500 space-y-0.5">
                      <p>×{new Intl.NumberFormat("fa-IR").format(item.quantity)}</p>
                      <p className="font-bold text-gray-700">{formatPrice(item.unitPrice)}</p>
                      <p className="text-[10px] text-gray-400">{formatPrice(item.unitPrice * item.quantity)}</p>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs">
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>تخفیف محصول</span>
                    <span className="text-green-600">- {formatPrice(order.discountAmount)} تومان</span>
                  </div>
                )}
                {order.couponDiscount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>تخفیف کوپن {order.coupon?.code && `(${order.coupon.code})`}</span>
                    <span className="text-green-600">- {formatPrice(order.couponDiscount)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-gray-900 border-t border-gray-100 pt-2">
                  <span>مبلغ نهایی</span>
                  <span>{formatPrice(order.totalPrice)} تومان</span>
                </div>
              </div>
            </div>

            {/* Payments */}
            {order.payments?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <ReceiptText size={14} className="text-[var(--color-primary)]" />
                  رسیدها و پرداخت‌ها
                </h3>

                <div className="space-y-3">
                  {order.payments.map((payment, i) => (
                    <PaymentCard
                      key={payment._id || i}
                      payment={payment}
                      orderTotal={order.totalPrice}
                      onViewReceipt={setLightboxUrl}
                      onApprove={() => setApproveTarget(payment)}
                      onReject={() => handleRejectPayment(payment._id)}
                      onEdit={() => setEditPaymentTarget({ payment, currency: "toman" })}
                    />
                  ))}
                </div>

                {/* ─── خلاصه مالی ─── */}
                {(() => {
                  const totalPaid = order.payments
                    .filter((p) => p.status === "PAID")
                    .reduce((sum, p) => sum + (p.amount || 0), 0);
                  const remaining = order.totalPrice - totalPaid;
                  const overpaid = remaining < 0;
                  const settled = remaining === 0;

                  return (
                    <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                      <div className="flex justify-between text-gray-500">
                        <span>مبلغ کل سفارش</span>
                        <span className="font-bold text-gray-700">{formatPrice(order.totalPrice)} تومان</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>مجموع پرداخت‌های تأییدشده</span>
                        <span className="font-bold text-green-600">{formatPrice(totalPaid)} تومان</span>
                      </div>
                      <div className={`flex justify-between font-black text-sm pt-1 border-t border-gray-100
            ${overpaid ? "text-blue-600" : settled ? "text-green-600" : "text-red-600"}`}>
                        <span>{overpaid ? "اضافه‌پرداخت" : settled ? "تسویه کامل" : "مانده پرداخت"}</span>
                        <span>{formatPrice(Math.abs(remaining))} تومان</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* EUR System (مستقل از تومان) */}
            <EurPanel
              orderId={orderId}
              priceEUR={order.priceEUR ?? null}
              paymentsEUR={order.paymentsEUR || []}
              onChange={fetchOrder}
              onEditPayment={(p) => setEditPaymentTarget({ payment: p, currency: "eur" })}
            />

            {/* Description */}
            {order.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-500 mb-1.5">یادداشت سفارش</p>
                <p className="text-sm text-gray-600 leading-relaxed">{order.description}</p>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="font-bold text-gray-500 mb-0.5">تاریخ ثبت</p>
                <p dir="ltr" className="text-right">{toFarsiDate(order.createdAt)}</p>
              </div>
              {order.reviewedAt && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="font-bold text-gray-500 mb-0.5">آخرین بررسی</p>
                  <p dir="ltr" className="text-right">{toFarsiDate(order.reviewedAt)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tracking" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Scan size={14} className="text-[var(--color-primary)]" />
                شناسایی و ترکینگ محصولات
              </h3>
              {order.paymentStatus !== "PAID" && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl">
                  <AlertTriangle size={12} />
                  سفارش هنوز پرداخت نشده
                </div>
              )}
            </div>
            <TrackingPanel
              orderId={orderId}
              orderFulfillmentStatus={order.fulfillmentStatus}
              onStatusChange={fetchOrder}
            />
          </div>
        )}

        {activeTab === "installment" && installment && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Calendar size={14} className="text-[var(--color-primary)]" />
                مدیریت اقساط سفارش
              </h3>
              <a
                href={`/p-admin/financial/installments/${installment._id}`}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
              >
                <ExternalLink size={12} />
                صفحه کامل اقساط
              </a>
            </div>
            <InstallmentChecksPanel
              installment={installment}
              orderFulfillmentStatus={order.fulfillmentStatus}
              onChanged={fetchOrder}
              onViewImage={setLightboxUrl}
            />
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <ReceiptLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>

      {/* Approve Modal */}
      <AnimatePresence>
        {approveTarget && (
          <ApproveModal
            payment={approveTarget}
            orderTotal={order.totalPrice}
            onConfirm={handleApprovePayment}
            onClose={() => setApproveTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {addItemOpen && (
          <AddItemModal
            orderId={orderId}
            onSuccess={fetchOrder}
            onClose={() => setAddItemOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit Payment Modal (تومان / یورو) */}
      <AnimatePresence>
        {editPaymentTarget && (
          <EditPaymentModal
            payment={editPaymentTarget.payment}
            currency={editPaymentTarget.currency}
            onConfirm={handleEditPayment}
            onClose={() => setEditPaymentTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
