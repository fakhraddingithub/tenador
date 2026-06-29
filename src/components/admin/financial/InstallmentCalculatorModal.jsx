"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calculator, Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { showToast } from "@/lib/toast";
import {
  formatThousands,
  formatNumber,
  computeInstallmentPlan,
} from "@/lib/installmentFinance";

/**
 * ماشین‌حساب اقساط + رسید برند (Part 2 و 3).
 * فرم سه‌فیلدی → دکمه‌ی محاسبه → رسید مالی برند با خروجی PNG.
 *
 * @param {boolean}  open
 * @param {()=>void} onClose
 * @param {number}   defaultRate  نرخ سود ماهانه‌ی پیش‌فرض از تنظیمات سایت (Part 1)
 */
export default function InstallmentCalculatorModal({ open, onClose, defaultRate }) {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  const slipRef = useRef(null);

  // مقداردهی اولیه‌ی نرخ از پیش‌فرض سراسری هنگام باز شدن (قابل ویرایش دستی).
  // الگوی پیشنهادی React: تنظیم state حین رندر بر اساس تغییر prop، نه در useEffect.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRate(defaultRate ? String(defaultRate) : "");
  }

  // بستن با Escape + قفل اسکرول پس‌زمینه
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const handlePrincipal = (e) => setPrincipal(formatThousands(e.target.value));
  const handleMonths = (e) => setMonths(formatThousands(e.target.value));
  const handleRate = (e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    setRate(v);
  };

  const handleCalculate = (e) => {
    e.preventDefault();
    const plan = computeInstallmentPlan({
      principal,
      monthlyRatePct: rate,
      months,
    });
    if (!plan.valid) {
      return showToast.warning("مبلغ، نرخ و تعداد اقساط را درست وارد کنید");
    }
    setResult(plan);
  };

  const handleDownload = async () => {
    if (!slipRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(slipRef.current, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `tenador-installment-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      showToast.success("تصویر کارت دانلود شد");
    } catch (err) {
      console.error(err);
      showToast.error("خطا در ساخت تصویر");
    } finally {
      setExporting(false);
    }
  };

  // ریست هنگام بستن
  const close = () => {
    onClose();
    setResult(null);
    setPrincipal("");
    setMonths("");
  };

  // در SSR، document وجود ندارد؛ portal فقط در کلاینت رندر می‌شود.
  if (typeof document === "undefined") return null;

  const today = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "rgba(17,12,8,0.55)", backdropFilter: "blur(2px)" }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            dir="rtl"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl my-auto"
            style={{ border: "1px solid #e8e4df" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "#f0ede9" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(170,71,37,0.1)" }}
                >
                  <Calculator size={18} style={{ color: "#aa4725" }} />
                </div>
                <h2 className="text-base font-bold text-gray-900">ماشین حساب اقساط</h2>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Form ── */}
              <form onSubmit={handleCalculate} className="space-y-3.5">
                <Field label="مبلغ کل" suffix="تومان">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={principal}
                    onChange={handlePrincipal}
                    placeholder="12,000,000"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="نرخ سود ماهانه" suffix="٪">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rate}
                      onChange={handleRate}
                      placeholder="4"
                      dir="ltr"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="تعداد اقساط" suffix="ماه">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={months}
                      onChange={handleMonths}
                      placeholder="6"
                      dir="ltr"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-[#aa4725]/25 active:scale-[0.98] transition-all"
                  style={{ background: "#aa4725" }}
                >
                  <Calculator size={16} />
                  محاسبه
                </button>
              </form>

              {/* ── Branded summary slip ── */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <Slip ref={slipRef} result={result} today={today} />

                    <button
                      onClick={handleDownload}
                      disabled={exporting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm border-2 transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{ borderColor: "#aa4725", color: "#aa4725" }}
                    >
                      {exporting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      {exporting ? "در حال ساخت تصویر..." : "دانلود تصویر کارت"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

const inputCls =
  "w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-base font-bold text-gray-800 outline-none focus:border-[#aa4725] focus:ring-4 focus:ring-[#aa4725]/10 focus:bg-white transition-all";

function Field({ label, suffix, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">
        {label} <span className="text-gray-400">({suffix})</span>
      </label>
      {children}
    </div>
  );
}

/**
 * رسید برند — استایل اینلاین با رنگ‌های hex برای خروجی PNG مطمئن (مستقل از
 * متغیرهای CSS و oklch تیلویند). در موبایل ۳۶۰px نیز بدون شکست متن جمع می‌شود.
 */
const Slip = ({ ref, result, today }) => {
  const rows = [
    { label: "مبلغ اولیه", value: formatNumber(result.principal), unit: "تومان" },
    {
      label: "نرخ سود ماهانه",
      value: String(result.monthlyRatePct),
      unit: "٪",
    },
    { label: "تعداد اقساط", value: formatNumber(result.months), unit: "ماه" },
    {
      label: "مبلغ هر قسط",
      value: formatNumber(result.monthlyInstallment),
      unit: "تومان",
      strong: true,
    },
    {
      label: "کل سود دریافتی",
      value: formatNumber(result.totalInterest),
      unit: "تومان",
    },
  ];

  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        background: "#ffffff",
        border: "1px solid #e8e4df",
        borderRadius: 16,
        padding: "22px 20px",
        fontFamily: "Vazirmatn, sans-serif",
      }}
    >
      {/* Header — logo centered */}
      <div style={{ textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo.svg"
          alt="Tenador"
          style={{ height: 34, width: "auto", display: "inline-block" }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#aa4725",
            marginTop: 10,
            letterSpacing: 0.2,
          }}
        >
          صورت‌حساب طرح اقساطی
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#a8a29a", marginTop: 3 }}>
          {today}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#efece8", margin: "16px 0" }} />

      {/* Data rows */}
      <div>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 0",
              borderBottom: i < rows.length - 1 ? "1px solid #f5f3f0" : "none",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#8a817a" }}>
              {row.label}
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: row.strong ? 15 : 13,
                fontWeight: 800,
                color: row.strong ? "#aa4725" : "#2b2620",
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
              <span style={{ fontSize: 10, fontWeight: 700, color: "#a8a29a", marginRight: 4 }}>
                {row.unit}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Grand total — emphasized footer band */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 16,
          padding: "13px 16px",
          borderRadius: 12,
          background: "rgba(170,71,37,0.07)",
          border: "1px solid rgba(170,71,37,0.15)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: "#aa4725" }}>
          جمع کل اقساط
        </span>
        <span dir="ltr" style={{ fontSize: 18, fontWeight: 900, color: "#aa4725", whiteSpace: "nowrap" }}>
          {formatNumber(result.grandTotal)}
          <span style={{ fontSize: 11, fontWeight: 700, marginRight: 4 }}>تومان</span>
        </span>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 9,
          fontWeight: 700,
          color: "#bdb7af",
          marginTop: 14,
        }}
      >
        tenador.com · این برآورد جنبه‌ی اطلاع‌رسانی دارد
      </div>
    </div>
  );
};

export { Slip };
