"use client";

import Link from "next/link";
import { FiEdit3, FiFileText, FiPlus } from "react-icons/fi";

const STATUS = {
  published: { label: "منتشرشده", className: "bg-green-50 text-green-700", note: "این بروشور هم‌اکنون جای محتوای صفحه‌ی برند را گرفته است." },
  draft: { label: "پیش‌نویس", className: "bg-amber-50 text-amber-700", note: "پیش‌نویس روی سایت دیده نمی‌شود؛ صفحه‌ی برند مثل قبل است." },
  none: { label: "بدون بروشور", className: "bg-gray-100 text-gray-600", note: "تا وقتی بروشوری منتشر نشود، صفحه‌ی برند دقیقاً مثل امروز باقی می‌ماند." },
};

/**
 * جایگزینِ بخشِ «مینی مقاله صفحه برند» در فرمِ برند: یک دکمه به ویرایشگرِ بروشور.
 * بروشور جدا از فرمِ برند ذخیره می‌شود، پس ورود به آن به ذخیره‌ی برند وابسته
 * نیست — ولی برندِ ساخته‌نشده هنوز شناسه ندارد و دکمه غیرفعال می‌ماند.
 */
export default function BrandBrochureCard({ brandId = null, status = null, className = "" }) {
  const state = STATUS[status] || STATUS.none;
  return (
    <section aria-labelledby="brand-brochure-title" className={`${className} space-y-3`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-gray-100 text-[var(--color-primary)]">
          <FiFileText aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="brand-brochure-title" className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-gray-900">
            بروشور صفحه برند
            <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${state.className}`}>{state.label}</span>
          </h2>
          <p className="mt-1 text-[11px] leading-6 text-gray-500">
            محتوای تمام‌صفحه‌ی برند با همان بلوک‌های مقاله. {state.note}
          </p>
        </div>
      </div>

      {brandId ? (
        <Link
          href={`/p-admin/admin-brands/${brandId}/brochure`}
          className="inline-flex items-center gap-2 rounded-[6px] bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
        >
          {status ? <><FiEdit3 aria-hidden="true" />ویرایش بروشور برند</> : <><FiPlus aria-hidden="true" />ساخت بروشور برند</>}
        </Link>
      ) : (
        <p className="rounded-[6px] border border-dashed border-gray-300 px-4 py-3 text-[11px] font-bold text-gray-500">
          ابتدا برند را ذخیره کنید؛ پس از آن دکمه‌ی «ساخت بروشور برند» در همین بخش ظاهر می‌شود.
        </p>
      )}
    </section>
  );
}
