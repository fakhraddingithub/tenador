"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OrderFlowBuilder from "./OrderFlowBuilder";
import { FiArrowRight, FiCheck, FiAlertTriangle } from "react-icons/fi";

const COLORS = {
  primary: "#004225",
  secondary: "#c9a84c",
  border: "#e8e4df",
  muted: "#9c9189",
  bg: "#f5f3f0",
};

export default function OrderFlowForm({ initialFlow = null }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

  // فیلدهای اولیه فرم
  const [meta, setMeta] = useState({
    name: initialFlow?.name || "",
    description: initialFlow?.description || "",
    rootCategory: initialFlow?.rootCategory?._id || initialFlow?.rootCategory || "",
    isActive: initialFlow?.isActive !== undefined ? initialFlow.isActive : true,
  });

  const [graphData, setGraphData] = useState(null); // { nodes, edges }

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories || []);
        setLoadingCats(false);
      })
      .catch(() => setLoadingCats(false));
  }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

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
      showToast("success", initialFlow ? "فرایند با موفقیت ویرایش شد" : "فرایند با موفقیت ایجاد شد");
      setTimeout(() => router.push("/p-admin/admin-order-flows"), 1200);
    } catch (err) {
      showToast("error", err.message || "خطا در ذخیره");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl transition-all"
          style={{
            background: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            minWidth: 240,
          }}
        >
          {toast.type === "success" ? (
            <FiCheck size={16} />
          ) : (
            <FiAlertTriangle size={16} />
          )}
          {toast.msg}
        </div>
      )}

      {/* بخش تنظیمات اولیه */}
      <div
        className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4"
        style={{ background: "white", borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
            نام فرایند <span style={{ color: COLORS.primary }}>*</span>
          </label>
          <input
            type="text"
            value={meta.name}
            onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ border: `1.5px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
            placeholder="مثلا: فرایند سفارش راکت تنیس"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
            دسته‌بندی ریشه <span style={{ color: COLORS.primary }}>*</span>
          </label>
          <select
            value={meta.rootCategory}
            onChange={(e) => setMeta((m) => ({ ...m, rootCategory: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ border: `1.5px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
            disabled={loadingCats}
          >
            <option value="">
              {loadingCats ? "در حال بارگذاری..." : "انتخاب دسته‌بندی..."}
            </option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: COLORS.muted }}>
            توضیحات (اختیاری)
          </label>
          <input
            type="text"
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ border: `1.5px solid ${COLORS.border}`, fontFamily: "Vazirmatn, sans-serif" }}
            placeholder="توضیح کوتاه..."
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMeta((m) => ({ ...m, isActive: !m.isActive }))}
              className="w-10 h-5 rounded-full transition-all relative"
              style={{ background: meta.isActive ? COLORS.primary : COLORS.border }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: meta.isActive ? "calc(100% - 1.1rem)" : "2px" }}
              />
            </button>
            <span className="text-xs font-bold" style={{ color: "#334155" }}>
              فعال
            </span>
          </div>
        </div>
      </div>

      {/* گراف */}
      <div className="flex-1" style={{ minHeight: 560 }}>
        <OrderFlowBuilder
          initialFlow={initialFlow}
          categories={categories}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
