"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiSave, FiPercent, FiInfo, FiCheck } from "react-icons/fi";
import { showToast } from "@/lib/toast";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";
import {
  REVIEW_CREDIT_CONFIG_KEY,
  REVIEW_CREDIT_ROLE_OPTIONS,
  DEFAULT_REVIEW_CREDIT_CONFIG,
} from "@/lib/reviewCreditFinance";

const KIND_OPTIONS = [
  { value: "amount", label: "مبلغ ثابت (تومان)" },
  { value: "percent", label: "درصدی" },
];

const GRANULARITY_OPTIONS = [
  { value: "per-item", label: "به ازای هر کالا", desc: "هر آیتمِ سفارش که نظرش تأیید شود، پاداش جدا می‌گیرد" },
  { value: "per-order", label: "یک‌جا برای کل سفارش", desc: "اولین نظرِ تأییدشده روی هر آیتم از سفارش، یک پاداش برای کل سفارش می‌دهد" },
];

/**
 * تنظیمات پاداش نقدی نظر — در SiteSetting با کلید review_credit_config
 * ذخیره می‌شود (همان الگوی FinancingSettingsManager برای نرخ سود اقساط).
 */
export default function ReviewCreditSettingsManager() {
  const { can } = useAdminPermissions();
  const canEdit = can("reviewCredit.edit");
  const [config, setConfig] = useState(DEFAULT_REVIEW_CREDIT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/site-settings?key=${REVIEW_CREDIT_CONFIG_KEY}`);
        const data = await res.json();
        if (data?.value) {
          setConfig({ ...DEFAULT_REVIEW_CREDIT_CONFIG, ...data.value });
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleValueChange = (e) => {
    let v = e.target.value.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    setConfig((c) => ({ ...c, value: v }));
  };

  const toggleRole = (role) => {
    setConfig((c) => ({
      ...c,
      eligibleRoles: c.eligibleRoles.includes(role)
        ? c.eligibleRoles.filter((r) => r !== role)
        : [...c.eligibleRoles, role],
    }));
  };

  const valueNum = Number(config.value) || 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!(valueNum >= 0) || (config.kind === "percent" && valueNum > 100)) {
      return showToast.warning(
        config.kind === "percent"
          ? "مقدار درصد باید بین ۰ تا ۱۰۰ باشد"
          : "مبلغ معتبر وارد کنید"
      );
    }
    if (config.enabled && config.eligibleRoles.length === 0) {
      return showToast.warning("حداقل یک نقش مجاز انتخاب کنید");
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: REVIEW_CREDIT_CONFIG_KEY,
          value: { ...config, value: valueNum },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast.success("تنظیمات پاداش نظر ذخیره شد");
      } else {
        showToast.error(data.error || "خطا در ذخیره");
      }
    } catch {
      showToast.error("خطای ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "#e8e4df" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#f0ede9" }}>
          <h2 className="font-bold text-gray-800 text-sm">پاداش نقدی نظر</h2>

          {/* Enabled toggle */}
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            disabled={loading}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
              config.enabled ? "bg-[var(--color-primary)]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${
                config.enabled ? "-translate-x-6" : "-translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <>
              {/* Kind */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">نوع پاداش</label>
                <div className="flex flex-wrap gap-2">
                  {KIND_OPTIONS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, kind: k.value }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        config.kind === k.value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  {config.kind === "percent" ? "درصد پاداش" : "مبلغ پاداش (تومان)"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={config.value}
                    onChange={handleValueChange}
                    placeholder={config.kind === "percent" ? "مثال: 2" : "مثال: 20000"}
                    dir="ltr"
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-[var(--radius)] px-4 py-3 text-lg font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:bg-white transition-all"
                  />
                  {config.kind === "percent" && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 flex items-center gap-1">
                      <FiPercent size={13} /> درصد
                    </span>
                  )}
                </div>
                {config.kind === "percent" && (
                  <p className="text-xs font-bold text-gray-400 mt-1.5">
                    درصدی از مبلغ پرداخت‌شده — برای «کل سفارش» روی مبلغ کل سفارش، برای «هر کالا» روی مبلغ همان قلم
                  </p>
                )}
              </div>

              {/* Granularity */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">دانه‌بندی پاداش</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GRANULARITY_OPTIONS.map((g) => {
                    const active = config.granularity === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setConfig((c) => ({ ...c, granularity: g.value }))}
                        className={`relative flex flex-col items-start gap-1 p-3 rounded-[var(--radius)] border-2 text-right transition-all ${
                          active
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <span className={`text-xs font-bold ${active ? "text-[var(--color-primary)]" : "text-gray-700"}`}>
                          {g.label}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">{g.desc}</span>
                        {active && (
                          <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white">
                            <FiCheck size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Eligible roles */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نقش‌های مجاز</label>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_CREDIT_ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        config.eligibleRoles.includes(r.value)
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="flex items-start gap-2 text-xs font-bold rounded-xl px-3 py-2.5"
                style={{ background: "#f6f4f1", color: "#7a6f64" }}
              >
                <FiInfo size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  پاداش فقط وقتی اعطا می‌شود که نظر به یک سفارشِ واقعی متصل باشد (خرید تأییدشده)
                  و نقش کاربر جزو نقش‌های مجاز باشد. هر آیتم/سفارش حداکثر یک‌بار پاداش می‌گیرد.
                </span>
              </div>

              {canEdit ? (
              <button
                type="submit"
                disabled={saving || loading}
                className="flex items-center gap-2 text-white px-6 py-2.5 rounded-[var(--radius)] font-bold text-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{ background: "var(--color-primary)" }}
              >
                <FiSave size={15} />
                {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
              </button>
              ) : (
                <p className="text-xs font-bold text-gray-400">
                  دسترسی ویرایش این بخش را ندارید — مقادیر فقط برای مشاهده‌اند.
                </p>
              )}
            </>
          )}
        </div>
      </motion.form>
    </div>
  );
}
