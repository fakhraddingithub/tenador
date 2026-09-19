"use client";

import dynamic from "next/dynamic";
import { FiFileText } from "react-icons/fi";

const BlockEditor = dynamic(() => import("@/components/admin/articles/BlockEditor"), {
  loading: () => (
    <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400">
      در حال بارگذاری ویرایشگر بلوک‌ها...
    </div>
  ),
});

export default function BrandMiniArticleEditor({
  value = [],
  onChange,
  headingId = "brand-mini-article-title",
  title = "مینی مقاله صفحه برند",
  description = "این بلوک‌ها فقط زیر هدر صفحه اصلی برند نمایش داده می‌شوند. خالی گذاشتن این بخش باعث می‌شود هیچ سکشنی ساخته نشود.",
  className = "bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-gray-200/40",
  actions = null,
}) {
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <FiFileText aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-lg font-bold text-gray-800">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            {description}
          </p>
        </div>
        {actions}
      </div>

      <BlockEditor value={value} onChange={onChange} />
    </section>
  );
}
