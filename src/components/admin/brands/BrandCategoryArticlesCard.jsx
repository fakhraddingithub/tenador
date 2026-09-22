"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiEdit3, FiFileText, FiPlus } from "react-icons/fi";

/**
 * جعبه‌ی «مینی‌مقاله‌ی برند در هر دسته» — هم‌شکلِ جعبه‌ی بروشور: اینجا فقط
 * انتخاب و رفتن، و خودِ نوشتن روی صفحه‌ی اختصاصیِ همان دسته.
 *
 * مینی‌مقاله‌ی دسته جدا از فرمِ برند ذخیره می‌شود (endpointِ خودش)، پس ورود به
 * آن به ذخیره‌ی برند وابسته نیست — ولی برندِ ساخته‌نشده هنوز شناسه ندارد.
 */
export default function BrandCategoryArticlesCard({ brandId = null, entries = [], className = "" }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/category")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.categories || data?.data || [];
        setCategories(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // کارت‌های موجود: هر ورودیِ ذخیره‌شده، با نامِ دسته‌اش.
  const written = useMemo(() => {
    const byId = new Map(categories.map((item) => [String(item._id), item]));
    return (entries || [])
      .filter((entry) => entry?.category && (entry.blocks?.length ?? 0) > 0)
      .map((entry) => {
        const id = String(entry.category?._id || entry.category);
        const category = byId.get(id);
        return { id, count: entry.blocks.length, name: category?.title || category?.name || "دسته‌بندی" };
      });
  }, [entries, categories]);

  const written_ids = new Set(written.map((item) => item.id));
  const remaining = categories.filter((item) => !written_ids.has(String(item._id)));

  return (
    <section aria-labelledby="brand-category-articles-title" className={`${className} space-y-3`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-gray-100 text-[var(--color-primary)]">
          <FiFileText aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="brand-category-articles-title" className="text-sm font-extrabold text-gray-900">مینی مقاله برند در هر دسته</h2>
          <p className="mt-1 text-[11px] leading-6 text-gray-500">
            برای هر دسته یک مقاله‌ی جدا. هر کدام فقط روی صفحه‌ی همان برند در همان دسته دیده می‌شود.
          </p>
        </div>
      </div>

      {!brandId ? (
        <p className="rounded-[6px] border border-dashed border-gray-300 px-4 py-3 text-[11px] font-bold text-gray-500">
          ابتدا برند را ذخیره کنید؛ پس از آن می‌توانید برای هر دسته مقاله بسازید.
        </p>
      ) : (
        <>
          {written.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {written.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/p-admin/admin-brands/${brandId}/category-article/${item.id}`}
                    className="flex items-center gap-2 rounded-[6px] border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <FiEdit3 aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="mr-auto shrink-0 text-[10px] font-normal text-gray-400">{item.count.toLocaleString("fa-IR")} بلوک</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-gray-400">هنوز برای هیچ دسته‌ای مقاله‌ای ساخته نشده است.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="انتخاب دسته‌بندی برای مقاله تازه"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="min-w-44 rounded-[6px] border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">یک دسته‌بندی انتخاب کنید…</option>
              {remaining.map((item) => (
                <option key={item._id} value={item._id}>{item.title || item.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selected}
              onClick={() => router.push(`/p-admin/admin-brands/${brandId}/category-article/${selected}`)}
              className="inline-flex items-center gap-2 rounded-[6px] bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <FiPlus aria-hidden="true" />افزودن مقاله
            </button>
          </div>
        </>
      )}
    </section>
  );
}
