"use client";

import { useRef, useState } from "react";
import { FiImage, FiLoader, FiX } from "react-icons/fi";

/**
 * آپلودِ تصویرِ اختیاریِ یک آپشن/گزینه — نسخه‌ی بندانگشتی و درون‌خطی.
 *
 * از همان زیرساختِ موجود (POST /api/upload → ImageKit) استفاده می‌کند؛
 * فقط ظاهرش برای ردیف‌های فشرده‌ی ویرایشگر کوچک شده است.
 *
 * props: { value, onChange(url|null), size, label }
 */
export default function OptionImageInput({
  value,
  onChange,
  size = 44,
  label = "تصویر (اختیاری)",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // انتخابِ دوباره‌ی همان فایل هم رویداد بدهد
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("فقط تصویر مجاز است");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم تصویر باید کمتر از ۵ مگابایت باشد");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "order-flow");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || "آپلود ناموفق بود");
      }
      onChange(data.url);
    } catch (err) {
      setError(err.message || "آپلود ناموفق بود");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={value ? "تغییر تصویر" : label}
          title={value ? "تغییر تصویر" : label}
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white transition-colors hover:border-[var(--color-primary,#004225)] disabled:opacity-60"
        >
          {uploading ? (
            <FiLoader className="animate-spin text-gray-400" size={15} />
          ) : value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <FiImage className="text-gray-300" size={15} />
          )}
        </button>

        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="حذف تصویر"
            className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow"
          >
            <FiX size={9} />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />

      {error && <p className="mt-1 max-w-[7rem] text-[9px] text-red-500">{error}</p>}
    </div>
  );
}
