"use client";

import Image from "next/image";
import { FaCheckCircle, FaCloudUploadAlt } from "react-icons/fa";

/**
 * خانه‌ی آپلودِ تصویرِ برند، هم‌ظاهر با فرمِ سری. فقط نما است: فایلِ انتخاب‌شده را
 * به onSelect می‌دهد و آپلود (پوشه‌ی brands، پیغام‌ها) همچنان در خودِ صفحه‌ی برند
 * انجام می‌شود — دقیقاً مثلِ UploadFieldِ قبلی.
 */
export default function BrandUploadField({ label, badge, url, loading, onSelect, square = false, aspect = "aspect-video" }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <span className="flex items-center justify-between gap-2 text-xs font-bold text-gray-500">
          {label}
          {badge}
        </span>
      ) : null}
      <label className={`group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[6px] border bg-gray-50 transition hover:border-[var(--color-primary)] ${square ? "aspect-square" : aspect} ${url ? "border-gray-200" : "border-dashed border-gray-300"}`}>
        {url ? (
          <>
            <Image
              src={url}
              alt={label || "پیش‌نمایش تصویر برند"}
              fill
              sizes={square ? "160px" : "(max-width: 1024px) 100vw, 480px"}
              className="object-contain p-2"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <FaCloudUploadAlt className="text-2xl text-white" />
            </span>
            {!loading ? (
              <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow">
                <FaCheckCircle size={10} />
              </span>
            ) : null}
          </>
        ) : loading ? (
          <span className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)]" />
        ) : (
          <span className="flex flex-col items-center gap-1 p-3 text-center text-gray-400 transition-colors group-hover:text-[var(--color-primary)]">
            <FaCloudUploadAlt className="text-2xl" />
            <span className="text-[11px] font-bold">انتخاب تصویر</span>
          </span>
        )}
        <input type="file" hidden accept="image/*" disabled={loading} onChange={(event) => onSelect(event.target.files[0])} />
      </label>
    </div>
  );
}
