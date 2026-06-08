"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiSave, FiUser, FiCreditCard, FiHash } from "react-icons/fi";
import { MdAccountBalance } from "react-icons/md";
import { showToast } from "@/lib/toast";

export const BANK_SETTING_KEY = "bank_account_details";

const EMPTY = { ownerName: "", cardNumber: "", accountNumber: "", iban: "" };

// تعریف در سطح ماژول تا با هر رندر دوباره ساخته نشود (در غیر این صورت اینپوت فوکوس را از دست می‌دهد)
function Field({ label, hint, icon: Icon, value, onChange, placeholder, ltr = true, maxLength }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1.5">
        {label} {hint && <span className="font-bold text-gray-400">{hint}</span>}
      </label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon size={16} />
        </span>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          dir={ltr ? "ltr" : "rtl"}
          maxLength={maxLength}
          className={`w-full bg-gray-50 border-2 border-gray-200 rounded-[var(--radius)] py-2.5 pr-10 pl-4 text-sm font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all ${ltr ? "text-left tracking-wider font-mono" : "text-right"}`}
        />
      </div>
    </div>
  );
}

/**
 * مدیریت اطلاعات حساب بانکی برای پرداخت‌های فیش بانکی.
 * مقادیر در SiteSetting با کلید bank_account_details ذخیره می‌شوند و در
 * صفحه‌ی پرداخت (BankInfoBox) به کاربر نمایش داده می‌شوند.
 */
export default function BankAccountManager() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/site-settings?key=${BANK_SETTING_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.value && typeof d.value === "object") {
          setForm({ ...EMPTY, ...d.value });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (field) => (e) => {
    const raw = e.target.value;
    // برای فیلدهای عددی فقط رقم را نگه می‌داریم (شبا حروف IR را هم می‌پذیرد)
    const value =
      field === "cardNumber" || field === "accountNumber"
        ? raw.replace(/[^0-9]/g, "")
        : raw;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.ownerName.trim()) return showToast.warning("نام صاحب حساب را وارد کنید");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: BANK_SETTING_KEY,
          value: {
            ownerName: form.ownerName.trim(),
            cardNumber: form.cardNumber.trim(),
            accountNumber: form.accountNumber.trim(),
            iban: form.iban.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) showToast.success("اطلاعات حساب بانکی ذخیره شد");
      else showToast.error(data.error || "خطا در ذخیره");
    } catch {
      showToast.error("خطای ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSave}
      className="max-w-2xl bg-white rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: "#e8e4df" }}
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "#f0ede9" }}>
        <MdAccountBalance size={18} style={{ color: "var(--color-primary)" }} />
        <div>
          <h2 className="font-bold text-gray-800 text-sm">اطلاعات حساب بانکی</h2>
          <p className="text-xs font-bold text-gray-400 mt-0.5">
            برای پرداخت‌های فیش بانکی؛ در صفحه‌ی پرداخت به کاربر نمایش داده می‌شود
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 w-full bg-gray-100 animate-pulse rounded-[var(--radius)]" />
            ))}
          </div>
        ) : (
          <>
            <Field
              label="نام صاحب حساب"
              icon={FiUser}
              value={form.ownerName}
              onChange={update("ownerName")}
              placeholder="مثال: فروشگاه ورزشی تنادور"
              ltr={false}
            />
            <Field
              label="شماره کارت"
              icon={FiCreditCard}
              value={form.cardNumber}
              onChange={update("cardNumber")}
              placeholder="6037997123456789"
              maxLength={16}
            />
            <Field
              label="شماره حساب"
              icon={FiHash}
              value={form.accountNumber}
              onChange={update("accountNumber")}
              placeholder="1234567890123"
            />
            <Field
              label="شماره شبا"
              hint="(IBAN)"
              icon={FiHash}
              value={form.iban}
              onChange={update("iban")}
              placeholder="IR123456789012345678901234"
              maxLength={26}
            />

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 text-white px-6 py-2.5 rounded-[var(--radius)] font-bold text-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{ background: "var(--color-primary)" }}
            >
              <FiSave size={15} />
              {saving ? "در حال ذخیره..." : "ذخیره اطلاعات حساب"}
            </button>
          </>
        )}
      </div>
    </motion.form>
  );
}
