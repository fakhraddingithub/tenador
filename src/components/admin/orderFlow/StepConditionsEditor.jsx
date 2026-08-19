"use client";

import { FiEye, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  CONDITION_TYPES,
  CONDITION_TYPE_LABELS,
} from "@/lib/flowConditions";
import { getServiceOptions } from "@/lib/serviceConfig";

/**
 * تعریفِ شرط‌های نمایشِ یک مرحله.
 *
 * «این مرحله فقط وقتی به مشتری نشان داده شود که ...».
 * بدون شرط ⇒ مرحله همیشه دیده می‌شود (رفتارِ همه‌ی فرایندهای فعلی).
 *
 * فقط مراحلِ *قبلی* به‌عنوان مرجع پیشنهاد می‌شوند تا وابستگیِ حلقوی ساخته نشود؛
 * سرور هم همین را در validateNodeConditions دوباره بررسی می‌کند.
 *
 * props: { visibleWhen, previousSteps, onChange(nextVisibleWhen) }
 */

const BORDER = "#e8e4df";
const MUTED = "#9c9189";
const ACCENT = "#0ea5e9";

const inputStyle = {
  border: `1px solid ${BORDER}`,
  fontFamily: "Vazirmatn, sans-serif",
  background: "#fff",
};

const emptyState = { mode: "all", conditions: [] };

export default function StepConditionsEditor({
  visibleWhen,
  previousSteps = [],
  onChange,
}) {
  const state = {
    mode: visibleWhen?.mode === "any" ? "any" : "all",
    conditions: Array.isArray(visibleWhen?.conditions) ? visibleWhen.conditions : [],
  };

  const set = (next) => onChange(next);

  const addCondition = () => {
    const first = previousSteps[0];
    if (!first) return;
    set({
      ...state,
      conditions: [...state.conditions, { type: "answered", nodeId: first.id }],
    });
  };

  const updateCondition = (i, updates) =>
    set({
      ...state,
      conditions: state.conditions.map((c, j) => (j === i ? { ...c, ...updates } : c)),
    });

  const removeCondition = (i) =>
    set({ ...state, conditions: state.conditions.filter((_, j) => j !== i) });

  if (previousSteps.length === 0) {
    return (
      <div
        className="rounded-xl px-3 py-2.5 text-[10px]"
        style={{ background: "#f8f9fb", color: MUTED, border: `1px dashed ${BORDER}` }}
      >
        این اولین مرحله است، پس همیشه نمایش داده می‌شود. برای وابسته کردنِ یک مرحله،
        باید حداقل یک مرحله پیش از آن وجود داشته باشد.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: MUTED }}>
          <FiEye size={12} />
          شرطِ نمایش ({state.conditions.length})
        </span>
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-85"
          style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
        >
          <FiPlus size={12} />
          افزودن شرط
        </button>
      </div>

      {state.conditions.length === 0 ? (
        <div
          className="rounded-xl py-4 text-center text-[10px]"
          style={{ background: "#f8f9fb", color: MUTED, border: `1px dashed ${BORDER}` }}
        >
          بدونِ شرط — این مرحله همیشه به مشتری نشان داده می‌شود.
        </div>
      ) : (
        <div className="space-y-2">
          {state.conditions.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: MUTED }}>
                نمایش وقتی
              </span>
              <select
                value={state.mode}
                onChange={(e) => set({ ...state, mode: e.target.value })}
                className="rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                style={inputStyle}
              >
                <option value="all">همه‌ی شرط‌ها برقرار باشند</option>
                <option value="any">حداقل یکی از شرط‌ها برقرار باشد</option>
              </select>
            </label>
          )}

          {state.conditions.map((cond, i) => {
            const refStep = previousSteps.find((s) => s.id === cond.nodeId);
            const refOptions =
              refStep?.type === "service" ? getServiceOptions(refStep) : [];
            const selectedOption = refOptions.find((o) => o.key === cond.optionKey);

            return (
              <div
                key={i}
                className="space-y-1.5 rounded-xl p-2"
                style={{ background: "#fff", border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center gap-1.5">
                  <select
                    value={cond.nodeId || ""}
                    onChange={(e) =>
                      updateCondition(i, {
                        nodeId: e.target.value,
                        optionKey: null,
                        choiceKey: null,
                      })
                    }
                    aria-label={`مرحله‌ی مرجعِ شرط ${i + 1}`}
                    className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                    style={inputStyle}
                  >
                    {previousSteps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || "بدون عنوان"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeCondition(i)}
                    aria-label={`حذف شرط ${i + 1}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>

                <select
                  value={cond.type || "answered"}
                  onChange={(e) =>
                    updateCondition(i, {
                      type: e.target.value,
                      optionKey: null,
                      choiceKey: null,
                    })
                  }
                  aria-label={`نوعِ شرط ${i + 1}`}
                  className="w-full rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                  style={inputStyle}
                >
                  {CONDITION_TYPES.filter(
                    // «گزینه‌ی مشخص» فقط برای مرحله‌ی خدمت معنا دارد
                    (t) => t !== "choiceEquals" || refStep?.type === "service"
                  ).map((t) => (
                    <option key={t} value={t}>
                      {CONDITION_TYPE_LABELS[t] || t}
                    </option>
                  ))}
                </select>

                {cond.type === "choiceEquals" && (
                  <div className="flex gap-1.5">
                    <select
                      value={cond.optionKey || ""}
                      onChange={(e) =>
                        updateCondition(i, { optionKey: e.target.value, choiceKey: null })
                      }
                      aria-label={`آپشنِ شرط ${i + 1}`}
                      className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="">انتخاب آپشن...</option>
                      {refOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.title || o.key}
                        </option>
                      ))}
                    </select>

                    <select
                      value={cond.choiceKey || ""}
                      onChange={(e) => updateCondition(i, { choiceKey: e.target.value })}
                      aria-label={`گزینه‌ی شرط ${i + 1}`}
                      disabled={!selectedOption}
                      className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none disabled:opacity-50"
                      style={inputStyle}
                    >
                      <option value="">انتخاب گزینه...</option>
                      {(selectedOption?.choices || []).map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label || c.key}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.conditions.length > 0 && (
        <button
          type="button"
          onClick={() => set(emptyState)}
          className="mt-2 text-[10px] underline"
          style={{ color: MUTED }}
        >
          حذف همه‌ی شرط‌ها (همیشه نمایش داده شود)
        </button>
      )}
    </div>
  );
}
