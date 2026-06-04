"use client";

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
  ChevronDown, ChevronUp,
} from "lucide-react";

/* ─── Constants ─────────────────────────────────────────────────────── */

const PAYMENT_STATUS = {
  UNPAID: { label: "پرداخت نشده", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500", icon: XCircle },
  PARTIALLY_PAID: { label: "پرداخت ناقص", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500", icon: Clock },
  PAID: { label: "پرداخت کامل", color: "bg-green-50 text-green-600 border-green-200", dot: "bg-green-500", icon: CheckCircle },
};

const FULFILLMENT_STATUS = {
  WAITING: { label: "در انتظار", color: "bg-gray-50 text-gray-500 border-gray-200", dot: "bg-gray-400", icon: Clock },
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

const swalTheme = {
  confirmButtonColor: "#aa4725",
  cancelButtonColor: "#9ca3af",
  customClass: {
    popup: "rounded-2xl font-[Vazirmatn] text-right",
    confirmButton: "rounded-[6px] font-bold",
    cancelButton: "rounded-[6px] font-bold",
  },
  rtl: true,
};

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatPrice(v) {
  return new Intl.NumberFormat("fa-IR").format(Number(v ?? 0));
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
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const handleSubmit = async () => {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) { toast.error("مبلغ معتبر وارد کنید"); return; }
    setLoading(true);
    await onConfirm(parsed);
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
        <div className="bg-[#aa4725] px-5 py-4 flex items-center justify-between">
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
              مبلغ تأیید شده <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef} type="number" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="مبلغ را به تومان وارد کنید"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-800
                  focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725] transition"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">تومان</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold py-2.5 rounded-xl text-sm
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
            focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725] transition"
          dir="ltr"
        />
        <button type="submit"
          className="bg-[#aa4725] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-[#8f3b1e] transition">
          تأیید
        </button>
      </form>

      {/* Camera Scanner */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        {phase === "idle" && (
          <button onClick={startScanner}
            className="w-full flex items-center justify-center gap-2 py-4 text-sm font-bold text-gray-600
              hover:bg-gray-50 transition">
            <QrCode size={18} className="text-[#aa4725]" />
            اسکن با دوربین
          </button>
        )}
        {phase === "starting" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin text-[#aa4725]" />
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
              className="text-xs text-[#aa4725] font-bold hover:underline">
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
        <div className="bg-[#0d0d0d] px-5 py-4 flex items-center justify-between">
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
            className="w-full bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold py-3 rounded-xl text-sm
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
function ScanModal({ item, orderItemIndex, orderId, onSuccess, onClose }) {
  const [step, setStep] = useState("procurement"); // "procurement" | "scan"
  const [procurementStatus, setProcurementStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // null | {success, message, item}

  const handleProcurementChoice = (choice) => {
    // اگه باید خریداری بشه و قبلاً یه بارکد برای محصول اسکن شده
    // یا موجود، مستقیم بره به اسکن
    setProcurementStatus(choice);
    setStep("scan");
  };

  // اگه محصول باید خریداری بشه و قبلاً اسکن شده، نشون بده "PURCHASED"
  const effectiveProcurement =
    procurementStatus === "TO_PURCHASE" && scanResult?.success
      ? "PURCHASED"
      : procurementStatus;

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
      if (lookupData.item.productRef?.toString() !== item.product?._id?.toString()) {
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
          orderItemIndex,
          procurementStatus: effectiveProcurement || procurementStatus,
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
        <div className="bg-[#0d0d0d] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === "procurement" ? (
              <div className="w-8 h-8 rounded-xl bg-[#aa4725] flex items-center justify-center">
                <Package size={15} className="text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#aa4725] flex items-center justify-center">
                <Scan size={15} className="text-white" />
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm">
                {step === "procurement" ? "وضعیت تأمین" : "اسکن بارکد"}
              </p>
              <p className="text-white/50 text-xs truncate max-w-[200px]">
                {item.product?.name}
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
            {item.product?.mainImage && (
              <img src={item.product.mainImage} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{item.product?.name}</p>
              <p className="text-xs text-gray-400 font-mono">{item.product?.sku}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                تعداد مورد نیاز: <strong>{item.quantity}</strong> عدد
              </p>
            </div>
          </div>

          {/* Step 1: Procurement choice */}
          {step === "procurement" && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-700">این محصول از چه طریقی تأمین می‌شود؟</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleProcurementChoice("IN_STOCK")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                    hover:border-green-400 hover:bg-green-50 transition font-bold text-sm text-gray-600 hover:text-green-700"
                >
                  <Warehouse size={24} className="text-green-500" />
                  موجود در انبار
                  <span className="text-[10px] text-gray-400 font-normal">بارکد از انبار اسکن شود</span>
                </button>
                <button
                  onClick={() => handleProcurementChoice("TO_PURCHASE")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200
                    hover:border-amber-400 hover:bg-amber-50 transition font-bold text-sm text-gray-600 hover:text-amber-700"
                >
                  <ShoppingBag size={24} className="text-amber-500" />
                  باید خریداری شود
                  <span className="text-[10px] text-gray-400 font-normal">بعد از خرید بارکد اسکن شود</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Scan */}
          {step === "scan" && (
            <div className="space-y-3">
              {/* Procurement status indicator */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold
                ${procurementStatus === "IN_STOCK"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {procurementStatus === "IN_STOCK"
                  ? <><Warehouse size={13} /> موجود در انبار — بارکد را اسکن کنید</>
                  : <><ShoppingBag size={13} /> باید خریداری شود — بعد از خرید بارکد را اسکن کنید</>
                }
              </div>

              {scanning && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin text-[#aa4725]" />
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

              <button onClick={() => setStep("procurement")}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
                <ChevronRight size={12} /> برگشت به انتخاب تأمین
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Payment Card ──────────────────────────────────────────────────── */
function PaymentCard({ payment, orderTotal, onViewReceipt, onApprove, onReject }) {
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
          <p className="text-sm font-black text-gray-800">{formatPrice(payment.amount)}</p>
          <p className="text-[10px] text-gray-400">تومان پرداخت شده</p>
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
                    hover:border-[#aa4725] transition aspect-video bg-gray-100"
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
      ...swalTheme,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin text-[#aa4725]" />
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
        const isComplete = item.scannedCount >= item.quantity;
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
                <p className="text-sm font-bold text-gray-800 truncate">{item.product?.name}</p>
                <p className="text-xs text-gray-400 font-mono">{item.product?.sku}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${isComplete
                    ? "bg-green-100 text-green-700"
                    : item.scannedCount > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                  {new Intl.NumberFormat("fa-IR").format(item.scannedCount)}/
                  {new Intl.NumberFormat("fa-IR").format(item.quantity)}
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
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    {/* Scanned items */}
                    {item.trackingItems.length > 0 && (
                      <div className="space-y-2">
                        {item.trackingItems.map((t) => (
                          <TrackingItemBadge
                            key={t._id}
                            trackingItem={t}
                            onRemove={handleRemoveTracking}
                          />
                        ))}
                      </div>
                    )}

                    {/* Add more button */}
                    {item.scannedCount < item.quantity && (
                      <button
                        onClick={() => setScanModal({ item, itemIndex: item.index })}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed
                          border-[#aa4725]/40 hover:border-[#aa4725] rounded-xl text-sm font-bold
                          text-[#aa4725]/70 hover:text-[#aa4725] bg-[#aa4725]/5 hover:bg-[#aa4725]/10 transition"
                      >
                        <Plus size={16} />
                        اسکن بارکد ({item.remainingCount} عدد باقی‌مانده)
                      </button>
                    )}

                    {isComplete && (
                      <div className="flex items-center gap-2 text-xs text-green-600 font-bold">
                        <CheckCircle size={13} />
                        تمام {new Intl.NumberFormat("fa-IR").format(item.quantity)} عدد شناسایی شد
                      </div>
                    )}
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
            item={scanModal.item}
            orderItemIndex={scanModal.itemIndex}
            orderId={orderId}
            onSuccess={() => { fetchTracking(); }}
            onClose={() => setScanModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function AdminOrderDetailClient({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [editStatus, setEditStatus] = useState(false);
  const [payStatus, setPayStatus] = useState("");
  const [fulStatus, setFulStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details"); // "details" | "tracking"

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      setOrder(data.order);
      setPayStatus(data.order.paymentStatus);
      setFulStatus(data.order.fulfillmentStatus);
    } catch (err) {
      toast.error(err.message || "خطا در دریافت سفارش");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleApprovePayment = async (confirmedAmount) => {
    try {
      const res = await fetch(`/api/admin/payments/${approveTarget._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطا");
      toast.success(data.message || "پرداخت تأیید شد");
      setApproveTarget(null);
      fetchOrder();
    } catch (err) {
      toast.error(err.message || "خطا در تأیید پرداخت");
    }
  };

  const handleRejectPayment = async (paymentId) => {
    const result = await Swal.fire({
      ...swalTheme,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--admin-bg, #f5f3f0)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#aa4725]" />
          <p className="text-sm text-gray-500">در حال بارگذاری سفارش...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--admin-bg, #f5f3f0)" }}>
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <p className="text-sm text-gray-600 font-bold">سفارش یافت نشد</p>
          <button onClick={() => router.back()}
            className="text-sm text-[#aa4725] hover:underline">
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
    <div className="min-h-screen" style={{ background: "var(--admin-bg, #f5f3f0)" }} dir="rtl">
      <div className="max-w-4xl mx-auto p-5 space-y-5">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/p-admin/admin-orders")}
              className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200
                rounded-xl hover:border-[#aa4725] hover:text-[#aa4725] text-gray-500 transition"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <div className="w-7 h-7 bg-[#aa4725] rounded-xl flex items-center justify-center">
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
                hover:border-[#aa4725] hover:text-[#aa4725] text-xs font-bold px-3 py-2 rounded-xl transition"
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
                ? "bg-[#aa4725] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
          >
            <Eye size={15} />
            جزئیات سفارش
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition
              ${activeTab === "tracking"
                ? "bg-[#aa4725] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
          >
            <Scan size={15} />
            ترکینگ محصولات
          </button>
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
                      : "bg-[#aa4725]/10 text-[#aa4725] hover:bg-[#aa4725]/20"}`}
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
                          focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725]">
                        {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block">وضعیت ارسال</label>
                      <select value={fulStatus} onChange={(e) => setFulStatus(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-700
                          focus:outline-none focus:ring-2 focus:ring-[#aa4725]/30 focus:border-[#aa4725]">
                        {Object.entries(FULFILLMENT_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleSaveStatus} disabled={saving}
                    className="w-full bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold py-2.5 rounded-xl text-sm
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
                <Users size={14} className="text-[#aa4725]" />
                اطلاعات خریدار
              </h3>
              <div className="space-y-2">
                {order.user?.name && <InfoRow icon={Users} label="نام" value={order.user.name} />}
                {order.user?.phone && <InfoRow icon={Phone} label="تلفن" value={order.user.phone} />}
                {order.user?.email && <InfoRow icon={Mail} label="ایمیل" value={order.user.email} />}
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
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Package size={14} className="text-[#aa4725]" />
                اقلام سفارش
              </h3>
              <div className="space-y-2">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    {item.product?.mainImage && (
                      <img src={item.product.mainImage} alt={item.product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {item.product?.name || "محصول"}
                      </p>
                      {item.product?.sku && (
                        <p className="text-xs text-gray-400 font-mono">{item.product.sku}</p>
                      )}
                    </div>
                    <div className="text-left flex-shrink-0 text-xs text-gray-500 space-y-0.5">
                      <p>×{item.quantity}</p>
                      <p className="font-bold text-gray-700">{formatPrice(item.unitPrice)}</p>
                    </div>
                  </div>
                ))}
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
                  <ReceiptText size={14} className="text-[#aa4725]" />
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
                    />
                  ))}
                </div>

                {/* ─── خلاصه مالی ─── */}
                {(() => {
                  const totalPaid = order.payments
                    .filter((p) => p.status === "PAID")
                    .reduce((sum, p) => sum + (p.amount || 0), 0);
                  const remaining = order.totalPrice - totalPaid;

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
            ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                        <span>{remaining > 0 ? "مانده پرداخت" : "تسویه کامل"}</span>
                        <span>{formatPrice(remaining)} تومان</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

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
                <Scan size={14} className="text-[#aa4725]" />
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
    </div>
  );
}
