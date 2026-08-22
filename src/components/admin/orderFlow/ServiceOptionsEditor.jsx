"use client";

import { useRef, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiSliders,
  FiList,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import OptionImageInput from "./OptionImageInput";
import {
  formatNum,
  rangeDefaultValue,
  validateServiceOptions,
} from "@/lib/serviceConfig";

/**
 * ویرایشگرِ آپشن‌های قابلِ پیکربندیِ یک خدمت.
 *
 * هر آپشن: عنوان + نوعِ ورودی + مقادیر + قیمت + تصویر + توضیح.
 * نوعِ ورودی فعلاً choice و range است؛ افزودنِ نوعِ جدید = یک شاخه در
 * OptionBody اینجا و یک شاخه در resolveOption در src/lib/serviceConfig.js.
 *
 * props: { options, onChange(nextOptions) }
 */

const BORDER = "#e8e4df";
const MUTED = "#9c9189";
const SERVICE_COLOR = "#8b5cf6";

const inputStyle = {
  border: `1px solid ${BORDER}`,
  fontFamily: "Vazirmatn, sans-serif",
  background: "#fff",
};

const TYPE_META = {
  choice: { label: "انتخابی", Icon: FiList },
  range: { label: "بازه‌ای", Icon: FiSliders },
};

let keySeq = 0;
const genKey = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

const newChoice = () => ({
  key: genKey("c"),
  label: "",
  priceModifier: 0,
  image: null,
});

const newOption = () => ({
  key: genKey("opt"),
  title: "",
  description: "",
  inputType: "choice",
  required: false,
  image: null,
  choices: [newChoice()],
  // defaultValue: null یعنی «تعیین‌نشده» و به کمینه برمی‌گردد
  range: {
    min: 0,
    max: 10,
    step: 1,
    unit: "",
    defaultValue: null,
    basePrice: 0,
    pricePerStep: 0,
  },
});

/**
 * ورودیِ عددی با draftِ رشته‌ایِ محلی — تا بتوان «-» و «0.» و «۰٫۵» را
 * حین تایپ نگه داشت. چیزی که به state می‌رود همیشه عدد است.
 */
function NumField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
  allowFloat = true,
  // خالی گذاشتن = «تعیین‌نشده» (null) به‌جای صفر — برای مقدارِ پیش‌فرضِ بازه،
  // که صفرِ ناخواسته می‌تواند خارج از بازه و غیرقابلِ ذخیره باشد.
  allowEmpty = false,
}) {
  const [draft, setDraft] = useState(() =>
    value === 0 || value == null ? (value === 0 ? "0" : "") : formatNum(value)
  );

  const handle = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    const parsed = Number(raw);
    if (raw === "" || !Number.isFinite(parsed)) onChange(allowEmpty ? null : 0);
    else onChange(parsed);
  };

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-bold" style={{ color: MUTED }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={allowFloat ? "any" : "1"}
        value={draft}
        onChange={handle}
        placeholder={placeholder}
        className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
        style={inputStyle}
      />
    </label>
  );
}

/** «18000» → «18,000». ارقامِ لاتین (نه fa-IR) چون داخلِ فیلدِ تایپ است. */
function formatGrouped(input) {
  const s = String(input ?? "");
  const negative = s.trim().startsWith("-");
  const digits = s.replace(/[^\d]/g, "");
  if (digits === "") return negative ? "-" : "";
  return (negative ? "-" : "") + Number(digits).toLocaleString("en-US");
}

const unformat = (s) => {
  const n = Number(String(s).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * ورودیِ قیمت (تومان) با جداکننده‌ی سه‌رقمی.
 * type="text" است چون input[type=number] کاما را نمی‌پذیرد. پس از قالب‌بندیِ
 * دوباره، مکان‌نما بعد از همان تعداد رقمِ قبلی برمی‌گردد تا ویرایشِ وسطِ عدد نپرد.
 */
export function PriceField({ value, onChange, label, placeholder, className = "", ariaLabel }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(() => (value ? formatGrouped(value) : ""));

  const handle = (e) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/[^\d]/g, "").length;

    const next = formatGrouped(raw);
    setDraft(next);
    onChange(unformat(next));

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      let seen = 0;
      let pos = 0;
      while (pos < next.length && seen < digitsBefore) {
        if (/\d/.test(next[pos])) seen += 1;
        pos += 1;
      }
      el.setSelectionRange(pos, pos);
    });
  };

  const field = (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={draft}
      onChange={handle}
      placeholder={placeholder}
      aria-label={ariaLabel || label}
      className={`rounded-lg px-2.5 py-1.5 text-xs focus:outline-none ${className}`}
      style={{ ...inputStyle, textAlign: "right" }}
    />
  );

  if (!label) return field;
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold" style={{ color: MUTED }}>
        {label}
      </span>
      {field}
    </label>
  );
}

function ChoiceRow({ choice, index, onChange, onRemove, canRemove }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl p-2"
      style={{ background: "#fff", border: `1px solid ${BORDER}` }}
    >
      <OptionImageInput
        value={choice.image}
        onChange={(url) => onChange({ image: url })}
        size={40}
      />

      <div className="flex min-w-0 flex-1 gap-1.5">
        <input
          type="text"
          value={choice.label || ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={`گزینه ${index + 1} (مثلا: ۱.۲۵)`}
          aria-label={`عنوان گزینه ${index + 1}`}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={inputStyle}
        />
        <PriceField
          value={choice.priceModifier}
          onChange={(n) => onChange({ priceModifier: n })}
          placeholder="+ تومان"
          ariaLabel={`تغییر قیمت گزینه ${index + 1}`}
          className="w-24 shrink-0"
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`حذف گزینه ${index + 1}`}
        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 disabled:opacity-30"
      >
        <FiTrash2 size={12} />
      </button>
    </div>
  );
}

function OptionCard({
  option,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onMove,
}) {
  const meta = TYPE_META[option.inputType] || TYPE_META.choice;
  const { Icon } = meta;

  const patch = (updates) => onChange({ ...option, ...updates });
  const patchRange = (updates) =>
    onChange({ ...option, range: { ...option.range, ...updates } });

  const setChoice = (i, updates) =>
    patch({
      choices: option.choices.map((c, j) => (j === i ? { ...c, ...updates } : c)),
    });

  const summary =
    option.inputType === "range"
      ? `${formatNum(option.range?.min)}–${formatNum(option.range?.max)}${
          option.range?.unit ? ` ${option.range.unit}` : ""
        } · پیش‌فرض ${formatNum(rangeDefaultValue(option))}`
      : `${option.choices?.length || 0} گزینه`;

  return (
    <div className="rounded-xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
      {/* هدر — همیشه دیده می‌شود تا لیستِ بلند قابلِ مدیریت بماند */}
      <div className="flex items-center gap-1.5 p-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: SERVICE_COLOR }}
        >
          <Icon size={11} />
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-right"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-gray-800">
              {option.title?.trim() || `آپشن ${index + 1}`}
              {option.required && <span className="text-red-500"> *</span>}
            </span>
            <span className="block truncate text-[10px]" style={{ color: MUTED }}>
              {meta.label} · {summary}
            </span>
          </span>
          {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
        </button>

        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="انتقال به بالا"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-25"
        >
          <FiArrowUp size={12} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="انتقال به پایین"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-25"
        >
          <FiArrowDown size={12} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`حذف آپشن ${index + 1}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
        >
          <FiTrash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div
          className="space-y-3 px-2.5 pb-3 pt-1"
          style={{ borderTop: `1px dashed ${BORDER}` }}
        >
          <div className="flex items-start gap-2">
            <OptionImageInput
              value={option.image}
              onChange={(url) => patch({ image: url })}
              size={44}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="text"
                value={option.title || ""}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="عنوان آپشن (مثلا: تنش)"
                aria-label="عنوان آپشن"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                style={inputStyle}
              />
              <input
                type="text"
                value={option.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="توضیح کوتاه (اختیاری)"
                aria-label="توضیح آپشن"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[10px] font-bold" style={{ color: MUTED }}>
                نوع ورودی
              </span>
              <select
                value={option.inputType}
                onChange={(e) => patch({ inputType: e.target.value })}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                style={inputStyle}
              >
                <option value="choice">انتخابی (Choice)</option>
                <option value="range">بازه‌ای (Range)</option>
              </select>
            </label>

            <label className="mt-4 flex shrink-0 cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={Boolean(option.required)}
                onChange={(e) => patch({ required: e.target.checked })}
                className="h-3.5 w-3.5 accent-[var(--color-primary,#004225)]"
              />
              <span className="text-[11px] font-bold text-slate-700">اجباری</span>
            </label>
          </div>

          {option.inputType === "choice" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: MUTED }}>
                  گزینه‌ها ({option.choices?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={() => patch({ choices: [...(option.choices || []), newChoice()] })}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold"
                  style={{
                    background: `${SERVICE_COLOR}15`,
                    color: SERVICE_COLOR,
                    border: `1px solid ${SERVICE_COLOR}30`,
                  }}
                >
                  <FiPlus size={10} />
                  گزینه
                </button>
              </div>

              {(option.choices || []).map((c, i) => (
                <ChoiceRow
                  key={c.key}
                  choice={c}
                  index={i}
                  canRemove={(option.choices || []).length > 1}
                  onChange={(u) => setChoice(i, u)}
                  onRemove={() =>
                    patch({ choices: option.choices.filter((_, j) => j !== i) })
                  }
                />
              ))}

              <p className="text-[9px]" style={{ color: MUTED }}>
                تغییر قیمت (تومان): مثبت = افزایش، منفی = کاهش، خالی = بدون تغییر
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <NumField
                  label="کمینه"
                  value={option.range?.min}
                  onChange={(v) => patchRange({ min: v })}
                />
                <NumField
                  label="بیشینه"
                  value={option.range?.max}
                  onChange={(v) => patchRange({ max: v })}
                />
                <NumField
                  label="گام"
                  value={option.range?.step}
                  onChange={(v) => patchRange({ step: v })}
                  placeholder="0.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <NumField
                  label="مقدار پیش‌فرض"
                  value={option.range?.defaultValue}
                  onChange={(v) => patchRange({ defaultValue: v })}
                  placeholder={`خالی = ${formatNum(option.range?.min)}`}
                  allowEmpty
                />
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold" style={{ color: MUTED }}>
                    واحد
                  </span>
                  <input
                    type="text"
                    value={option.range?.unit || ""}
                    onChange={(e) => patchRange({ unit: e.target.value })}
                    placeholder="مثلا: kg"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <PriceField
                  label="قیمت پیش‌فرض (تومان)"
                  value={option.range?.basePrice}
                  onChange={(v) => patchRange({ basePrice: v })}
                  className="w-full"
                />
                <PriceField
                  label="افزوده به‌ازای هر گام"
                  value={option.range?.pricePerStep}
                  onChange={(v) => patchRange({ pricePerStep: v })}
                  className="w-full"
                />
              </div>

              <p className="text-[9px]" style={{ color: MUTED }}>
                گام می‌تواند اعشاری باشد (۰.۵ ، ۲.۵ ، ...). قیمت = قیمت پیش‌فرض +
                (تعداد گام‌های بالاتر از کمینه × افزوده‌ی هر گام).
              </p>
              <p className="text-[9px]" style={{ color: MUTED }}>
                این آپشن همیشه با مقدارِ پیش‌فرض ({formatNum(rangeDefaultValue(option))}
                {option.range?.unit ? ` ${option.range.unit}` : ""}) به سفارش اضافه
                می‌شود؛ مشتری تیکِ انتخاب نمی‌بیند و فقط در صورت تمایل مقدار را
                جابه‌جا می‌کند.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServiceOptionsEditor({ options = [], onChange }) {
  const [expandedKey, setExpandedKey] = useState(null);

  const errors = validateServiceOptions(options);

  const add = () => {
    const o = newOption();
    onChange([...options, o]);
    setExpandedKey(o.key);
  };

  const update = (i, next) => onChange(options.map((o, j) => (j === i ? next : o)));

  const remove = (i) => onChange(options.filter((_, j) => j !== i));

  const move = (i, offset) => {
    const to = i + offset;
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: MUTED }}>
          آپشن‌های خدمت ({options.length})
        </span>
        <button
          type="button"
          onClick={add}
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
          {options.map((o, i) => (
            <OptionCard
              key={o.key}
              option={o}
              index={i}
              total={options.length}
              expanded={expandedKey === o.key}
              onToggle={() => setExpandedKey((k) => (k === o.key ? null : o.key))}
              onChange={(next) => update(i, next)}
              onRemove={() => remove(i)}
              onMove={(offset) => move(i, offset)}
            />
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-xl bg-amber-50 p-2 text-[10px] text-amber-700">
          {errors.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
