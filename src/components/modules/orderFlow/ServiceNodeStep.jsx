"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiAlertCircle, FiImage } from "react-icons/fi";
import { formatToman } from "@/lib/currency";
import {
  formatNum,
  getServiceOptions,
  rangeLabel,
  resolveOption,
} from "@/lib/serviceConfig";

/**
 * مرحله‌ی نود نوع "service" — پیکربندیِ آپشن‌های یک خدمت
 *
 * props:
 *  - node                نودِ فرایند { id, label, serviceName, options[] | serviceOptions[] }
 *  - value               انتخابِ فعلیِ این نود (یا undefined)
 *  - onChange            (selection) => void
 *  - showError           نمایشِ پیامِ اعتبارسنجی (پس از تلاش برای ادامه)
 *  - onIncompleteChange  (bool) => void — آپشنِ اجباریِ پیکربندی‌نشده وجود دارد؟
 *
 * شکلِ selection خروجی (همان چیزی که در سبد و سفارش ذخیره می‌شود):
 *  { nodeId, nodeType:'service', nodeLabel, serviceName,
 *    serviceConfig:[{ optionKey, title, inputType, choiceKey?|value?, unit?,
 *                     label, image, priceModifier }] }
 *
 * ⚠️ قیمتِ نمایش‌داده‌شده اینجا فقط پیش‌نمایش است؛ مرجعِ نهایی سرور است.
 * هر دو از src/lib/serviceConfig.js استفاده می‌کنند تا نتیجه یکی باشد.
 */
export default function ServiceNodeStep({
  node,
  value,
  onChange,
  showError = false,
  onIncompleteChange,
}) {
  const options = useMemo(() => getServiceOptions(node), [node]);

  // انتخاب‌های خام: optionKey → { choiceKey } | { value }
  const [picks, setPicks] = useState(() => {
    const initial = {};
    for (const c of value?.serviceConfig || []) {
      initial[c.optionKey] =
        c.choiceKey != null ? { choiceKey: String(c.choiceKey) } : { value: Number(c.value) };
    }
    // range بدون مقدار → کمینه به‌عنوان پیش‌فرض
    for (const o of options) {
      if (o.inputType === "range" && initial[o.key] === undefined) {
        initial[o.key] = { value: o.range.min };
      }
    }
    return initial;
  });

  const buildSelection = (nextPicks) => {
    const serviceConfig = [];
    for (const option of options) {
      const raw = nextPicks[option.key];
      if (raw === undefined) continue;
      const { entry } = resolveOption(option, raw);
      if (entry) serviceConfig.push(entry);
    }
    return {
      nodeId: node.id,
      nodeType: "service",
      nodeLabel: node.label ?? "",
      serviceName: node.serviceName ?? "",
      serviceConfig,
    };
  };

  const selection = buildSelection(picks);
  const configuredKeys = new Set(selection.serviceConfig.map((c) => c.optionKey));
  const missingRequired = options.filter(
    (o) => o.required && !configuredKeys.has(o.key)
  );

  const apply = (optionKey, raw) => {
    const next = { ...picks, [optionKey]: raw };
    setPicks(next);
    onChange(buildSelection(next));
  };

  // مقادیرِ پیش‌فرضِ range باید بدونِ دست‌زدنِ کاربر هم ثبت شوند
  const emitted = useRef(false);
  useEffect(() => {
    if (emitted.current) return;
    emitted.current = true;
    if (!value && selection.serviceConfig.length > 0) onChange(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onIncompleteChange?.(missingRequired.length > 0);
    return () => onIncompleteChange?.(false);
  }, [missingRequired.length, onIncompleteChange]);

  const totalAddon = selection.serviceConfig.reduce(
    (s, c) => s + (Number(c.priceModifier) || 0),
    0
  );

  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <StepHeader node={node} />
        <p className="py-8 text-center text-sm text-gray-400">
          گزینه‌ای برای این خدمت تعریف نشده است
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepHeader node={node} />

      {showError && missingRequired.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
          لطفاً {missingRequired.map((o) => `«${o.title}»`).join(" و ")} را انتخاب کنید
        </p>
      )}

      {/* دسکتاپ: دو آپشن در هر ردیف — موبایل: تک‌ستونی */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {options.map((option) =>
          option.inputType === "range" ? (
            <RangeOption
              key={option.key}
              option={option}
              raw={picks[option.key]}
              onPick={(raw) => apply(option.key, raw)}
            />
          ) : (
            <ChoiceOption
              key={option.key}
              option={option}
              raw={picks[option.key]}
              highlightMissing={showError && missingRequired.includes(option)}
              onPick={(raw) => apply(option.key, raw)}
            />
          )
        )}
      </div>

      {/* جمعِ افزوده‌ی این خدمت */}
      <div className="flex items-center justify-between rounded-[8px] border border-[#aa4725]/20 bg-[#aa4725]/[0.04] px-3.5 py-2.5">
        <span className="text-xs text-gray-600">افزوده‌ی این خدمت</span>
        <span className="text-sm font-bold text-[#aa4725]">
          {totalAddon === 0 ? "رایگان" : `+ ${formatToman(totalAddon)} تومان`}
        </span>
      </div>
    </div>
  );
}

function StepHeader({ node }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#0d0d0d]">{node.label}</h3>
      {node.serviceName && (
        <p className="text-xs text-gray-500 mt-1">{node.serviceName}</p>
      )}
    </div>
  );
}

function OptionHeader({ option, valueText }) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0d0d0d]">
          {option.title}
          {option.required && <span className="text-[#aa4725] mr-1">*</span>}
        </p>
        {option.description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
            {option.description}
          </p>
        )}
      </div>
      {valueText && (
        <span className="shrink-0 rounded-full bg-[#ffbf00]/20 px-2.5 py-1 text-xs font-bold text-[#aa4725]">
          {valueText}
        </span>
      )}
    </div>
  );
}

function priceLabel(m) {
  if (!m) return "بدون تغییر قیمت";
  const sign = m > 0 ? "+" : "−";
  return `${sign} ${formatToman(Math.abs(m))} تومان`;
}

/* ─── نوعِ Choice ─── */
function ChoiceOption({ option, raw, highlightMissing, onPick }) {
  const selectedKey = raw?.choiceKey ?? null;
  const hasImages = option.choices.some((c) => c.image);

  return (
    <div
      className={`rounded-[8px] border p-3.5 transition ${
        highlightMissing ? "border-red-300 bg-red-50/40" : "border-gray-200"
      }`}
    >
      <OptionHeader option={option} />

      {/* گزینه‌ها همیشه زیرِ هم — یکی در هر ردیف */}
      <div role="radiogroup" aria-label={option.title} className="flex flex-col gap-2">
        {option.choices.map((choice) => {
          const selected = selectedKey === choice.key;
          return (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick({ choiceKey: choice.key })}
              className={`relative flex w-full items-center gap-2.5 rounded-[8px] border p-2.5 text-right transition ${
                selected
                  ? "border-[#aa4725] bg-[#ffbf00]/10"
                  : "border-gray-200 hover:border-[#aa4725]/60 hover:bg-gray-50"
              }`}
            >
              {hasImages && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-gray-100 bg-gray-50">
                  {choice.image ? (
                    <img
                      src={choice.image}
                      alt={choice.label}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <FiImage className="h-4 w-4 text-gray-300" />
                  )}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[#0d0d0d]">
                  {choice.label}
                </span>
                <span
                  className={`mt-0.5 block text-[11px] ${
                    choice.priceModifier > 0
                      ? "text-[#aa4725]"
                      : choice.priceModifier < 0
                        ? "text-green-600"
                        : "text-gray-400"
                  }`}
                >
                  {priceLabel(choice.priceModifier)}
                </span>
              </span>

              {selected && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#aa4725]">
                  <FiCheck className="h-3 w-3 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── نوعِ Range ─── */
function RangeOption({ option, raw, onPick }) {
  const { min, max, step, unit } = option.range;
  const value = Number.isFinite(Number(raw?.value)) ? Number(raw.value) : min;
  const { entry } = resolveOption(option, { value });
  const addon = entry?.priceModifier ?? 0;

  return (
    <div className="rounded-[8px] border border-gray-200 p-3.5">
      <OptionHeader option={option} valueText={rangeLabel(value, unit)} />

      {option.image && (
        <img
          src={option.image}
          alt={option.title}
          loading="lazy"
          className="mb-3 h-20 w-full rounded-[6px] border border-gray-100 bg-gray-50 object-contain"
        />
      )}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onPick({ value: Number(e.target.value) })}
        aria-label={option.title}
        aria-valuetext={rangeLabel(value, unit)}
        dir="ltr"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#aa4725]"
      />

      {/* dir="ltr" لازم است: در چیدمانِ RTLِ سایت، justify-between ترتیب را برعکس
          می‌کند و کمینه سمتِ راست می‌افتد. اسلایدر هم ltr است، پس هر دو هم‌جهت‌اند:
          کمینه چپ، بیشینه راست. */}
      <div
        dir="ltr"
        className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400"
      >
        <span>{rangeLabel(min, unit)}</span>
        <span dir="rtl">گام: {formatNum(step)}</span>
        <span>{rangeLabel(max, unit)}</span>
      </div>

      <p
        className={`mt-2 text-[11px] ${
          addon > 0 ? "text-[#aa4725]" : addon < 0 ? "text-green-600" : "text-gray-400"
        }`}
      >
        {priceLabel(addon)}
      </p>
    </div>
  );
}
