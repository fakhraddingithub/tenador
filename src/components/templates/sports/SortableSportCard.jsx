"use client";

/**
 * SortableSportCard — کارت ورزش در پنل ادمین (فاز ۲).
 * تغییرات نسبت به فاز پیشین:
 *   • افزوده‌شدنِ دکمه‌ی «قهرمانان» که به /p-admin/admin-sports/[id]/athletes می‌رود.
 *   • رادیوس/رنگ‌ها از توکن‌های admin-scope (سبز درباری) استفاده می‌کنند.
 * منطق drag & drop و کلیک روی کارت (رفتن به دسته‌بندی‌ها) دست‌نخورده مانده است.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiEdit3,
  FiTrash2,
  FiActivity,
  FiMenu,
  FiUsers,
} from "react-icons/fi";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableSportCard({ sport, handleDelete }) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sport._id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const stop = (e) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => router.push(`/p-admin/admin-sports/${sport._id}`)}
      className={`
        group cursor-pointer bg-white border border-gray-100
        shadow-sm overflow-hidden transition-all duration-300
        hover:shadow-xl hover:-translate-y-1
        ${isDragging ? "opacity-50 scale-[0.98] rotate-1 z-50" : ""}
      `}
    >
      <style>{`
        .tenador-sport-card { border-radius: var(--admin-radius, var(--radius)); }
      `}</style>
      {/* تصویر اصلی */}
      <div className="relative h-44 bg-gray-200 overflow-hidden">
        {sport.image ? (
          <img
            src={sport.image}
            alt={sport.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <FiActivity size={40} />
          </div>
        )}

        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={stop}
          className="
            absolute top-3 left-3
            w-10 h-10
            bg-white/80 backdrop-blur-md
            border border-white/50 shadow-md
            flex items-center justify-center
            text-gray-600
            cursor-grab active:cursor-grabbing
            hover:bg-[var(--color-primary)] hover:text-white
            transition-all z-20
          "
          style={{ borderRadius: "var(--admin-radius)" }}
        >
          <FiMenu size={18} />
        </button>
      </div>

      {/* محتوا */}
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
            {sport.icon ? (
              <img src={sport.icon} alt={`${sport.name}-icon`} className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <FiActivity className="text-[var(--color-primary)]" />
            )}
          </div>
          <h3 className="text-xl font-bold group-hover:text-[var(--color-primary)] transition-colors truncate">
            {sport.name}
          </h3>
        </div>

        {/* اکشن‌ها — ردیف ۱: ویرایش + حذف */}
        <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
          <Link
            href={`/p-admin/admin-sports/edit/${sport._id}`}
            onClick={stop}
            className="
              flex-1 flex items-center justify-center gap-2
              py-2 bg-gray-50 text-gray-700
              hover:bg-[var(--color-secondary)] hover:text-black
              font-bold text-sm transition-all
            "
            style={{ borderRadius: "var(--admin-radius)" }}
          >
            <FiEdit3 size={16} />
            ویرایش
          </Link>

          <button
            onClick={(e) => { stop(e); handleDelete(sport._id); }}
            className="
              w-10 h-10 flex items-center justify-center
              bg-red-50 text-red-500
              hover:bg-red-500 hover:text-white
              transition-all shadow-sm
            "
            style={{ borderRadius: "var(--admin-radius)" }}
          >
            <FiTrash2 size={18} />
          </button>
        </div>

        {/* اکشن‌ها — ردیف ۲ (فاز ۲): قهرمانان همین ورزش */}
        <Link
          href={`/p-admin/admin-sports/${sport._id}/athletes`}
          onClick={stop}
          className="
            mt-2 flex items-center justify-center gap-2
            py-2 font-bold text-sm text-white
            hover:shadow-lg hover:shadow-[var(--color-primary)]/25
            hover:-translate-y-0.5 active:scale-95 transition-all
          "
          style={{
            background: "var(--color-primary)",
            borderRadius: "var(--admin-radius)",
          }}
        >
          <FiUsers size={15} />
          قهرمانان این ورزش
        </Link>
      </div>
    </div>
  );
}