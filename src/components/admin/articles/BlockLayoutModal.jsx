"use client";

import { useEffect, useState } from "react";
import { FiAlignCenter, FiAlignLeft, FiAlignRight, FiChevronDown, FiChevronUp, FiMinus, FiRotateCcw, FiSmartphone, FiX } from "react-icons/fi";
import {
  BLOCK_MARGIN_KEYS, BLOCK_MARGIN_REM, BLOCK_WIDTHS, BLOCK_WIDTH_PCT,
  blockWidth, sanitizeArticleBlockLayout,
} from "@/lib/articleBlockLayout";
import { ARTICLE_BLOCKS, BLOCK_ACCENT_HINTS, BLOCK_SPACING_LABELS, BLOCK_STYLE_LABELS, BLOCK_TABLE_VARIANT_LABELS } from "./blockRegistry";
import { AdminPortal, inputClass } from "./blockUi";

/**
 * «ظاهر و چیدمانِ بلوک» در یک مودال.
 *
 * چیدمان و استایل دو چیزِ جدا در داده‌اند و اینجا هم جدا می‌مانند: هر کنترل
 * می‌داند کدام‌یک را عوض می‌کند و مودال هر دو را با هم *در لحظه‌ی تأیید* تحویل
 * می‌دهد. مقدارِ پیش‌فرض هرگز ذخیره نمی‌شود — همان قاعده‌ی sanitizeها — پس بلوکی
 * که چیزی تغییر نداده، دقیقاً مثلِ قبل (بدونِ کلیدِ layout/style) می‌ماند.
 *
 * نکته‌ی واکنش‌گرایی: درصدِ عرض به‌صورتِ پیش‌فرض فقط روی دسکتاپ اعمال می‌شود.
 * مودال این را صریح می‌گوید و کلیدِ «در موبایل هم حفظ شود» را کنارش می‌گذارد،
 * چون یک بلوکِ ۳۰٪ روی گوشی ستونی باریک و ناخواناست.
 */

const WIDTH_LABELS = { full: "تمام عرض", "1/2": "نصف عرض", "1/3": "یک‌سوم عرض", "2/3": "دو‌سوم عرض" };
const MARGIN_LABELS = { mt: "بالا", mb: "پایین", mr: "راست", ml: "چپ" };
const ALIGN_X = [
  { value: "right", label: "راست", icon: FiAlignRight },
  { value: "center", label: "وسط", icon: FiAlignCenter },
  { value: "left", label: "چپ", icon: FiAlignLeft },
];
const ALIGN_Y = [
  { value: "top", label: "بالا", icon: FiChevronUp },
  { value: "center", label: "وسط", icon: FiMinus },
  { value: "bottom", label: "پایین", icon: FiChevronDown },
];

const Section = ({ title, hint, children }) => (
  <section className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: "var(--admin-border)" }}>
    <h4 className="mb-2 text-[11px] font-black text-gray-500">{title}</h4>
    {children}
    {hint ? <p className="mt-1.5 text-[10px] leading-5 text-gray-400">{hint}</p> : null}
  </section>
);

/** دکمه‌های انتخابِ یکی-از-چند؛ حالتِ فعال با رنگِ اصلی مشخص است. */
const Choice = ({ options, value, onChange, ariaLabel }) => (
  <div role="group" aria-label={ariaLabel} className="flex gap-1.5">
    {options.map((option) => {
      const Icon = option.icon;
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={active}
          className={`flex flex-1 items-center justify-center gap-1 border px-2 py-2 text-[11px] font-bold transition-colors ${active ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "text-gray-500 hover:border-[var(--color-primary)]"}`}
          style={{ borderColor: active ? "var(--color-primary)" : "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
        >
          {Icon ? <Icon aria-hidden="true" /> : null}{option.label}
        </button>
      );
    })}
  </div>
);

/** عدد + لغزنده، با واحدِ صریح. خالی‌کردنِ فیلد یعنی «تنظیم نشده». */
function NumberField({ label, unit, value, onChange, min, max, step, placeholder = "پیش‌فرض" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-gray-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
          className={`${inputClass} px-2 py-1.5 text-xs`}
        />
        <span className="shrink-0 text-[10px] text-gray-400">{unit}</span>
      </div>
    </label>
  );
}

/** شمای کوچکِ نتیجه: جعبه‌ی بلوک داخلِ سهمِ خودش، با همان درصد و همان جای‌گیری. */
function BoxPreview({ layout }) {
  const pct = layout.widthPct ?? 100;
  const justify = { right: "flex-start", center: "center", left: "flex-end" }[layout.alignX || "right"];
  const align = { top: "flex-start", center: "center", bottom: "flex-end" }[layout.alignY || "top"];
  return (
    <div className="border bg-gray-50 p-1.5" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
      <div className="flex h-12" style={{ justifyContent: justify, alignItems: align }} aria-hidden="true">
        <div
          className="rounded-sm bg-[var(--color-primary)]"
          style={{
            width: `${pct}%`,
            height: "60%",
            marginTop: `${(layout.mt || 0) * 2}px`,
            marginBottom: `${(layout.mb || 0) * 2}px`,
            marginRight: `${(layout.mr || 0) * 2}px`,
            marginLeft: `${(layout.ml || 0) * 2}px`,
          }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] text-gray-400">
        {pct.toLocaleString("fa-IR")}٪ عرض · {ALIGN_X.find((item) => item.value === (layout.alignX || "right"))?.label}
      </p>
    </div>
  );
}

export default function BlockLayoutModal({ type, style, layout, onApply, onClose }) {
  // نسخه‌ی محلی تا «انصراف» واقعاً چیزی را تغییر نداده باشد. کلیدِ بلوک در
  // فراخوان باعث می‌شود جابه‌جایی بینِ دو بلوک، وضعیتِ کهنه نیاورد.
  const [draft, setDraft] = useState(() => ({ ...(layout || {}) }));
  const [colors, setColors] = useState(() => ({ ...(style || {}) }));
  const keys = ARTICLE_BLOCKS[type]?.styleKeys || [];

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key, value) => setDraft((current) => {
    const next = { ...current };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    return next;
  });
  const setStyle = (key, value) => setColors((current) => {
    const next = { ...current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next;
  });

  const apply = () => {
    // همان پاک‌سازیِ سرور، همین‌جا: چیزی که ذخیره می‌شود دقیقاً همانی است که
    // بعداً از دیتابیس برمی‌گردد، پس مودال هرگز مقداری نشان نمی‌دهد که ذخیره نشده.
    onApply({
      layout: sanitizeArticleBlockLayout(draft),
      style: Object.keys(colors).length ? colors : undefined,
    });
    onClose();
  };

  const width = blockWidth({ layout: draft });
  const sharesRow = width !== "full";

  return (
    <AdminPortal>
      <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[6vh]" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ظاهر و چیدمان بلوک"
          onMouseDown={(event) => event.stopPropagation()}
          className="a-card w-full max-w-md shadow-xl"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
            <strong className="text-sm">ظاهر و چیدمان بلوک</strong>
            <span className="text-[11px] text-gray-400">{ARTICLE_BLOCKS[type]?.label || type}</span>
            <button type="button" onClick={onClose} className="mr-auto p-1 text-gray-400 hover:text-red-600" aria-label="بستن"><FiX /></button>
          </header>

          <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">
            <BoxPreview layout={draft} />

            <Section title="اندازه" hint="«سهم از سطر» تعیین می‌کند بلوک کنارِ بلوک‌های بعدی بنشیند؛ «عرض» اندازه‌ی خودِ بلوک داخلِ همان سهم است.">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-gray-500">سهم از سطر</span>
                  <select
                    value={width}
                    onChange={(event) => set("width", event.target.value === "full" ? undefined : event.target.value)}
                    className={`${inputClass} px-2 py-1.5 text-xs`}
                  >
                    {BLOCK_WIDTHS.map((item) => <option key={item} value={item}>{WIDTH_LABELS[item]}</option>)}
                  </select>
                </label>
                <NumberField
                  label="عرض بلوک"
                  unit="٪"
                  value={draft.widthPct}
                  onChange={(value) => set("widthPct", value)}
                  min={BLOCK_WIDTH_PCT.min}
                  max={BLOCK_WIDTH_PCT.max}
                  step={BLOCK_WIDTH_PCT.step}
                  placeholder="۱۰۰"
                />
              </div>
              <input
                type="range"
                aria-label="عرض بلوک به درصد"
                min={BLOCK_WIDTH_PCT.min}
                max={BLOCK_WIDTH_PCT.max}
                step={BLOCK_WIDTH_PCT.step}
                value={draft.widthPct ?? 100}
                onChange={(event) => set("widthPct", Number(event.target.value) === 100 ? undefined : Number(event.target.value))}
                className="mt-2 w-full accent-[var(--color-primary)]"
              />
            </Section>

            <Section title="فاصله (rem)" hint="هر طرف مستقل است. مقدارِ صریحِ بالا/پایین جای «فاصله بالا و پایین» را می‌گیرد؛ خالی یعنی همان پیش‌تنظیم.">
              <div className="grid grid-cols-4 gap-2">
                {BLOCK_MARGIN_KEYS.map((key) => (
                  <NumberField
                    key={key}
                    label={MARGIN_LABELS[key]}
                    unit=""
                    value={draft[key]}
                    onChange={(value) => set(key, value)}
                    min={BLOCK_MARGIN_REM.min}
                    max={BLOCK_MARGIN_REM.max}
                    step={BLOCK_MARGIN_REM.step}
                  />
                ))}
              </div>
              {keys.includes("spacing") ? (
                <label className="mt-2 block">
                  <span className="mb-1 block text-[10px] font-bold text-gray-500">{BLOCK_STYLE_LABELS.spacing}</span>
                  <select
                    value={colors.spacing || "none"}
                    onChange={(event) => setStyle("spacing", event.target.value === "none" ? undefined : event.target.value)}
                    className={`${inputClass} px-2 py-1.5 text-xs`}
                  >
                    {Object.entries(BLOCK_SPACING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              ) : null}
            </Section>

            <Section title="موقعیت افقی">
              <Choice options={ALIGN_X} value={draft.alignX || "right"} onChange={(value) => set("alignX", value === "right" ? undefined : value)} ariaLabel="موقعیت افقی بلوک" />
            </Section>

            <Section
              title="موقعیت عمودی"
              hint={sharesRow ? null : "وقتی بلوک تمام‌عرض است، سطری برای هم‌ترازیِ عمودی وجود ندارد — ابتدا «سهم از سطر» را کمتر از تمام‌عرض کنید."}
            >
              <div className={sharesRow ? "" : "opacity-40"}>
                <Choice options={ALIGN_Y} value={draft.alignY || "top"} onChange={(value) => set("alignY", value === "top" ? undefined : value)} ariaLabel="موقعیت عمودی بلوک" />
              </div>
            </Section>

            <Section title="واکنش‌گرا">
              <label className="flex items-start gap-2 text-[11px] font-bold text-gray-600">
                <input
                  type="checkbox"
                  checked={draft.keepOnMobile === true}
                  onChange={(event) => set("keepOnMobile", event.target.checked ? true : undefined)}
                  className="mt-0.5 size-4 accent-[var(--color-primary)]"
                />
                <span className="flex items-center gap-1">
                  <FiSmartphone aria-hidden="true" className="text-gray-400" />
                  عرض و فاصله‌ی کناری در موبایل هم حفظ شود
                  <span className="block font-normal text-gray-400">— پیش‌فرض: در موبایل تمام‌عرض می‌شود تا چیزی از صفحه بیرون نزند.</span>
                </span>
              </label>
            </Section>

            {keys.includes("tableVariant") || ["textColor", "background", "accent"].some((key) => keys.includes(key)) ? (
              <Section title="رنگ و ظاهر">
                {keys.includes("tableVariant") ? (
                  <label className="mb-2 block">
                    <span className="mb-1 block text-[10px] font-bold text-gray-500">{BLOCK_STYLE_LABELS.tableVariant}</span>
                    <select
                      value={colors.tableVariant || "default"}
                      onChange={(event) => setStyle("tableVariant", event.target.value === "default" ? undefined : event.target.value)}
                      className={`${inputClass} px-2 py-1.5 text-xs`}
                    >
                      {Object.entries(BLOCK_TABLE_VARIANT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  {["textColor", "background", "accent"].filter((key) => keys.includes(key)).map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-[10px] font-bold text-gray-500" title={key === "accent" ? BLOCK_ACCENT_HINTS[type] : undefined}>{BLOCK_STYLE_LABELS[key]}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={colors[key] || "#aa4725"}
                          onChange={(event) => setStyle(key, event.target.value)}
                          className="h-8 w-full cursor-pointer border bg-white"
                          style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
                          aria-label={BLOCK_STYLE_LABELS[key]}
                        />
                        {colors[key] ? (
                          <button type="button" onClick={() => setStyle(key, undefined)} className="shrink-0 p-1 text-gray-400 hover:text-red-600" aria-label={`حذف ${BLOCK_STYLE_LABELS[key]}`}><FiX /></button>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>

          <footer className="flex items-center gap-2 border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
            <button type="button" onClick={apply} className="px-4 py-2 text-xs font-bold text-white bg-[var(--color-primary)]" style={{ borderRadius: "var(--admin-radius)" }}>اعمال</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold border" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>انصراف</button>
            <button
              type="button"
              onClick={() => { setDraft({}); setColors({}); }}
              className="mr-auto flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-red-600"
            >
              <FiRotateCcw aria-hidden="true" />بازگشت به حالت پیش‌فرض
            </button>
          </footer>
        </div>
      </div>
    </AdminPortal>
  );
}
