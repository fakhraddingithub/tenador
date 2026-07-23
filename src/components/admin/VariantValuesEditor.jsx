"use client";

/**
 * src/components/admin/VariantValuesEditor.jsx
 *
 * ویرایشگرِ مقادیرِ یک ویژگیِ واریانت (مثلاً همه‌ی رنگ‌ها یا همه‌ی سایزها):
 *   - کشیدن‌ورها کردن برای تغییرِ ترتیب (drag & drop، با dnd-kit — همان کتابخانه‌ی
 *     مورد استفاده در بقیه‌ی پنل)
 *   - ویرایشِ درجای هر مقدار (دکمه‌ی ویرایش یا دابل‌کلیک). برای ویژگیِ چندواحدی
 *     همه‌ی واحدها هم‌زمان قابلِ ویرایش‌اند (واحدِ اصلی کلید را جابه‌جا می‌کند).
 *   - حذفِ مقدار با تأییدیه (SweetAlert)
 *
 * ترتیبی که ادمین اینجا می‌سازد همان ترتیبی است که در صفحه‌ی محصول نمایش داده
 * می‌شود، چون آرایه‌ی مقادیر مستقیماً منبعِ ساختِ واریانت‌هاست. → [[variantValueOps]]
 *
 * props:
 *   attr        آبجکتِ variantAttribute دسته { name, label, multiUnit, units }
 *   values      آرایه‌ی مقادیرِ فعلی (رشته‌ها) — منبعِ ترتیب
 *   variantMeta برای خواندنِ واحدهای چندواحدی
 *   onReorder   (attrName, newValues) => void
 *   onRename    (attrName, oldVal, newVal, newUnits?) => void
 *   onRemove    (attrName, val) => void
 */

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiMove, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import { showError, confirmDelete } from "@/lib/swal";

// دکمه‌ی آیکونیِ مربعی و به‌اندازه‌ی راحتِ لمس (border-radius 6px مطابقِ درخواست)
function IconButton({ children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-[6px] transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function SortableValueChip({
  attr,
  val,
  units,
  isEditing,
  draft,
  onDraftChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onRemove,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: val, disabled: isEditing });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const unitList = attr.units || [];

  // ── حالتِ ویرایش ──
  if (isEditing) {
    return (
      <span
        ref={setNodeRef}
        style={style}
        className="inline-flex flex-col gap-2 px-3 py-2.5 bg-white border-2 border-purple-400 rounded-[6px] shadow-md"
      >
        {attr.multiUnit ? (
          <div className="flex flex-col gap-2">
            {unitList.map((unit, ui) => (
              <label key={unit} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-16 shrink-0 font-medium">
                  {unit}
                  {ui === 0 && <span className="text-purple-500"> (اصلی)</span>}
                </span>
                <input
                  autoFocus={ui === 0}
                  type="text"
                  dir="ltr"
                  style={{ direction: "ltr", unicodeBidi: "isolate" }}
                  className="w-28 border border-gray-300 focus:border-purple-400 rounded-[6px] focus:outline-none text-sm px-2 py-1"
                  value={draft?.[unit] ?? ""}
                  onChange={(e) => onDraftChange({ ...draft, [unit]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onCommitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      onCancelEdit();
                    }
                  }}
                />
              </label>
            ))}
          </div>
        ) : (
          <input
            autoFocus
            type="text"
            dir="ltr"
            style={{ direction: "ltr", unicodeBidi: "isolate" }}
            className="w-36 border border-gray-300 focus:border-purple-400 rounded-[6px] focus:outline-none text-sm px-2 py-1.5"
            value={draft ?? ""}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            onBlur={onCommitEdit}
          />
        )}

        <div className="flex items-center justify-end gap-1.5">
          <IconButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCommitEdit}
            className="bg-green-100 text-green-700 hover:bg-green-200"
            title="ذخیره"
            aria-label="ذخیره"
          >
            <FiCheck size={16} />
          </IconButton>
          <IconButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancelEdit}
            className="bg-gray-100 text-gray-500 hover:bg-gray-200"
            title="انصراف"
            aria-label="انصراف"
          >
            <FiX size={16} />
          </IconButton>
        </div>
      </span>
    );
  }

  // ── حالتِ نمایش ──
  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-[6px] ${
        isDragging ? "opacity-60 ring-2 ring-purple-300" : ""
      }`}
    >
      {/* دستگیره‌ی جابه‌جایی */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex items-center justify-center w-6 h-8 text-purple-300 hover:text-purple-600 cursor-grab active:cursor-grabbing touch-none"
        title="جابه‌جایی"
        aria-label={`جابه‌جایی ${val}`}
      >
        <FiMove size={14} />
      </button>

      {/* برچسبِ مقدار — دابل‌کلیک برای ویرایش */}
      <span
        onDoubleClick={onStartEdit}
        className="cursor-text select-none font-medium text-sm"
        title="دابل‌کلیک برای ویرایش"
      >
        {attr.multiUnit && units ? (
          <span dir="ltr" className="inline-flex flex-wrap items-center gap-1">
            {(attr.units || []).map((unit) => (
              <span
                key={unit}
                className="inline-flex items-baseline gap-0.5 bg-white/70 border border-purple-200 rounded-[6px] px-1.5 py-0.5"
              >
                <span className="font-bold">{units[unit] ?? "—"}</span>
                <span className="text-[10px] text-purple-500">{unit}</span>
              </span>
            ))}
          </span>
        ) : (
          <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
            {val}
          </span>
        )}
      </span>

      {/* ویرایش */}
      <IconButton
        onClick={onStartEdit}
        className="text-purple-500 hover:bg-purple-100 hover:text-purple-800"
        title="ویرایش مقدار"
        aria-label={`ویرایش ${val}`}
      >
        <FiEdit2 size={15} />
      </IconButton>

      {/* حذف */}
      <IconButton
        onClick={() => onRemove(attr.name, val)}
        className="text-gray-400 hover:bg-red-100 hover:text-red-600"
        title="حذف"
        aria-label={`حذف ${val}`}
      >
        <FiTrash2 size={15} />
      </IconButton>
    </span>
  );
}

export default function VariantValuesEditor({
  attr,
  values = [],
  variantMeta = {},
  onReorder,
  onRename,
  onRemove,
}) {
  const [editing, setEditing] = useState(null); // مقداری که در حالِ ویرایش است
  const [draft, setDraft] = useState(""); // رشته (تک‌واحدی) یا آبجکت { unit: value } (چندواحدی)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const unitsFor = (val) => variantMeta[attr.name]?.[val]?.units;
  const primaryUnit = (attr.units || [])[0];

  const startEdit = (val) => {
    setEditing(val);
    if (attr.multiUnit) {
      const cur = unitsFor(val) || {};
      const seed = {};
      for (const u of attr.units || []) seed[u] = cur[u] ?? "";
      // دادهٔ قدیمی بدونِ units: مقدارِ کلید همان واحدِ اصلی است، خالی نماند
      if (primaryUnit && !seed[primaryUnit]) seed[primaryUnit] = val;
      setDraft(seed);
    } else {
      setDraft(val); // مقدارِ اولیه (کلید)
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  const commitEdit = () => {
    if (editing == null) return;
    const oldVal = editing;

    if (attr.multiUnit) {
      const cur = unitsFor(oldVal) || {};
      const newUnits = {};
      for (const u of attr.units || []) newUnits[u] = (draft?.[u] ?? "").trim();
      const newPrimary = newUnits[primaryUnit];

      // واحدِ اصلی الزامی است (کلیدِ مقدار از آن ساخته می‌شود)
      if (!newPrimary) {
        showError("خطا", "مقدارِ واحدِ اصلی نمی‌تواند خالی باشد");
        return;
      }
      // بدونِ تغییر → انصراف
      const unchanged =
        newPrimary === oldVal &&
        (attr.units || []).every((u) => newUnits[u] === (cur[u] ?? ""));
      if (unchanged) {
        cancelEdit();
        return;
      }
      // مقدارِ اصلیِ تکراری → رد
      if (newPrimary !== oldVal && values.includes(newPrimary)) {
        showError("خطا", "این مقدار قبلاً اضافه شده است");
        return;
      }
      onRename(attr.name, oldVal, newPrimary, newUnits);
      cancelEdit();
      return;
    }

    const trimmed = (draft ?? "").trim();
    if (!trimmed || trimmed === oldVal) {
      cancelEdit();
      return;
    }
    if (values.includes(trimmed)) {
      showError("خطا", "این مقدار قبلاً اضافه شده است");
      return; // در حالتِ ویرایش می‌ماند تا ادمین اصلاح کند
    }
    onRename(attr.name, oldVal, trimmed);
    cancelEdit();
  };

  // حذف با تأییدیه‌ی SweetAlert
  const handleRemove = async (attrName, val) => {
    const ok = await confirmDelete(
      "حذفِ این مقدار؟",
      "این مقدار و همه‌ی ترکیب‌های واریانتِ وابسته به آن حذف می‌شوند."
    );
    if (ok) onRemove(attrName, val);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = values.indexOf(active.id);
    const newIndex = values.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(attr.name, arrayMove(values, oldIndex, newIndex));
  };

  if (!values.length) {
    return (
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        <span className="text-xs text-gray-400 italic">هنوز مقداری اضافه نشده</span>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={values} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {values.map((val) => (
            <SortableValueChip
              key={val}
              attr={attr}
              val={val}
              units={unitsFor(val)}
              isEditing={editing === val}
              draft={draft}
              onDraftChange={setDraft}
              onStartEdit={() => startEdit(val)}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
