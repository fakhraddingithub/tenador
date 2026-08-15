"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/useAdminRefData";
import OrderFlowBuilder from "./OrderFlowBuilder";
import { FiCheck, FiAlertTriangle, FiSave, FiEdit3 } from "react-icons/fi";

const COLORS = {
  primary: "#004225",
  secondary: "#c9a84c",
  border: "#e8e4df",
  muted: "#9c9189",
  bg: "#f5f3f0",
};

export default function OrderFlowForm({ initialFlow = null }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const [isDirty, setIsDirty] = useState(false);

  // فیلدهای اولیه فرم
  const [meta, setMeta] = useState({
    name: initialFlow?.name || "",
    description: initialFlow?.description || "",
    rootCategory: initialFlow?.rootCategory?._id || initialFlow?.rootCategory || "",
    isActive: initialFlow?.isActive !== undefined ? initialFlow.isActive : true,
  });

  // ارجاع به تابعِ ذخیره‌ی داخلِ Builder تا دکمه‌ی ذخیره‌ی بالای صفحه هم بتواند
  // مراحل را ذخیره کند (بدون آن، دکمه‌ی بالا از ترتیبِ فعلیِ کارت‌ها خبر ندارد).
  const saveRef = useRef(null);

  // 🟢 دسته‌بندی‌ها — کشِ مشترکِ داده‌ی مرجع
  const { categories, isLoading: loadingCats } = useCategories();

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const updateMeta = (patch) => {
    setMeta((m) => ({ ...m, ...patch }));
    setIsDirty(true);
  };

  // هشدارِ خروج با تغییراتِ ذخیره‌نشده (فقط رفرش/بستنِ تب)
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleSave = async ({ nodes, edges }) => {
    if (!meta.name.trim()) {
      showToast("error", "لطفاً نام فرایند را وارد کنید");
      return;
    }
    if (!meta.rootCategory) {
      showToast("error", "لطفاً دسته‌بندی ریشه را انتخاب کنید");
      return;
    }

    setIsSaving(true);
    try {
      const payload = { ...meta, nodes, edges };
      const url = initialFlow
        ? `/api/admin/order-flows/${initialFlow._id}`
        : "/api/admin/order-flows";
      const method = initialFlow ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "خطا");
      setIsDirty(false);
      showToast("success", initialFlow ? "فرایند با موفقیت ویرایش شد" : "فرایند با موفقیت ایجاد شد");
      setTimeout(() => router.push("/p-admin/admin-order-flows"), 1200);
    } catch (err) {
      showToast("error", err.message || "خطا در ذخیره");
    } finally {
      setIsSaving(false);
    }
  };

  // حاشیه inline است، پس فوکوس با ring (box-shadow) نشان داده می‌شود تا
  // توسط استایلِ inline خنثی نشود.
  const inputClass =
    "w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 transition-shadow";
  const inputStyle = {
    border: `1.5px solid ${COLORS.border}`,
    fontFamily: "Vazirmatn, sans-serif",
  };

  return (
    <div style={{ fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 top-6 z-[130] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-xl"
          style={{
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            minWidth: 240,
          }}
        >
          {toast.type === "success" ? <FiCheck size={16} /> : <FiAlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ─── تنظیمات فرایند ─── */}
      <div
        className="mb-5 rounded-2xl p-4 sm:p-5"
        style={{ background: "white", border: `1px solid ${COLORS.border}` }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <FiEdit3 size={15} style={{ color: COLORS.primary }} />
            تنظیمات فرایند
          </h2>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {isDirty && (
              <span
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold"
                style={{ background: "#fffbeb", color: "#b45309" }}
              >
                <FiAlertTriangle size={12} />
                تغییرات ذخیره نشده
              </span>
            )}
            <button
              type="button"
              onClick={() => saveRef.current?.()}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${COLORS.primary}, #0a5c37)` }}
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  در حال ذخیره...
                </>
              ) : (
                <>
                  <FiSave size={15} />
                  ذخیره فرایند
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="flow-name"
              className="mb-1.5 block text-xs font-bold"
              style={{ color: COLORS.muted }}
            >
              نام فرایند <span style={{ color: COLORS.primary }}>*</span>
            </label>
            <input
              id="flow-name"
              type="text"
              value={meta.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="مثلا: فرایند سفارش راکت تنیس"
            />
          </div>

          <div>
            <label
              htmlFor="flow-root-category"
              className="mb-1.5 block text-xs font-bold"
              style={{ color: COLORS.muted }}
            >
              دسته‌بندی ریشه <span style={{ color: COLORS.primary }}>*</span>
            </label>
            <select
              id="flow-root-category"
              value={meta.rootCategory}
              onChange={(e) => updateMeta({ rootCategory: e.target.value })}
              className={inputClass}
              style={inputStyle}
              disabled={loadingCats}
            >
              <option value="">
                {loadingCats ? "در حال بارگذاری..." : "انتخاب دسته‌بندی..."}
              </option>
              {categories.map((cat) => {
                const sportName = cat.sport?.name || cat.sport?.title;
                return (
                  <option key={cat._id} value={cat._id}>
                    {sportName ? `${cat.title} — ${sportName}` : cat.title}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="flow-description"
              className="mb-1.5 block text-xs font-bold"
              style={{ color: COLORS.muted }}
            >
              توضیحات (اختیاری)
            </label>
            <input
              id="flow-description"
              type="text"
              value={meta.description}
              onChange={(e) => updateMeta({ description: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="توضیح کوتاه..."
            />
          </div>

          <div className="flex items-center gap-2 sm:items-end sm:pb-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={meta.isActive}
              onClick={() => updateMeta({ isActive: !meta.isActive })}
              className="relative h-5 w-10 shrink-0 rounded-full transition-colors"
              style={{ background: meta.isActive ? COLORS.primary : COLORS.border }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                style={{ left: meta.isActive ? "calc(100% - 1.1rem)" : "2px" }}
              />
            </button>
            <span className="text-xs font-bold text-slate-700">فرایند فعال باشد</span>
          </div>
        </div>
      </div>

      {/* ─── مراحل ─── */}
      <OrderFlowBuilder
        initialFlow={initialFlow}
        categories={categories}
        onSave={handleSave}
        isSaving={isSaving}
        onRegisterSave={(fn) => {
          saveRef.current = fn;
        }}
        onDirtyChange={setIsDirty}
      />
    </div>
  );
}
