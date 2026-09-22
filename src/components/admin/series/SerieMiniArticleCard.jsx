"use client";

import Link from "next/link";
import { FiEdit3, FiFileText, FiPlus } from "react-icons/fi";

/**
 * جعبه‌ی مینی‌مقاله‌ی سری در فرمِ سری — هم‌شکل و هم‌رفتارِ جعبه‌ی بروشورِ برند:
 * یک دکمه به ویرایشگرِ اختصاصی. مینی‌مقاله جدا از فرمِ سری ذخیره می‌شود، پس
 * ورود به آن به ذخیره‌ی سری وابسته نیست — ولی سریِ ساخته‌نشده شناسه ندارد.
 */
export default function SerieMiniArticleCard({ brandId = null, serieId = null, blockCount = 0, className = "" }) {
  const ready = Boolean(brandId && serieId);
  return (
    <section aria-labelledby="serie-mini-article-title" className={`${className} space-y-3`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-gray-100 text-[var(--color-primary)]">
          <FiFileText aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="serie-mini-article-title" className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-gray-900">
            مینی مقاله صفحه سری
            {blockCount > 0 ? (
              <span className="rounded-[6px] bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                {blockCount.toLocaleString("fa-IR")} بلوک
              </span>
            ) : (
              <span className="rounded-[6px] bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">بدون مقاله</span>
            )}
          </h2>
          <p className="mt-1 text-[11px] leading-6 text-gray-500">
            این بلوک‌ها فقط زیر هدرِ صفحه‌ی همین سری دیده می‌شوند — نه سریِ والد و نه زیرسری‌ها.
          </p>
        </div>
      </div>

      {ready ? (
        <Link
          href={`/p-admin/admin-brands/${brandId}/${serieId}/mini-article`}
          className="inline-flex items-center gap-2 rounded-[6px] bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
        >
          {blockCount > 0 ? <><FiEdit3 aria-hidden="true" />ویرایش مینی مقاله</> : <><FiPlus aria-hidden="true" />ساخت مینی مقاله</>}
        </Link>
      ) : (
        <p className="rounded-[6px] border border-dashed border-gray-300 px-4 py-3 text-[11px] font-bold text-gray-500">
          ابتدا سری را ذخیره کنید؛ پس از آن دکمه‌ی «ساخت مینی مقاله» در همین بخش ظاهر می‌شود.
        </p>
      )}
    </section>
  );
}
