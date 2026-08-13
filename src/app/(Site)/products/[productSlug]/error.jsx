"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, ShoppingBag } from "lucide-react";

/**
 * مرزِ خطای مخصوصِ صفحه‌ی محصول.
 *
 * عمداً روی همین سگمنت است و نه روی گروهِ (Site): تنها مصرف‌کننده‌ی
 * getProductBySlug همین مسیر است، و یک error.jsx در سطحِ گروه خطای ده‌ها مسیرِ
 * بی‌ربط (مقاله‌ها، کالکشن‌ها، دستِ‌دوم، ورزشکاران، صفحات CMS) را هم می‌گرفت.
 *
 * از زمانی که product.service به‌جای return کردنِ خطا throw می‌کند، یک قطعیِ
 * لحظه‌ایِ دیتابیس به اینجا می‌رسد — قابلِ تلاشِ دوباره، به‌جای ۴۰۴ کش‌شده.
 */
export default function ProductError({ error, reset }) {
  useEffect(() => {
    console.error("product page error", error);
  }, [error]);

  return (
    <section
      dir="rtl"
      className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[var(--color-background)]"
    >
      <div className="max-w-xl w-full text-center">
        <h1 className="text-xl sm:text-2xl font-black text-[#0d0d0d] mb-3">
          نمایش این محصول با مشکل روبه‌رو شد
        </h1>
        <p className="text-sm sm:text-base text-gray-500 leading-7 mb-8 max-w-md mx-auto">
          مشکل معمولاً موقتی است. لطفاً دوباره تلاش کنید؛ اگر برطرف نشد کمی بعد
          سر بزنید.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold text-sm
              px-6 py-3 rounded-[6px] transition-all shadow-lg shadow-[#aa4725]/20 active:scale-95"
          >
            <RotateCw size={18} />
            تلاش دوباره
          </button>
          <Link
            href="/products"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              border-2 border-[#aa4725] text-[#aa4725] hover:bg-[#aa4725] hover:text-white
              font-bold text-sm px-6 py-3 rounded-[6px] transition-all active:scale-95"
          >
            <ShoppingBag size={18} />
            مشاهده محصولات
          </Link>
        </div>
      </div>
    </section>
  );
}
