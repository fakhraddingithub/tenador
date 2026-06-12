"use client";

/**
 * src/components/admin/SortableGridItem.jsx
 *
 * رپر عمومی drag & drop برای کارت‌های گرید ادمین (سری‌ها، زیرسری‌ها و ...).
 * یک دستگیره جابه‌جایی (همان آیکن منوی SortableBrandCard) روی کارت می‌گذارد و
 * بقیه کارت دست‌نخورده می‌ماند تا کلیک/ناوبری عادی کار کند.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiMenu } from "react-icons/fi";

export default function SortableGridItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "opacity-60 scale-[0.98] z-50" : ""}`}
    >
      {/* دستگیره جابه‌جایی */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="
          absolute top-4 right-4 z-30
          w-10 h-10 rounded-xl
          bg-white/80 backdrop-blur-md
          border border-gray-100 shadow-md
          flex items-center justify-center
          text-gray-600
          cursor-grab active:cursor-grabbing
          hover:bg-[var(--color-primary)] hover:text-white
          transition-all
        "
        aria-label="جابه‌جایی"
      >
        <FiMenu size={18} />
      </button>

      {children}
    </div>
  );
}
