"use client";

/**
 * src/components/admin/orderFlow/FlowStepEditor.jsx
 *
 * ویرایشگرِ یک مرحله از فرایند سفارش.
 *   • دسکتاپ: دیالوگِ وسطِ صفحه
 *   • موبایل : شیتِ پایین‌چسبِ تمام‌عرض با اسکرولِ داخلی
 *
 * تغییرات بلافاصله روی state بیلدر اعمال می‌شوند (مثل پنلِ کناریِ قبلی)؛
 * ذخیره‌ی نهایی همچنان با دکمه‌ی «ذخیره فرایند» انجام می‌شود.
 */

import { useEffect, useRef, useState } from "react";
import AdminInput from "@/components/admin/AdminInput";
import {
  FiGrid,
  FiPlus,
  FiTool,
  FiX,
} from "react-icons/fi";
import { getNodeCategoryId } from "./FlowStepCard";

const BORDER = "#e8e4df";
const MUTED = "#9c9189";
const CATEGORY_COLOR = "#3b82f6";
const SERVICE_COLOR = "#8b5cf6";

const inputStyle = {
  border: `1px solid ${BORDER}`,
  fontFamily: "Vazirmatn, sans-serif",
  background: "#f8f9fb",
};

function Toggle({ checked, onChange, color, label, id }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        style={{ background: checked ? color : BORDER }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? "calc(100% - 1.1rem)" : "2px" }}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-xs font-bold text-slate-700">
        {label}
      </label>
    </div>
  );
}

/**
 * ردیفِ یک گزینه‌ی خدمت.
 * مقدارِ «تغییر قیمت» یک draft محلیِ رشته‌ای دارد تا بتوان علامتِ منفی را تایپ
 * کرد؛ چیزی که به state می‌رود همیشه یک عددِ معتبر است.
 */
function OptionRow({ option, index, onChange, onRemove }) {
  const [priceDraft, setPriceDraft] = useState(
    option.priceModifier ? String(option.priceModifier) : ""
  );

  const handlePrice = (e) => {
    const raw = e.target.value;
    setPriceDraft(raw);
    const parsed = Number(raw);
    onChange("priceModifier", raw === "" || !Number.isFinite(parsed) ? 0 : parsed);
  };

  return (
    <div className="rounded-xl p-2.5" style={{ background: "#f8f9fb", border: `1px solid ${BORDER}` }}>
      <div className="mb-2 flex items-center gap-1.5">
        <input
          type="text"
          value={option.label || ""}
          onChange={(e) => onChange("label", e.target.value)}
          className="flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ ...inputStyle, background: "#fff" }}
          placeholder="عنوان آپشن (مثلا: تنش ۲۵)"
          aria-label={`عنوان آپشن ${index + 1}`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50"
          aria-label={`حذف آپشن ${index + 1}`}
        >
          <FiX size={13} />
        </button>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={option.value || ""}
          onChange={(e) => onChange("value", e.target.value)}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ ...inputStyle, background: "#fff" }}
          placeholder="مقدار (مثلا: 25)"
          aria-label={`مقدار آپشن ${index + 1}`}
        />
        <AdminInput
          type="number"
          value={priceDraft}
          onChange={handlePrice}
          className="w-28 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ ...inputStyle, background: "#fff" }}
          placeholder="تغییر قیمت"
          aria-label={`تغییر قیمت آپشن ${index + 1}`}
        />
      </div>

      <p className="mt-1.5 text-[10px]" style={{ color: MUTED }}>
        تغییر قیمت (تومان): مثبت = افزایش، منفی = کاهش
      </p>
    </div>
  );
}

export default function FlowStepEditor({ node, categories = [], onUpdate, onClose }) {
  const isCategory = node.type === "category";
  const color = isCategory ? CATEGORY_COLOR : SERVICE_COLOR;
  const TypeIcon = isCategory ? FiGrid : FiTool;

  // با افزودن/حذفِ آپشن، ردیف‌ها دوباره mount می‌شوند تا draftهای محلی
  // (تغییر قیمت) با ایندکسِ جابه‌جاشده قاطی نشوند.
  const [optionsRevision, setOptionsRevision] = useState(0);

  const options = node.serviceOptions || [];

  const setOptions = (next) => onUpdate({ serviceOptions: next });

  const addOption = () => {
    setOptions([...options, { label: "", value: "", priceModifier: 0 }]);
    setOptionsRevision((r) => r + 1);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
    setOptionsRevision((r) => r + 1);
  };

  const updateOption = (index, field, value) => {
    setOptions(options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)));
  };

  // Escape برای بستن
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // قفلِ اسکرولِ صفحه تا شیتِ موبایل روی محتوا سُر نخورد.
  // عمداً جدا از افکتِ بالا و بدون وابستگی است: اگر با هر رندر دوباره اجرا شود،
  // مقدارِ «قبلی» همان "hidden" ذخیره می‌شود و صفحه بعد از بستن قفل می‌ماند.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // فوکوس را داخلِ دیالوگ ببر تا Tab از ابتدای صفحه شروع نکند
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      style={{ direction: "rtl" }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`ویرایش مرحله: ${node.label || "بدون عنوان"}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[86vh] sm:max-w-lg sm:rounded-2xl"
      >
        {/* دستگیره‌ی شیت — فقط موبایل */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* هدر */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: color }}
            >
              <TypeIcon size={13} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-800">
                ویرایش {isCategory ? "دسته‌بندی" : "خدمت"}
              </p>
              <p className="truncate text-[11px]" style={{ color: MUTED }}>
                {node.label || "بدون عنوان"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="بستن"
          >
            <FiX size={17} />
          </button>
        </div>

        {/* بدنه */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label
              htmlFor="step-label"
              className="mb-1.5 block text-xs font-bold"
              style={{ color: MUTED }}
            >
              عنوان نمایشی
            </label>
            <input
              id="step-label"
              type="text"
              value={node.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={inputStyle}
              placeholder="مثلا: انتخاب زه تنیس"
            />
            <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
              همین عنوان بالای مرحله به مشتری نشان داده می‌شود.
            </p>
          </div>

          <Toggle
            id="step-required"
            checked={Boolean(node.required)}
            onChange={(v) => onUpdate({ required: v })}
            color="var(--color-primary, #004225)"
            label="انتخاب اجباری"
          />

          {isCategory && (
            <>
              <div>
                <label
                  htmlFor="step-category"
                  className="mb-1.5 block text-xs font-bold"
                  style={{ color: MUTED }}
                >
                  دسته‌بندی مرتبط
                </label>
                <select
                  id="step-category"
                  value={getNodeCategoryId(node) || ""}
                  onChange={(e) => onUpdate({ categoryId: e.target.value || null })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={inputStyle}
                >
                  <option value="">انتخاب دسته‌بندی...</option>
                  {categories.map((cat) => {
                    const sportName = cat.sport?.name || cat.sport?.title;
                    return (
                      <option key={cat._id} value={cat._id}>
                        {sportName ? `${cat.title} — ${sportName}` : cat.title}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
                  محصولاتِ این دسته‌بندی در این مرحله به مشتری پیشنهاد می‌شوند.
                </p>
              </div>

              <Toggle
                id="step-variant"
                checked={Boolean(node.allowVariantSelection)}
                onChange={(v) => onUpdate({ allowVariantSelection: v })}
                color={CATEGORY_COLOR}
                label="انتخاب واریانت فعال باشد"
              />
            </>
          )}

          {!isCategory && (
            <>
              <div>
                <label
                  htmlFor="step-service-name"
                  className="mb-1.5 block text-xs font-bold"
                  style={{ color: MUTED }}
                >
                  نام خدمت
                </label>
                <input
                  id="step-service-name"
                  type="text"
                  value={node.serviceName || ""}
                  onChange={(e) => onUpdate({ serviceName: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={inputStyle}
                  placeholder="مثلا: زه‌کشی"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: MUTED }}>
                    آپشن‌ها ({options.length})
                  </span>
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-85"
                    style={{
                      background: `${SERVICE_COLOR}15`,
                      color: SERVICE_COLOR,
                      border: `1px solid ${SERVICE_COLOR}30`,
                    }}
                  >
                    <FiPlus size={12} />
                    افزودن آپشن
                  </button>
                </div>

                {options.length === 0 ? (
                  <div
                    className="rounded-xl py-5 text-center text-xs"
                    style={{ background: "#f8f9fb", color: MUTED, border: `1px dashed ${BORDER}` }}
                  >
                    هنوز آپشنی تعریف نشده
                  </div>
                ) : (
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <OptionRow
                        key={`opt-${optionsRevision}-${i}`}
                        option={opt}
                        index={i}
                        onChange={(field, value) => updateOption(i, field, value)}
                        onRemove={() => removeOption(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* فوتر */}
        <div
          className="shrink-0 px-5 py-3.5"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, var(--color-primary, #004225), #0a5c37)",
            }}
          >
            تمام
          </button>
          <p className="mt-2 text-center text-[10px]" style={{ color: MUTED }}>
            تغییرات پس از زدن دکمه‌ی «ذخیره فرایند» ماندگار می‌شوند.
          </p>
        </div>
      </div>
    </div>
  );
}
