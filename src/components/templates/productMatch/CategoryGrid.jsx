'use client';

import Link from 'next/link';
import { FiSearch, FiTarget } from 'react-icons/fi';
import { matchCategoryPath } from '@/lib/matchTools';

// شبکه دسته‌بندی‌ها برای شروع یافتن نزدیک‌ترین محصول
export default function CategoryGrid({ categories }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {categories.map((cat) => (
        <Link
          key={cat._id}
          href={matchCategoryPath(cat)}
          className="group relative overflow-hidden rounded-[6px] border border-neutral-100 bg-white shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 text-right"
        >
          <div className="relative w-full aspect-square overflow-hidden bg-neutral-900">
            <div
              className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-60 group-hover:opacity-90 group-hover:scale-125 transition-all duration-700"
              style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-14 -left-10 w-48 h-48 rounded-full blur-2xl opacity-40 group-hover:opacity-70 group-hover:scale-125 transition-all duration-700"
              style={{ background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)' }}
            />

            {cat.image ? (
              <img
                src={cat.image}
                alt={cat.title}
                className="relative z-[1] w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
              />
            ) : (
              <div className="relative z-[1] w-full h-full flex items-center justify-center text-white/30">
                {cat.icon ? (
                  <img src={cat.icon} alt="" className="w-12 h-12 object-contain opacity-70" />
                ) : (
                  <FiSearch size={32} />
                )}
              </div>
            )}
          </div>

          <div className="relative z-[2] p-4 flex flex-col gap-3">
            {/* نامِ ورزش کنارِ نامِ دسته می‌آید، وگرنه «راکت» تنیس و «راکت» پدل در
                این شبکه دقیقاً یک‌شکل دیده می‌شوند */}
            <div className="flex items-center gap-2 min-w-0">
              {cat.icon && <img src={cat.icon} alt="" className="w-6 h-6 object-contain shrink-0" />}
              <span className="min-w-0 flex flex-col">
                <span className="font-extrabold text-lg text-neutral-900 truncate tracking-tight leading-6">
                  {cat.title}
                </span>
                {cat.sportTitle && (
                  <span className="text-[11px] font-bold text-neutral-400 truncate">
                    {cat.sportTitle}
                  </span>
                )}
              </span>
            </div>
            <span className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-white bg-[var(--color-primary)] py-2.5 rounded-[6px] shadow-md shadow-[var(--color-primary)]/30 group-hover:shadow-lg group-hover:shadow-[var(--color-primary)]/50 transition-all duration-300">
              یافتن نزدیک‌ترین محصول
              <FiTarget size={12} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
