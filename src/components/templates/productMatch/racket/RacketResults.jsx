"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ProductCard from "@/components/modules/cart/ProductCard";
import { FiInfo, FiRepeat } from "react-icons/fi";

const QuickViewModal = dynamic(() => import("@/components/modules/cart/QuickViewModal"), {
  ssr: false,
});

const RANK_LABELS = ["بهترین انتخاب برای شما", "جایگزین ۱", "جایگزین ۲"];

/**
 * سه کارت در یک ردیف روی دسکتاپ. عرضِ ستون‌ها با max-w-5xl مهار می‌شود تا هر
 * کارت هم‌اندازهٔ کارت‌های محصول در بقیهٔ سایت باشد، نه کشیده در عرضِ صفحه.
 * روی موبایل تک‌ستونی و روی تبلت دوستونی می‌شود.
 * این ثابت در تست هم استفاده می‌شود تا چیدمان دوباره پهن نشود.
 */
export const RESULTS_GRID = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";

function RankRibbon({ rank, score }) {
  const isBest = rank === 0;
  return (
    <div
      className={
        "flex items-center justify-between rounded-t-[var(--radius)] px-3 py-2 text-[11px] font-extrabold " +
        (isBest
          ? "bg-[var(--color-primary)] text-white"
          : "bg-neutral-100 text-neutral-600")
      }
    >
      <span>{RANK_LABELS[rank]}</span>
      {Number.isFinite(score) && (
        <span className={isBest ? "text-[var(--color-secondary)]" : "text-neutral-500"}>
          سازگاری {Math.round(score).toLocaleString("fa-IR")}٪
        </span>
      )}
    </div>
  );
}

function ResultCard({ item, rate, onQuickView }) {
  const explanation = item.explanation || {};
  return (
    <article className="overflow-hidden rounded-[var(--radius)] border border-neutral-200 bg-white shadow-sm">
      <RankRibbon rank={item.rank} score={item.match?.score} />

      <div className="p-2">
        <ProductCard product={item} rate={rate} onQuickView={onQuickView} />
      </div>

      {(explanation.why?.length > 0 || item.tradeoff) && (
        <div className="border-t border-dashed border-neutral-200 bg-neutral-50/60 px-3.5 py-3">
          {explanation.why?.length > 0 && (
            <>
              <h4 className="mb-1.5 text-[11px] font-extrabold text-neutral-500">
                چرا این مناسب شماست
              </h4>
              <ul className="space-y-1">
                {explanation.why.map((line) => (
                  <li key={line} className="flex gap-1.5 text-[12px] leading-6 text-neutral-700">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {item.tradeoff?.text && (
            <p className="mt-2.5 flex gap-1.5 rounded-[var(--radius)] bg-[var(--color-secondary)]/15 px-2.5 py-2 text-[12px] leading-6 text-neutral-700">
              <FiRepeat className="mt-1 shrink-0 text-[var(--color-primary)]" size={13} />
              <span>
                <b className="font-extrabold">در مقایسه با گزینهٔ اول: </b>
                {item.tradeoff.text}
              </span>
            </p>
          )}

          {explanation.notes?.map((note) => (
            <p key={note} className="mt-2 text-[11px] text-neutral-400">
              {note}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[var(--radius)] border border-neutral-200 bg-white">
      <div className="h-8 bg-neutral-100" />
      <div className="p-2">
        <div className="aspect-square rounded bg-neutral-100" />
        <div className="mt-3 h-3 w-3/4 rounded bg-neutral-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
      </div>
    </div>
  );
}

/**
 * پنلِ زندهٔ نتایج. همیشه دقیقاً سه کارت نشان می‌دهد و هنگام محاسبهٔ مجدد،
 * نتیجهٔ قبلی را کم‌رنگ نگه می‌دارد تا هیچ‌وقت پرشِ «خالی» دیده نشود.
 */
export default function RacketResults({ result, loading, ready, hint }) {
  const [quickView, setQuickView] = useState(null);

  const items = result ? [result.best, ...(result.alternatives || [])].filter(Boolean) : [];
  const showSkeleton = loading && items.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-neutral-800">پیشنهاد زندهٔ ما</h2>
        {result?.confidence?.level && items.length > 0 && (
          <span
            className={
              "rounded-full px-2.5 py-1 text-[10px] font-extrabold " +
              (result.confidence.level === "high"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-amber-50 text-amber-600")
            }
          >
            {result.confidence.level === "high" ? "اطمینان بالا" : "اطمینان متوسط"}
          </span>
        )}
      </div>

      {hint && (
        <p className="flex gap-2 rounded-[var(--radius)] border border-[var(--color-secondary)]/50 bg-[var(--color-secondary)]/10 px-3 py-2.5 text-[12px] leading-6 text-neutral-700">
          <FiInfo className="mt-1 shrink-0 text-[var(--color-primary)]" size={14} />
          <span>{hint}</span>
        </p>
      )}

      {result?.relaxations?.map((note) => (
        <p
          key={note}
          className="rounded-[var(--radius)] border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[12px] leading-6 text-neutral-600"
        >
          {note}
        </p>
      ))}

      {!ready && items.length === 0 && !loading && (
        <div className="rounded-[var(--radius)] border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm leading-7 text-neutral-500">
          چند پرسش کوتاه را پاسخ دهید تا همین‌جا سه راکتِ متناسب با بازی شما ظاهر شود.
        </div>
      )}

      {showSkeleton && (
        <div className={RESULTS_GRID}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {items.length > 0 && (
        <div
          className={
            RESULTS_GRID +
            " transition-opacity duration-200 " +
            (loading ? "pointer-events-none opacity-50" : "opacity-100")
          }
        >
          {items.map((item) => (
            <ResultCard
              key={item._id}
              item={item}
              rate={result?.rate}
              onQuickView={() => setQuickView(item)}
            />
          ))}
        </div>
      )}

      {ready && !loading && result && items.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm leading-7 text-neutral-500">
          با این ترکیب از پاسخ‌ها راکتی در فروشگاه پیدا نکردیم. یکی از پاسخ‌ها — مثلاً
          شمارهٔ گریپ یا بودجه — را تغییر دهید.
        </div>
      )}

      <QuickViewModal
        product={quickView}
        isOpen={Boolean(quickView)}
        rate={result?.rate}
        onClose={() => setQuickView(null)}
      />
    </div>
  );
}
