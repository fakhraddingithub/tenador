"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX, FiChevronLeft, FiChevronRight, FiCheck, FiSettings, FiTag } from "react-icons/fi";
import { toast } from "react-toastify";
import { buildStepSequence } from "@/lib/flowTraversal";
import ServiceNodeStep from "./ServiceNodeStep";
import CategoryNodeStep from "./CategoryNodeStep";

/**
 * مودال مرحله‌به‌مرحله‌ی فرایند سفارش
 *
 * props:
 *  - isOpen        باز بودن مودال
 *  - onClose       بستن مودال (انصراف)
 *  - product       محصول در حال افزودن { _id, name, category, mainImage }
 *  - quantity      تعداد (پیش‌فرض ۱)
 *  - variantId     واریانت انتخاب‌شده‌ی محصول اصلی (اختیاری)
 *  - onConfirm     (flowSelections) => void | Promise  — هنگام تایید نهایی صدا زده می‌شود
 */
export default function OrderFlowModal({
  isOpen,
  onClose,
  product,
  quantity = 1,
  variantId = null,
  onConfirm,
  flow: flowProp = null, // فرایند از پیش واکشی‌شده (اختیاری) — از واکشی دوباره جلوگیری می‌کند
}) {
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState(flowProp);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState({}); // { [nodeId]: selection }
  const [submitting, setSubmitting] = useState(false);
  // نود جاری محصول واریانت‌دار دارد ولی واریانتش کامل نشده
  const [currentIncomplete, setCurrentIncomplete] = useState(false);
  // نمایش پیام اعتبارسنجی در مرحله‌ی جاری (پس از تلاش برای ادامه)
  const [showStepError, setShowStepError] = useState(false);

  // شناسه‌ی دسته‌بندی محصول (category ممکن است object یا string باشد)
  const categoryId = useMemo(() => {
    const cat = product?.category;
    if (!cat) return null;
    return typeof cat === "object" ? cat._id || cat.id : cat;
  }, [product]);

  // دنباله‌ی مرتب مراحل
  const steps = useMemo(() => (flow ? buildStepSequence(flow) : []), [flow]);
  const currentNode = steps[currentIndex] || null;
  const isLastStep = steps.length > 0 && currentIndex === steps.length - 1;

  // ─── تکمیل نهایی: صدا زدن onConfirm و بستن مودال ───
  const handleComplete = useCallback(
    async (flowSelections) => {
      setSubmitting(true);
      try {
        await onConfirm?.(flowSelections);
        onClose?.();
      } catch (err) {
        console.error("OrderFlowModal: confirm failed", err);
        toast.error("خطا در افزودن به سبد خرید");
      } finally {
        setSubmitting(false);
      }
    },
    [onConfirm, onClose]
  );

  // ─── واکشی فرایند هنگام باز شدن ───
  useEffect(() => {
    if (!isOpen) return;

    // اگر فرایند از بیرون داده شده، از مقدار اولیه‌ی state استفاده می‌شود (بدون واکشی)
    if (flowProp) return;

    if (!categoryId) return;

    let cancelled = false;
    const fetchFlow = async () => {
      setLoading(true);
      setFlow(null);
      setCurrentIndex(0);
      setSelections({});
      try {
        const res = await fetch(`/api/order-flows/category/${categoryId}`);
        const data = await res.json();
        if (cancelled) return;

        const fetchedFlow = data?.flow || null;
        const sequence = fetchedFlow ? buildStepSequence(fetchedFlow) : [];

        // اگر فرایندی نیست یا مرحله‌ای ندارد، مستقیماً بدون انتخاب تایید کن
        if (!fetchedFlow || sequence.length === 0) {
          await handleComplete([]);
          return;
        }
        setFlow(fetchedFlow);
      } catch (err) {
        console.error("OrderFlowModal: fetch flow failed", err);
        toast.error("خطا در بارگذاری مراحل سفارش");
        if (!cancelled) onClose?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFlow();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, categoryId, flowProp]);

  // با تغییر مرحله، وضعیت اعتبارسنجی ریست می‌شود
  useEffect(() => {
    setCurrentIncomplete(false);
    setShowStepError(false);
  }, [currentIndex]);

  if (!isOpen) return null;

  // ─── به‌روزرسانی انتخاب نود جاری ───
  const setSelectionFor = (nodeId, selection) => {
    setSelections((prev) => ({ ...prev, [nodeId]: selection }));
  };

  const currentSelection = currentNode ? selections[currentNode.id] : null;
  // دکمه‌ی «بعدی» وقتی فعال است که انتخاب کامل باشد، یا محصولی انتخاب شده ولی
  // واریانتش ناقص است (تا با کلیک، پیام اعتبارسنجی نمایش داده شود).
  const canProceed =
    !currentNode ||
    !currentNode.required ||
    Boolean(currentSelection) ||
    currentIncomplete;

  // ─── ناوبری ───
  const advance = () => {
    if (isLastStep) {
      finalize();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, steps.length - 1));
    }
  };

  const goNext = () => {
    // محصول انتخاب شده ولی واریانت کامل نشده → ادامه نده و پیام را نشان بده
    if (currentIncomplete) {
      setShowStepError(true);
      return;
    }
    advance();
  };

  const goBack = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  const skipStep = () => {
    if (currentNode) {
      setSelections((prev) => {
        const next = { ...prev };
        delete next[currentNode.id]; // رد کردن = حذف انتخاب
        return next;
      });
    }
    advance(); // رد کردن، اعتبارسنجی واریانت را دور می‌زند
  };

  // ─── تایید نهایی: ساخت آرایه‌ی انتخاب‌ها به ترتیب مراحل ───
  const finalize = async () => {
    const ordered = steps
      .map((node) => selections[node.id])
      .filter(Boolean);
    await handleComplete(ordered);
  };

  const progress =
    steps.length > 0 ? ((currentIndex + 1) / steps.length) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-[16px] sm:rounded-[8px] shadow-xl animate-scale-in flex flex-col h-[88vh] sm:h-[620px] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#0d0d0d] truncate">
              سفارش‌سازی محصول
            </h2>
            {product?.name && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{product.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors shrink-0"
            aria-label="بستن"
          >
            <FiX className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* ─── Progress ─── */}
        {!loading && steps.length > 0 && (
          <div className="px-5 pt-4 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>
                مرحله {currentIndex + 1} از {steps.length}
              </span>
              {currentNode && (
                <span className="flex items-center gap-1">
                  {currentNode.type === "service" ? (
                    <FiSettings className="w-3 h-3" />
                  ) : (
                    <FiTag className="w-3 h-3" />
                  )}
                  {currentNode.required ? (
                    <span className="text-[#aa4725]">اجباری</span>
                  ) : (
                    <span className="text-gray-400">اختیاری</span>
                  )}
                </span>
              )}
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-[#aa4725] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ─── Body ─── */}
        <div className="px-5 py-5 overflow-y-auto grow flex flex-col min-h-0">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-md bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : currentNode ? (
            <StepBody
              key={currentNode.id}
              node={currentNode}
              value={currentSelection}
              onChange={(selection) => setSelectionFor(currentNode.id, selection)}
              showError={showStepError}
              onIncompleteChange={setCurrentIncomplete}
            />
          ) : null}
        </div>

        {/* ─── Footer / Navigation ─── */}
        {!loading && steps.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 shrink-0">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2.5 rounded-[6px] text-sm text-gray-600 hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronRight className="w-4 h-4" />
              قبلی
            </button>

            <div className="flex items-center gap-2">
              {currentNode && !currentNode.required && (
                <button
                  onClick={skipStep}
                  className="px-4 py-2.5 rounded-[6px] text-sm text-gray-500 hover:text-[#aa4725] hover:bg-gray-50 transition"
                >
                  رد کردن
                </button>
              )}
              <button
                onClick={goNext}
                disabled={!canProceed || submitting}
                className="flex items-center gap-1 px-5 py-2.5 rounded-[6px] bg-[#aa4725] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLastStep ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    {submitting ? "در حال افزودن..." : "تایید و افزودن به سبد"}
                  </>
                ) : (
                  <>
                    بعدی
                    <FiChevronLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * بدنه‌ی هر مرحله بر اساس نوع نود.
 */
function StepBody({ node, value, onChange, showError, onIncompleteChange }) {
  if (node.type === "service") {
    return <ServiceNodeStep node={node} value={value} onChange={onChange} />;
  }
  if (node.type === "category") {
    return (
      <CategoryNodeStep
        node={node}
        value={value}
        onChange={onChange}
        showError={showError}
        onIncompleteChange={onIncompleteChange}
      />
    );
  }
  return null;
}
