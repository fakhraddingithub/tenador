"use client";

import Link from "next/link";
import {
  FaEdit,
  FaTrash,
  FaGlobeAmericas,
  FaCalendarCheck,
} from "react-icons/fa";
import { FiMenu } from "react-icons/fi";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAdminPermissions } from "@/components/admin/AdminPermissionProvider";

/** وقتی مجوزِ باز کردنِ برند نیست، همان قاب بدون لینک رندر می‌شود. */
function LogoShell({ href, className, children }) {
  return href ? (
    <Link href={href} className={className}>{children}</Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export default function SortableBrandCard({ brand, handleDelete }) {
  const { can, canRoute } = useAdminPermissions();
  const detailHref = `/p-admin/admin-brands/${brand._id}`;
  const canOpen = canRoute(detailHref);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: brand._id,
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
      className={`
        group relative bg-white rounded-2xl border overflow-hidden
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300
        ${isDragging ? "opacity-50 scale-[0.98] rotate-1 z-50" : ""}
      `}
    >
      {/* Top accent */}
      <div className="h-1 w-full" style={{ background: "var(--color-primary)" }} />

      {/* Drag Handle — بدونِ brands.reorder رندر نمی‌شود */}
      {can("brands.reorder") && (
      <button
        {...attributes}
        {...listeners}
        className="
          absolute top-4 right-4
          w-10 h-10
          rounded-xl
          bg-white/80 backdrop-blur-md
          border border-gray-100
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
      )}

      {/* Logo */}
      {/* لینکِ نسبیِ قبلی (`admin-brands/${id}`) از صفحه‌های تودرتو مقصد اشتباه
          می‌ساخت؛ حالا مطلق است و با همان href مجوز سنجیده می‌شود. */}
      <LogoShell href={canOpen ? detailHref : null} className="block px-6 pt-7 pb-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden p-3 group-hover:scale-105 transition-transform">
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-200">
                {brand.name?.[0]}
              </span>
            )}
          </div>
        </div>
      </LogoShell>

      {/* Info */}
      <div className="px-6 pb-5">
        <h2 className="text-base font-bold text-gray-800 text-center mb-3 group-hover:text-[var(--color-primary)] transition-colors">
          {brand.name}
        </h2>
        <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <FaGlobeAmericas style={{ color: "var(--color-secondary)" }} />
            {brand.country || "Global"}
          </span>
          <span className="w-1 h-1 bg-gray-200 rounded-full" />
          <span className="flex items-center gap-1">
            <FaCalendarCheck style={{ color: "var(--color-secondary)" }} />
            {brand.foundedYear || "---"}
          </span>
        </div>

        {/* Actions */}
        {(can("brands.edit") || can("brands.delete")) && (
        <div className="flex gap-2">
          {can("brands.edit") && (
          <Link
            href={`/p-admin/admin-brands/edit/${brand._id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius)] text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all"
          >
            <FaEdit size={12} /> ویرایش
          </Link>
          )}
          {can("brands.delete") && (
          <button
            onClick={() => handleDelete(brand)}
            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius)] bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-100"
          >
            <FaTrash size={13} />
          </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
