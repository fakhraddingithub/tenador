"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiGitBranch,
  FiAlertTriangle,
  FiCheck,
  FiSearch,
} from "react-icons/fi";

const COLORS = {
  primary: "#004225",
  secondary: "#c9a84c",
  border: "#e8e4df",
  muted: "#9c9189",
  bg: "#f5f3f0",
  card: "#ffffff",
};

export default function OrderFlowsClient() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // flowId

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFlows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/order-flows");
      const data = await res.json();
      setFlows(data.flows || []);
    } catch {
      showToast("error", "خطا در دریافت فرایندها");
    }
    setLoading(false);
  };

  useEffect(() => { loadFlows(); }, []);

  const handleDelete = async (flowId) => {
    try {
      const res = await fetch(`/api/admin/order-flows/${flowId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFlows((prev) => prev.filter((f) => f._id !== flowId));
      showToast("success", "فرایند حذف شد");
    } catch {
      showToast("error", "خطا در حذف فرایند");
    }
    setDeleteConfirm(null);
  };

  const handleToggleActive = async (flow) => {
    try {
      const res = await fetch(`/api/admin/order-flows/${flow._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...flow, isActive: !flow.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setFlows((prev) =>
        prev.map((f) => (f._id === flow._id ? data.flow : f))
      );
      showToast("success", flow.isActive ? "فرایند غیرفعال شد" : "فرایند فعال شد");
    } catch {
      showToast("error", "خطا");
    }
  };

  const filtered = flows.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.rootCategory?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-xl"
          style={{ background: toast.type === "success" ? "#10b981" : "#ef4444", color: "white" }}
        >
          {toast.type === "success" ? <FiCheck size={16} /> : <FiAlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Modal حذف */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ background: "white", border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <FiAlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">حذف فرایند</p>
                <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
                  این عملیات قابل بازگشت نیست
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                بله، حذف شود
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-gray-50"
                style={{ border: `1px solid ${COLORS.border}`, color: "#334155" }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* هدر صفحه */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FiGitBranch size={20} style={{ color: COLORS.primary }} />
            فرایندهای سفارش
          </h1>
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
            گراف فرایند سفارش برای دسته‌بندی‌های مختلف را اینجا مدیریت کنید
          </p>
        </div>
        <Link
          href="/p-admin/admin-order-flows/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
          style={{ background: `linear-gradient(135deg, ${COLORS.primary}, #0a5c37)` }}
        >
          <FiPlus size={15} />
          فرایند جدید
        </Link>
      </div>

      {/* سرچ */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-5"
        style={{ background: "white", border: `1px solid ${COLORS.border}` }}
      >
        <FiSearch size={15} style={{ color: COLORS.muted }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو در فرایندها..."
          className="flex-1 text-sm bg-transparent focus:outline-none"
          style={{ fontFamily: "Vazirmatn, sans-serif" }}
        />
      </div>

      {/* لیست */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" style={{ borderTopColor: COLORS.primary }} />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "white", border: `1px dashed ${COLORS.border}` }}
        >
          <FiGitBranch size={40} className="mb-3" style={{ color: COLORS.border }} />
          <p className="font-bold text-gray-600 mb-1">
            {search ? "فرایندی یافت نشد" : "هنوز فرایندی تعریف نشده"}
          </p>
          <p className="text-xs" style={{ color: COLORS.muted }}>
            {!search && "با کلیک روی «فرایند جدید» شروع کنید"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((flow) => (
            <FlowCard
              key={flow._id}
              flow={flow}
              onToggle={handleToggleActive}
              onDelete={() => setDeleteConfirm(flow._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({ flow, onToggle, onDelete }) {
  const nodeCount = flow.nodes?.length || 0;
  const edgeCount = flow.edges?.length || 0;
  const catNodes = flow.nodes?.filter((n) => n.type === "category").length || 0;
  const srvNodes = flow.nodes?.filter((n) => n.type === "service").length || 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all hover:shadow-md"
      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
    >
      {/* نوار بالایی */}
      <div
        className="h-1.5"
        style={{
          background: flow.isActive
            ? `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`
            : "#e2e8f0",
        }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-sm text-gray-800 truncate">{flow.name}</h3>
              <span
                className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={
                  flow.isActive
                    ? { background: "#dcfce7", color: "#16a34a" }
                    : { background: "#f1f5f9", color: "#64748b" }
                }
              >
                {flow.isActive ? "فعال" : "غیرفعال"}
              </span>
            </div>
            {flow.rootCategory && (
              <p className="text-xs" style={{ color: COLORS.muted }}>
                دسته‌بندی: {flow.rootCategory.title}
              </p>
            )}
            {flow.description && (
              <p className="text-xs mt-1 truncate" style={{ color: COLORS.muted }}>
                {flow.description}
              </p>
            )}
          </div>
        </div>

        {/* آمار */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "نود", value: nodeCount, color: "#3b82f6" },
            { label: "دسته", value: catNodes, color: "#8b5cf6" },
            { label: "خدمت", value: srvNodes, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="text-center py-2 rounded-xl"
              style={{ background: `${color}10`, border: `1px solid ${color}20` }}
            >
              <p className="font-bold text-sm" style={{ color }}>
                {value}
              </p>
              <p className="text-[10px] font-bold" style={{ color }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* دکمه‌ها */}
        <div className="flex gap-2">
          <Link
            href={`/p-admin/admin-order-flows/edit/${flow._id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
            style={{
              background: `${COLORS.primary}12`,
              color: COLORS.primary,
              border: `1px solid ${COLORS.primary}25`,
            }}
          >
            <FiEdit2 size={12} />
            ویرایش گراف
          </Link>

          <button
            onClick={() => onToggle(flow)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:opacity-80"
            style={{
              background: flow.isActive ? "#fef3c715" : "#f0fdf415",
              border: `1px solid ${flow.isActive ? "#fde68a" : "#bbf7d0"}`,
              color: flow.isActive ? "#92400e" : "#166534",
            }}
            title={flow.isActive ? "غیرفعال کن" : "فعال کن"}
          >
            {flow.isActive ? <FiToggleRight size={15} /> : <FiToggleLeft size={15} />}
          </button>

          <button
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:opacity-80"
            style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#ef4444" }}
            title="حذف"
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
