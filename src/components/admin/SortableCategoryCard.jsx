"use client";

import { useRouter } from "next/navigation";
import { FaFolderOpen, FaBoxOpen, FaShapes } from "react-icons/fa";
import { FiEdit3, FiTrash2, FiMenu } from "react-icons/fi";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableCategoryCard({
  category,
  count,
  handleDelete,
}) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderColor: "#e8e4df",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() =>
        router.push(
          `/p-admin/admin-categories/category-products/${category._id}`,
        )
      }
      className={`
        group cursor-pointer bg-white rounded-2xl border overflow-hidden
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300
        ${isDragging ? "opacity-50 scale-[0.98] rotate-1 z-50" : ""}
      `}
    >
      {/* Image */}
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        {category.image ? (
          <img
            src={category.image}
            alt={category.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <FaShapes size={36} />
          </div>
        )}

        {/* Product count badge */}
        <div className="absolute top-3 left-3">
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
            style={{
              background:
                count > 0 ? "rgba(170,71,37,0.9)" : "rgba(0,0,0,0.5)",
              color: "white",
              backdropFilter: "blur(4px)",
            }}
          >
            <FaBoxOpen size={9} /> {count} محصول
          </span>
        </div>

        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="
            absolute top-3 right-3
            w-10 h-10
            rounded-xl
            bg-white/80 backdrop-blur-md
            border border-white/50
            shadow-md
            flex items-center justify-center
            text-gray-600
            cursor-grab active:cursor-grabbing
            hover:bg-[var(--color-primary)]
            hover:text-white
            transition-all
            z-20
          "
        >
          <FiMenu size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-[var(--radius)] overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
            {category.icon ? (
              <img
                src={category.icon}
                alt="icon"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <FaFolderOpen
                size={14}
                style={{ color: "var(--color-primary)" }}
              />
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-800 group-hover:text-[var(--color-primary)] transition-colors truncate">
            {category.title}
          </h3>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/p-admin/admin-categories/edit/${category._id}`);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius)] bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white font-bold text-xs transition-all"
          >
            <FiEdit3 size={13} /> ویرایش
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(category);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
