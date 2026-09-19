"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { FiLayers, FiPlus, FiTrash2 } from "react-icons/fi";
import { useCategories } from "@/hooks/useAdminRefData";
import { getCategoryLabel } from "base/utils/categoryLabel";
import BrandMiniArticleEditor from "./BrandMiniArticleEditor";

const idOf = (value) => String(value?._id || value || "");

/**
 * One mini article per category for this brand (Brand.categoryArticles), shown
 * only on /[sport]/[category]/[brand]. `onChange` receives an updater function
 * (prev => next) so edits to different categories can never overwrite each
 * other with a stale array.
 */
export default function BrandCategoryArticlesEditor({ value = [], onChange, className = "bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-gray-200/40" }) {
  const { categories, isLoading } = useCategories();
  const [selected, setSelected] = useState("");

  const used = new Set(value.map((entry) => idOf(entry.category)));
  const available = categories.filter((category) => !used.has(String(category._id)));
  const labelOf = (categoryId) => {
    const category = categories.find((item) => String(item._id) === categoryId);
    return category ? getCategoryLabel(category) : isLoading ? "در حال بارگذاری..." : "دسته‌بندی حذف‌شده";
  };

  const add = () => {
    if (!selected) return;
    onChange((prev) =>
      prev.some((entry) => idOf(entry.category) === selected)
        ? prev
        : [...prev, { category: selected, blocks: [] }]
    );
    setSelected("");
  };

  const updateBlocks = (categoryId, blocks) =>
    onChange((prev) =>
      prev.map((entry) => (idOf(entry.category) === categoryId ? { ...entry, blocks } : entry))
    );

  const remove = async (categoryId, hasContent) => {
    if (hasContent) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "حذف مینی مقاله این دسته‌بندی؟",
        text: `مقاله «${labelOf(categoryId)}» پس از ذخیره برند حذف می‌شود. مقاله‌های دسته‌بندی‌های دیگر دست نمی‌خورند.`,
        showCancelButton: true,
        confirmButtonText: "حذف",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#dc2626",
      });
      if (!isConfirmed) return;
    }
    onChange((prev) => prev.filter((entry) => idOf(entry.category) !== categoryId));
  };

  return (
    <section
      aria-labelledby="brand-category-articles-title"
      className={`${className} space-y-6`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <FiLayers aria-hidden="true" />
        </span>
        <div>
          <h2 id="brand-category-articles-title" className="text-lg font-bold text-gray-800">
            مینی مقاله صفحات دسته‌بندی این برند
          </h2>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            برای هر دسته‌بندی یک مقاله جدا؛ فقط زیر هدر صفحه همان دسته‌بندی از این برند نمایش داده می‌شود (مثلاً راکت تنیس ویلسون). مقاله‌ی بدون بلوک ذخیره نمی‌شود.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="brand-category-article-select" className="sr-only">انتخاب دسته‌بندی</label>
        <select
          id="brand-category-article-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={isLoading || available.length === 0}
          className="min-w-0 flex-1 rounded-2xl border-2 border-transparent bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white disabled:opacity-60"
        >
          <option value="">
            {isLoading ? "در حال بارگذاری دسته‌بندی‌ها..." : available.length ? "یک دسته‌بندی انتخاب کنید" : "دسته‌بندی دیگری باقی نمانده"}
          </option>
          {available.map((category) => (
            <option key={category._id} value={category._id}>{getCategoryLabel(category)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!selected}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPlus aria-hidden="true" /> افزودن مقاله
        </button>
      </div>

      {value.map((entry) => {
        const categoryId = idOf(entry.category);
        const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
        return (
          <BrandMiniArticleEditor
            key={categoryId}
            headingId={`brand-category-article-${categoryId}`}
            title={`مینی مقاله: ${labelOf(categoryId)}`}
            description="فقط روی صفحه همین دسته‌بندی از این برند نمایش داده می‌شود."
            className="rounded-[2rem] border border-gray-100 bg-gray-50/60 p-4 md:p-6"
            value={blocks}
            onChange={(next) => updateBlocks(categoryId, next)}
            actions={
              <button
                type="button"
                onClick={() => remove(categoryId, blocks.length > 0)}
                aria-label={`حذف مینی مقاله ${labelOf(categoryId)}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50"
              >
                <FiTrash2 aria-hidden="true" />
              </button>
            }
          />
        );
      })}
    </section>
  );
}
