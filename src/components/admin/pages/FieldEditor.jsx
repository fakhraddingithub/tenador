"use client";

import ImageUpload from "@/components/admin/ImageUpload";
import { ICON_NAMES } from "@/components/pages/iconMap";
import { FaPlus, FaTrash, FaArrowUp, FaArrowDown } from "react-icons/fa";

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15";

/**
 * FieldEditor — یک فیلدِ بلوک را بر اساس نوعش رندر می‌کند.
 * value و onChange(value) را می‌گیرد.
 */
export default function FieldEditor({ field, value, onChange, siblingValues }) {
  const label = (
    <label className="block text-xs font-bold text-gray-600 mb-1.5">
      {field.label}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div>
          {label}
          <input
            className={inputCls}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          {label}
          <textarea
            rows={3}
            className={`${inputCls} resize-y leading-7`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "select":
      return (
        <div>
          {label}
          <select
            className={inputCls}
            value={value ?? ""}
            onChange={(e) => {
              const opt = field.options.find(
                (o) => String(o.value) === e.target.value
              );
              onChange(opt ? opt.value : e.target.value);
            }}
          >
            {field.options.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "icon":
      return (
        <div>
          {label}
          <select
            className={inputCls}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— بدون آیکون —</option>
            {ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      );

    case "image":
      return (
        <div>
          {label}
          <ImageUpload
            value={value || ""}
            onChange={onChange}
            folder="pages"
            accept="image/*"
            className="!mb-0"
          />
        </div>
      );

    case "stringlist":
      return (
        <StringListEditor label={field.label} value={value || []} onChange={onChange} />
      );

    case "list":
      return (
        <ListEditor field={field} value={value || []} onChange={onChange} />
      );

    case "grid":
      return (
        <GridEditor
          field={field}
          value={value || []}
          onChange={onChange}
          columns={siblingValues?.[field.columnsKey] || []}
        />
      );

    default:
      return null;
  }
}

/* ─────────── لیستِ رشته‌ها (مثلاً ستون‌ها یا دسته‌بندی‌ها) ─────────── */
function StringListEditor({ label, value, onChange }) {
  const set = (i, v) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...value, ""]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} value={v} onChange={(e) => set(i, e.target.value)} />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-2.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              aria-label="حذف"
            >
              <FaTrash size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
      >
        <FaPlus size={10} /> افزودن
      </button>
    </div>
  );
}

/* ─────────── لیستِ آیتم‌های شیئی (کارت‌ها، گام‌ها، پرسش‌ها …) ─────────── */
function ListEditor({ field, value, onChange }) {
  const setItem = (i, item) => {
    const next = [...value];
    next[i] = item;
    onChange(next);
  };
  const setItemField = (i, key, v) => {
    setItem(i, { ...value[i], [key]: v });
  };
  const add = () => {
    const empty = {};
    field.itemFields.forEach((ff) => (empty[ff.key] = ""));
    onChange([...value, empty]);
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-2">{field.label}</label>
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-400">
                مورد {toFa(i + 1)}
              </span>
              <div className="flex items-center gap-1">
                <IconBtn onClick={() => move(i, -1)} disabled={i === 0}>
                  <FaArrowUp size={11} />
                </IconBtn>
                <IconBtn onClick={() => move(i, 1)} disabled={i === value.length - 1}>
                  <FaArrowDown size={11} />
                </IconBtn>
                <IconBtn onClick={() => remove(i)} danger>
                  <FaTrash size={11} />
                </IconBtn>
              </div>
            </div>
            <div className="space-y-2.5">
              {field.itemFields.map((ff) => (
                <FieldEditor
                  key={ff.key}
                  field={ff}
                  value={item[ff.key]}
                  onChange={(v) => setItemField(i, ff.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
      >
        <FaPlus size={10} /> افزودن مورد
      </button>
    </div>
  );
}

/* ─────────── جدول (ردیف‌ها هم‌تراز با ستون‌ها) ─────────── */
function GridEditor({ field, value, onChange, columns }) {
  const colCount = Math.max(1, columns.length || (value[0] ? value[0].length : 1));

  const normalizedRow = (row) => {
    const r = [...(row || [])];
    while (r.length < colCount) r.push("");
    return r.slice(0, colCount);
  };

  const setCell = (ri, ci, v) => {
    const next = value.map((row, idx) =>
      idx === ri ? normalizedRow(row).map((c, cci) => (cci === ci ? v : c)) : row
    );
    onChange(next);
  };
  const addRow = () => onChange([...value, Array(colCount).fill("")]);
  const removeRow = (ri) => onChange(value.filter((_, idx) => idx !== ri));

  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-2">{field.label}</label>
      <div className="space-y-2">
        {value.map((row, ri) => (
          <div key={ri} className="flex gap-2 items-center">
            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>
              {normalizedRow(row).map((cell, ci) => (
                <input
                  key={ci}
                  className={inputCls}
                  value={cell}
                  placeholder={columns[ci] || `ستون ${toFa(ci + 1)}`}
                  onChange={(e) => setCell(ri, ci, e.target.value)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeRow(ri)}
              className="px-2.5 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              aria-label="حذف ردیف"
            >
              <FaTrash size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
      >
        <FaPlus size={10} /> افزودن ردیف
      </button>
    </div>
  );
}

function IconBtn({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
        danger
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function toFa(n) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}
