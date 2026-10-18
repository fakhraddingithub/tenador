"use client";

import Link from "next/link";
import { FiEdit3, FiEye, FiFileText, FiPlus } from "react-icons/fi";
import { brochureOwner } from "@/lib/brochureOwners";

const STATUS = {
  published: { label: "منتشرشده", className: "bg-green-50 text-green-700", note: (noun) => `این بروشور هم‌اکنون جای محتوای صفحه‌ی ${noun} را گرفته است.` },
  draft: { label: "پیش‌نویس", className: "bg-amber-50 text-amber-700", note: (noun) => `پیش‌نویس روی سایت دیده نمی‌شود؛ صفحه‌ی ${noun} مثل قبل است.` },
  none: { label: "بدون بروشور", className: "bg-gray-100 text-gray-600", note: (noun) => `تا وقتی بروشوری منتشر نشود، صفحه‌ی ${noun} دقیقاً مثل امروز باقی می‌ماند.` },
};

/**
 * کارتِ «بروشور صفحه» در فرمِ صاحب (برند، ورزش): یک دکمه به ویرایشگرِ بروشور.
 * بروشور جدا از فرمِ صاحبش ذخیره می‌شود، پس ورود به آن به ذخیره‌ی فرم وابسته
 * نیست — ولی صاحبِ ساخته‌نشده هنوز شناسه ندارد و دکمه غیرفعال می‌ماند.
 */
export default function BrochureCard({ owner, ownerId = null, status = null, className = "" }) {
  const config = brochureOwner(owner);
  const { noun } = config;
  const state = STATUS[status] || STATUS.none;
  const titleId = `${owner}-brochure-title`;
  return (
    <section aria-labelledby={titleId} className={`${className} space-y-3`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-gray-100 text-[var(--color-primary)]">
          <FiFileText aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-gray-900">
            بروشور صفحه {noun}
            <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${state.className}`}>{state.label}</span>
          </h2>
          <p className="mt-1 text-[11px] leading-6 text-gray-500">
            محتوای تمام‌صفحه‌ی {noun} با همان بلوک‌های مقاله. {state.note(noun)}
          </p>
        </div>
      </div>

      {ownerId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={config.editor(ownerId)}
            className="inline-flex items-center gap-2 rounded-[6px] bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            {status ? <><FiEdit3 aria-hidden="true" />ویرایش بروشور {noun}</> : <><FiPlus aria-hidden="true" />ساخت بروشور {noun}</>}
          </Link>
          {/* پیش‌نمایش بدونِ عبور از ویرایشگر. در زبانه‌ی تازه، تا فرمِ
              ذخیره‌نشده از دست نرود. فقط وقتی بروشوری هست که دیدنش معنا دارد. */}
          {status ? (
            <a
              href={config.preview(ownerId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[6px] border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <FiEye aria-hidden="true" />پیش‌نمایش
            </a>
          ) : null}
        </div>
      ) : (
        <p className="rounded-[6px] border border-dashed border-gray-300 px-4 py-3 text-[11px] font-bold text-gray-500">
          ابتدا {noun} را ذخیره کنید؛ پس از آن دکمه‌ی «ساخت بروشور {noun}» در همین بخش ظاهر می‌شود.
        </p>
      )}
    </section>
  );
}
