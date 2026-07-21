'use client';

import Link from 'next/link';
import { formatToman } from '@/lib/currency';
import { splitBilingualName } from './matchEngine';
import { FaArrowLeftLong } from 'react-icons/fa6';

// نام دوزبانه: خط فارسی، سپس خط انگلیسی
export function BilingualName({ name, className = '', centered = true }) {
  const { farsi, english } = splitBilingualName(name);
  return (
    <span className={`block ${centered ? 'text-center' : 'text-right'} ${className}`}>
      <span className="block leading-6 line-clamp-2">{farsi}</span>
      {english && (
        <span className="block text-xs text-neutral-500 mt-0.5 line-clamp-1" dir="ltr">
          {english}
        </span>
      )}
    </span>
  );
}

export function PriceTag({ priceToman, className = '' }) {
  if (priceToman === null || priceToman === undefined) return null; // نرخ ارز تنظیم نشده
  return (
    <div className={`text-sm font-extrabold text-[var(--color-primary)] ${className}`}>
      {priceToman > 0 ? `${formatToman(priceToman)} تومان` : 'ناموجود'}
    </div>
  );
}

// یک ردیف مشخصه: لیبل راست — «هدف ← مقدار کاندید» + پیل رنگی اختلاف، چپ
function SpecRow({ label, targetValue, value, delta }) {
  const rounded = Number.isFinite(delta) ? Math.round(delta * 10) / 10 : null;
  const pill =
    rounded === null
      ? null
      : rounded > 0
        ? { cls: 'bg-green-100 text-green-700', text: `${formatToman(rounded)}+ ↑` }
        : rounded < 0
          ? { cls: 'bg-red-100 text-red-700', text: `${formatToman(Math.abs(rounded))}− ↓` }
          : { cls: 'bg-neutral-100 text-neutral-500', text: '۰' };

  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0 group whitespace-nowrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-200 group-hover:bg-[var(--color-primary)] transition-colors shrink-0" />
        <span className="text-[11px] font-bold text-neutral-400 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
        <span className="text-xs text-neutral-400 tabular-nums">
          {Number.isFinite(targetValue) ? formatToman(targetValue) : '—'}
        </span>
        <span className="text-xs text-neutral-300"><FaArrowLeftLong /></span>
        <span className="text-sm font-extrabold text-neutral-800 tabular-nums">
          {Number.isFinite(value) ? formatToman(value) : '—'}
        </span>
        {pill && (
          <span className={`text-[10px] font-bold tabular-nums rounded-full px-2 py-0.5 ${pill.cls}`}>
            {pill.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MatchResultCard({ product, diffs, target, categoryStats }) {
  const productUrl = `/products/${product.slug || product._id}`;

  // میانگین امتیاز خود محصول روی محورهای دسته — محور بدون مقدار حساب نمی‌شود
  const values = categoryStats
    .map((s) => product.technicalStats?.[s.name])
    .filter((v) => Number.isFinite(v));
  const avgScore = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

  return (
    <div className="relative rounded-[var(--radius)] border border-neutral-100 bg-white shadow-sm hover:shadow-md transition flex flex-col overflow-hidden">
      {avgScore !== null && (
        <span className="absolute top-3 right-3 z-[1] text-[11px] font-extrabold text-white bg-[var(--color-primary)] px-2.5 py-1 rounded-full shadow-sm">
        امتیاز: {formatToman(avgScore)}
        </span>
      )}

      <Link href={productUrl} className="block">
        <div className="w-full aspect-square bg-neutral-50 overflow-hidden">
          <img
            src={product.mainImage || '/placeholder.png'}
            alt={product.name}
            className="w-full h-full object-contain p-3 hover:opacity-90 hover:scale-105 transition-all duration-500"
          />
        </div>
      </Link>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <Link href={productUrl} className="hover:text-[var(--color-primary)] transition-colors">
          <BilingualName name={product.name} className="font-bold text-sm text-neutral-800" />
        </Link>

        <PriceTag priceToman={product.priceToman} className="text-center" />

        <div className="mt-auto pt-2 border-t border-dashed border-neutral-100">
          {categoryStats.map((stat) => (
            <SpecRow
              key={stat.name}
              label={stat.label}
              targetValue={target?.[stat.name]}
              value={product.technicalStats?.[stat.name]}
              delta={diffs?.[stat.name]}
            />
          ))}
        </div>

        <Link
          href={productUrl}
          className="mt-2 w-full text-center text-sm font-bold text-white bg-[var(--color-primary)] py-2.5 rounded-[var(--radius)] hover:opacity-90 transition-opacity"
        >
          مشاهده محصول
        </Link>
      </div>
    </div>
  );
}
