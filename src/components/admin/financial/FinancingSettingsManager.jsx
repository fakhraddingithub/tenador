"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiSave, FiPercent, FiInfo } from "react-icons/fi";
import { showToast } from "@/lib/toast";
import {
  INSTALLMENT_RATE_KEY,
  DEFAULT_MONTHLY_RATE,
  formatNumber,
} from "@/lib/installmentFinance";

/**
 * تنظیمات تأمین مالی اقساط — نرخ سود ماهانه‌ی پیش‌فرض (Part 1).
 * مقدار در SiteSetting با کلید monthly_installment_rate ذخیره می‌شود و به عنوان
 * مقدار پیش‌فرض ماشین‌حساب اقساط و مبنای محاسبه‌ی مانده‌ی بک‌اند استفاده می‌شود.
 */
export default function FinancingSettingsManager() {
  const [rate, setRate] = useState("");
  const [savedRate, setSavedRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/site-settings?key=${INSTALLMENT_RATE_KEY}`
        );
        const data = await res.json();
        const val = Number(data?.value);
        if (val > 0) {
          setRate(String(val));
          setSavedRate(val);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // فقط عدد و حداکثر یک ممیز اعشار — نرخ سود می‌تواند اعشاری باشد (مثلاً 3.5٪)
  const handleChange = (e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    setRate(v);
  };

  const rateNum = Number(rate) || 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!(rateNum >= 0) || rateNum > 100) {
      return showToast.warning("نرخ سود معتبر وارد کنید (بین ۰ تا ۱۰۰ درصد)");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: INSTALLMENT_RATE_KEY, value: rateNum }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedRate(rateNum);
        showToast.success("نرخ سود ماهانه ذخیره شد");
      } else {
        showToast.error(data.error || "خطا در ذخیره");
      }
    } catch {
      showToast.error("خطای ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  // نمونه‌ی محاسبه‌ی شفاف برای ۱۰٬۰۰۰٬۰۰۰ تومان در ۶ ماه
  const sampleP = 10_000_000;
  const sampleN = 6;
  const sampleInterest = Math.round(sampleP * (rateNum / 100) * sampleN);
  const sampleTotal = sampleP + sampleInterest;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Current rate card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border px-5 py-4 shadow-sm sm:col-span-2"
          style={{ borderColor: "#e8e4df" }}
        >
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
            نرخ سود ماهانه‌ی فعلی
          </p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-100 animate-pulse rounded-lg" />
          ) : savedRate !== null ? (
            <p
              className="text-3xl font-bold"
              style={{ color: "var(--color-primary)" }}
              dir="ltr"
            >
              {savedRate}
              <span className="text-base font-bold text-gray-400 ml-2">٪</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-amber-600">
              تنظیم نشده — پیش‌فرض {DEFAULT_MONTHLY_RATE}٪ اعمال می‌شود
            </p>
          )}
          <p className="text-xs text-gray-400 font-bold mt-2">
            مبنای ماشین‌حساب اقساط و محاسبه‌ی مانده‌ی سفارش‌های اقساطی
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center"
          style={{
            background: "rgba(170,71,37,0.07)",
            border: "1px solid rgba(170,71,37,0.15)",
          }}
        >
          <p
            className="text-xs font-bold mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            نمونه — ۱۰٬۰۰۰٬۰۰۰ ت / {sampleN} ماه
          </p>
          <p
            className="text-xl font-bold"
            style={{ color: "var(--color-primary)" }}
            dir="ltr"
          >
            {formatNumber(sampleTotal)}
          </p>
          <p
            className="text-xs font-bold mt-1"
            style={{ color: "var(--color-primary)" }}
          >
            جمع کل با سود {formatNumber(sampleInterest)} ت
          </p>
        </motion.div>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSave}
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "#e8e4df" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#f0ede9" }}>
          <h2 className="font-bold text-gray-800 text-sm">
            نرخ سود ماهانه‌ی اقساط (٪)
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              درصد سود به ازای هر ماه{" "}
              <span className="font-bold text-gray-400">
                (روی کل اصل مبلغ، برای کل دوره)
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={rate}
                onChange={handleChange}
                placeholder="مثال: 4"
                dir="ltr"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-[var(--radius)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 flex items-center gap-1">
                <FiPercent size={13} /> درصد
              </span>
            </div>
          </div>

          <div
            className="flex items-start gap-2 text-xs font-bold rounded-xl px-3 py-2.5"
            style={{ background: "#f6f4f1", color: "#7a6f64" }}
          >
            <FiInfo size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              فرمول: کل سود = اصل مبلغ × نرخ ماهانه × تعداد اقساط. جمع کل = اصل
              مبلغ + کل سود. این مقدار به‌صورت خودکار در ماشین‌حساب اقساط بارگذاری
              می‌شود اما قابل ویرایش دستی است.
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-2 text-white px-6 py-2.5 rounded-[var(--radius)] font-bold text-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ background: "var(--color-primary)" }}
          >
            <FiSave size={15} />
            {saving ? "در حال ذخیره..." : "ذخیره نرخ سود"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
