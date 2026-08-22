"use client";

/**
 * src/components/admin/orderFlow/OrderFlowBuilder.jsx
 *
 * چیدمانِ مراحلِ فرایند سفارش — گریدِ کارت با جابه‌جاییِ کشیدنی.
 *
 * مدلِ داده دست‌نخورده است: ترتیبِ مراحل همان ترتیبِ آرایه‌ی `nodes` است.
 * `buildStepSequence` (src/lib/flowTraversal.js) وقتی هیچ لبه‌ای وجود ندارد،
 * دقیقاً همان ترتیبِ آرایه را برمی‌گرداند؛ پس آن‌چه ادمین در گرید می‌چیند همان
 * چیزی است که مشتری در مودالِ سفارش می‌بیند.
 *
 * فرایندهای قدیمی که لبه (edge) دارند: ترتیبِ اولیه‌ی کارت‌ها با همان
 * `buildStepSequence` ساخته می‌شود، یعنی دقیقاً دنباله‌ای که همین حالا به مشتری
 * نشان داده می‌شود. هنگام ذخیره لبه‌ها خالی می‌شوند و از آن پس ترتیبِ آرایه
 * تنها مرجع است — رفتارِ سمتِ مشتری تغییری نمی‌کند.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  FiAlertTriangle,
  FiGrid,
  FiLayers,
  FiSave,
  FiTool,
} from "react-icons/fi";

import { buildStepSequence } from "@/lib/flowTraversal";
import FlowStepCard, {
  FlowStepCardOverlay,
  FlowStepCardStatic,
  getStepWarning,
} from "./FlowStepCard";
import FlowStepEditor from "./FlowStepEditor";

const COLORS = {
  primary: "#004225",
  border: "#e8e4df",
  muted: "#9c9189",
  category: "#3b82f6",
  service: "#8b5cf6",
};

const GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

let _seq = 0;
const genId = () => `node_${Date.now()}_${++_seq}`;

/**
 * آیا hydration تمام شده؟ گریدِ sortable فقط بعد از آن رندر می‌شود (توضیحِ
 * دلیلش کنارِ FlowStepCardStatic). useSyncExternalStore انتخاب شده تا بدونِ
 * setState داخلِ effect به همان نتیجه برسیم.
 */
const subscribeNoop = () => () => {};
const useIsHydrated = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

/**
 * ترتیبِ اولیه‌ی کارت‌ها = دنباله‌ای که همین حالا به مشتری نشان داده می‌شود.
 * (idهای تکراری/خالی هم اصلاح می‌شوند تا drag & drop سالم بماند.)
 */
function readInitialSteps(initialFlow) {
  const sequence = buildStepSequence(initialFlow);
  const seen = new Set();
  return sequence.map((node, i) => {
    // fallbackِ قطعی (نه Date.now) تا سرور و کلاینت به یک id برسند
    const id = node.id && !seen.has(node.id) ? node.id : `node_fallback_${i}`;
    seen.add(id);
    return { ...node, id };
  });
}

export default function OrderFlowBuilder({
  initialFlow = null,
  categories = [],
  onSave,
  isSaving = false,
  onRegisterSave,
  onDirtyChange,
}) {
  const [steps, setSteps] = useState(() => readInitialSteps(initialFlow));
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const isHydrated = useIsHydrated();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // هر تغییری در مراحل = «ذخیره‌نشده»
  const markDirty = () => onDirtyChange?.(true);

  const commit = (updater) => {
    setSteps(updater);
    markDirty();
  };

  // ─── افزودن ───
  const addStep = (type) => {
    const id = genId();
    const step = {
      id,
      type,
      label: type === "category" ? "دسته‌بندی جدید" : "خدمت جدید",
      required: false,
      ...(type === "category"
        ? { categoryId: null, allowVariantSelection: true }
        : { serviceName: "", servicePrice: 0, options: [], serviceOptions: [] }),
    };
    commit((prev) => [...prev, step]);
    setEditingId(id); // بلافاصله باز شود تا مرحله‌ی خالی رها نماند
  };

  // ─── ویرایش ───
  const updateStep = (id, updates) =>
    commit((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));

  // ─── حذف ───
  const deleteStep = (id) => {
    commit((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
    setEditingId((cur) => (cur === id ? null : cur));
  };

  // ─── جابه‌جایی ───
  const moveStep = (id, offset) =>
    commit((prev) => {
      const from = prev.findIndex((s) => s.id === id);
      const to = from + offset;
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      return arrayMove(prev, from, to);
    });

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    commit((prev) => {
      const from = prev.findIndex((s) => s.id === active.id);
      const to = prev.findIndex((s) => s.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  };

  // ─── ذخیره ───
  // لبه‌ها عمداً خالی می‌روند: ترتیبِ آرایه تنها مرجعِ ترتیبِ مراحل است.
  const handleSave = () => onSave?.({ nodes: steps, edges: [] });

  // ثبتِ تابعِ ذخیره برای دکمه‌ی همیشه‌مرئیِ بالای صفحه (OrderFlowForm)
  useEffect(() => {
    onRegisterSave?.(handleSave);
  });

  const editingStep = steps.find((s) => s.id === editingId) || null;
  const deletingStep = steps.find((s) => s.id === deletingId) || null;
  const activeStep = steps.find((s) => s.id === activeId) || null;
  const activeIndex = steps.findIndex((s) => s.id === activeId);

  const categoryCount = steps.filter((s) => s.type === "category").length;
  const serviceCount = steps.filter((s) => s.type === "service").length;
  const requiredCount = steps.filter((s) => s.required).length;
  const warningCount = steps.filter((s) => getStepWarning(s, categories)).length;

  const announcements = {
    onDragStart: ({ active }) => `جابه‌جایی مرحله‌ی ${indexOfId(steps, active.id)} آغاز شد`,
    onDragOver: ({ active, over }) =>
      over
        ? `مرحله‌ی ${indexOfId(steps, active.id)} روی جایگاه ${indexOfId(steps, over.id)} قرار گرفت`
        : "",
    onDragEnd: ({ active, over }) =>
      over
        ? `مرحله‌ی ${indexOfId(steps, active.id)} به جایگاه ${indexOfId(steps, over.id)} منتقل شد`
        : "جابه‌جایی لغو شد",
    onDragCancel: () => "جابه‌جایی لغو شد",
  };

  return (
    <div style={{ fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}>
      {/* ─── نوار ابزار ─── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <FiLayers size={15} style={{ color: COLORS.primary }} />
            مراحل فرایند
            <span
              className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "#f1f5f9", color: "#64748b" }}
            >
              {steps.length}
            </span>
          </h2>
          <p className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>
            ترتیب کارت‌ها همان ترتیبی است که مشتری می‌بیند — با دستگیره‌ی بالای هر
            کارت جابه‌جا کنید.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => addStep("category")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-opacity hover:opacity-85 sm:flex-none"
            style={{
              background: `${COLORS.category}15`,
              color: COLORS.category,
              border: `1px solid ${COLORS.category}30`,
            }}
          >
            <FiGrid size={13} />
            افزودن دسته‌بندی
          </button>
          <button
            type="button"
            onClick={() => addStep("service")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-opacity hover:opacity-85 sm:flex-none"
            style={{
              background: `${COLORS.service}15`,
              color: COLORS.service,
              border: `1px solid ${COLORS.service}30`,
            }}
          >
            <FiTool size={13} />
            افزودن خدمت
          </button>
        </div>
      </div>

      {/* ─── گرید مراحل ─── */}
      {steps.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center"
          style={{ background: "#fff", border: `1px dashed ${COLORS.border}` }}
        >
          <div
            className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "#f8f9fb", color: COLORS.border }}
          >
            <FiLayers size={26} />
          </div>
          <p className="mb-1 text-sm font-bold text-gray-600">هنوز مرحله‌ای تعریف نشده</p>
          <p className="mb-5 text-xs" style={{ color: COLORS.muted }}>
            یک مرحله‌ی «دسته‌بندی» یا «خدمت» اضافه کنید تا فرایند ساخته شود
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => addStep("category")}
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-opacity hover:opacity-85"
              style={{
                background: `${COLORS.category}15`,
                color: COLORS.category,
                border: `1px solid ${COLORS.category}30`,
              }}
            >
              <FiGrid size={13} />
              افزودن دسته‌بندی
            </button>
            <button
              type="button"
              onClick={() => addStep("service")}
              className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-opacity hover:opacity-85"
              style={{
                background: `${COLORS.service}15`,
                color: COLORS.service,
                border: `1px solid ${COLORS.service}30`,
              }}
            >
              <FiTool size={13} />
              افزودن خدمت
            </button>
          </div>
        </div>
      ) : !isHydrated ? (
        // رندرِ سمتِ سرور و اولین رندرِ کلاینت — همان مارک‌آپ، بدون dnd-kit
        <div className={GRID_CLASS}>
          {steps.map((step, index) => (
            <FlowStepCardStatic
              key={step.id}
              node={step}
              index={index}
              total={steps.length}
              categories={categories}
            />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{ announcements }}
        >
          <SortableContext items={steps.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className={GRID_CLASS}>
              {steps.map((step, index) => (
                <FlowStepCard
                  key={step.id}
                  node={step}
                  index={index}
                  total={steps.length}
                  categories={categories}
                  onEdit={() => setEditingId(step.id)}
                  onDelete={() => setDeletingId(step.id)}
                  onMoveEarlier={() => moveStep(step.id, -1)}
                  onMoveLater={() => moveStep(step.id, 1)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
            {activeStep ? (
              <FlowStepCardOverlay
                node={activeStep}
                index={activeIndex}
                total={steps.length}
                categories={categories}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ─── خلاصه + ذخیره ─── */}
      {steps.length > 0 && (
        <div
          className="mt-5 flex flex-col gap-4 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between"
          style={{ background: "#fff", border: `1px solid ${COLORS.border}` }}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:gap-3">
            {[
              { label: "مرحله", value: steps.length, color: "#64748b" },
              { label: "دسته‌بندی", value: categoryCount, color: COLORS.category },
              { label: "خدمت", value: serviceCount, color: COLORS.service },
              { label: "اجباری", value: requiredCount, color: "#b45309" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-2 text-center lg:min-w-20"
                style={{ background: `${color}10`, border: `1px solid ${color}22` }}
              >
                <p className="text-sm font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-[10px] font-bold" style={{ color }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:justify-end">
            {warningCount > 0 && (
              <span
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold"
                style={{ background: "#fffbeb", color: "#b45309" }}
              >
                <FiAlertTriangle size={12} />
                {warningCount} مرحله پیکربندی ناقص دارد
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
      )}

      {/* ─── ویرایشگر مرحله ─── */}
      {editingStep && (
        <FlowStepEditor
          key={editingStep.id}
          node={editingStep}
          categories={categories}
          // فقط مراحلِ قبلی می‌توانند مرجعِ شرط باشند (جلوگیری از وابستگیِ حلقوی)
          previousSteps={steps.slice(0, steps.findIndex((s) => s.id === editingStep.id))}
          onUpdate={(updates) => updateStep(editingStep.id, updates)}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* ─── تایید حذف ─── */}
      {deletingStep && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeletingId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="تایید حذف مرحله"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
            style={{ border: `1px solid ${COLORS.border}` }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <FiAlertTriangle size={19} className="text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800">حذف مرحله</p>
                <p className="truncate text-xs" style={{ color: COLORS.muted }}>
                  {deletingStep.label || "بدون عنوان"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => deleteStep(deletingStep.id)}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
              >
                بله، حذف شود
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-xl py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-gray-50"
                style={{ border: `1px solid ${COLORS.border}` }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** شماره‌ی نمایشیِ یک مرحله (۱-based) برای پیام‌های دسترس‌پذیری. */
function indexOfId(steps, id) {
  const i = steps.findIndex((s) => s.id === id);
  return i === -1 ? "?" : i + 1;
}
