"use client";

/**
 * src/components/admin/VariantValuesEditor.jsx
 *
 * ویرایشگرِ مقادیرِ یک ویژگیِ واریانت (مثلاً همه‌ی رنگ‌ها یا همه‌ی سایزها):
 *   - کشیدن‌ورها کردن برای تغییرِ ترتیب (drag & drop، با dnd-kit — همان کتابخانه‌ی
 *     مورد استفاده در بقیه‌ی پنل)
 *   - ویرایشِ درجای هر مقدار (دابل‌کلیک یا دکمه‌ی مداد)
 *   - حذفِ مقدار
 *
 * ترتیبی که ادمین اینجا می‌سازد همان ترتیبی است که در صفحه‌ی محصول نمایش داده
 * می‌شود، چون آرایه‌ی مقادیر مستقیماً منبعِ ساختِ واریانت‌هاست. → [[variantValueOps]]
 *
 * props:
 *   attr        آبجکتِ variantAttribute دسته { name, label, multiUnit, units }
 *   values      آرایه‌ی مقادیرِ فعلی (رشته‌ها) — منبعِ ترتیب
 *   variantMeta برای نمایشِ برچسبِ چندواحدی (فقط خواندنی)
 *   onReorder   (attrName, newValues) => void
 *   onRename    (attrName, oldVal, newVal) => void
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
import { FiMenu, FiCheck, FiX } from "react-icons/fi";
import { showError } from "@/lib/swal";

function SortableValueChip({
  attr,
  val,
  display,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isEditing) {
    return (
      <span
        ref={setNodeRef}
        style={style}
        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-purple-300 rounded-full text-sm shadow-sm"
      >
        <input
          autoFocus
          type="text"
          dir="ltr"
          style={{ direction: "ltr", unicodeBidi: "isolate" }}
          className="w-28 border-0 focus:outline-none text-sm px-1"
          value={draft}
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
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCommitEdit}
          className="text-green-600 hover:text-green-700 leading-none"
          title="ذخیره"
        >
          <FiCheck size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCancelEdit}
          className="text-gray-400 hover:text-red-600 leading-none"
          title="انصراف"
        >
          <FiX size={14} />
        </button>
      </span>
    );
  }

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium ${
        isDragging ? "opacity-60 ring-2 ring-purple-300" : ""
      }`}
    >
      {/* دستگیره‌ی جابه‌جایی */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-purple-400 hover:text-purple-700 cursor-grab active:cursor-grabbing touch-none leading-none"
        title="جابه‌جایی"
        aria-label={`جابه‌جایی ${val}`}
      >
        <FiMenu size={13} />
      </button>

      {/* برچسبِ مقدار — دابل‌کلیک برای ویرایش */}
      <span
        dir="ltr"
        style={{ direction: "ltr", unicodeBidi: "isolate" }}
        onDoubleClick={onStartEdit}
        className="cursor-text select-none"
        title="دابل‌کلیک برای ویرایش"
      >
        {display}
      </span>

      {/* ویرایش */}
      <button
        type="button"
        onClick={onStartEdit}
        className="text-purple-400 hover:text-purple-700 text-xs leading-none"
        title="ویرایش مقدار"
        aria-label={`ویرایش ${val}`}
      >
        ✎
      </button>

      {/* حذف */}
      <button
        type="button"
        onClick={() => onRemove(attr.name, val)}
        className="text-purple-400 hover:text-red-600 font-bold leading-none"
        title="حذف"
        aria-label={`حذف ${val}`}
      >
        ×
      </button>
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
  const [draft, setDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const displayFor = (val) => {
    if (attr.multiUnit) {
      const u = variantMeta[attr.name]?.[val]?.units;
      if (u) {
        return (attr.units || []).map((unit) => `${u[unit] ?? "—"} ${unit}`).join(" / ");
      }
    }
    return val;
  };

  const startEdit = (val) => {
    setEditing(val);
    setDraft(val); // مقدارِ اولیه (کلیدِ اصلی) — چندواحدی هم بر اساسِ همین کلید rename می‌شود
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  const commitEdit = () => {
    if (editing == null) return;
    const trimmed = draft.trim();
    const oldVal = editing;
    // خالی یا بدونِ تغییر → انصراف
    if (!trimmed || trimmed === oldVal) {
      cancelEdit();
      return;
    }
    // تکراری → رد
    if (values.includes(trimmed)) {
      showError("خطا", "این مقدار قبلاً اضافه شده است");
      return; // در حالتِ ویرایش می‌ماند تا ادمین اصلاح کند
    }
    onRename(attr.name, oldVal, trimmed);
    cancelEdit();
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
              display={displayFor(val)}
              isEditing={editing === val}
              draft={draft}
              onDraftChange={setDraft}
              onStartEdit={() => startEdit(val)}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
