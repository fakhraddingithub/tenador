"use client";

/**
 * اسکلتونِ کارت محصول — ابعاد و چیدمانِ آن دقیقاً منطبق بر
 * `@/components/modules/cart/ProductCard` است (تصویرِ مربعی، نوار ۵۶پیکسلیِ
 * سوآچ، بلوکِ نامِ ۶۰پیکسلی، قیمت و ردیفِ اکشن) تا هنگامِ جایگزینیِ اسکلتون با
 * محتوای واقعی هیچ پرش/جابه‌جایی رخ ندهد.
 *
 * تمِ روشن (کارتِ سفید + بلوک‌های خاکستریِ روشن) — هم‌خوان با تمِ روشنِ صفحه‌ی برند.
 * انیمیشن: همان sweepِ چپ‌به‌راستِ سراسری (@keyframes shimmer) با احترام به
 * prefers-reduced-motion.
 */

// بلوکِ خاکستری با درخششِ روان (light sweep). از همان keyframe سراسریِ shimmer
// استفاده می‌کند که در globals.css تعریف شده.
function Shimmer({ className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-[shimmer_1.5s_infinite] motion-reduce:animate-none" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-[6px] overflow-hidden h-full flex flex-col">
      {/* تصویر — مربعی، دقیقاً مثل کارت واقعی */}
      <Shimmer className="w-full aspect-square" />

      {/* نوار سوآچ‌ها — ارتفاعِ ۵۶px مثل کارت واقعی */}
      <div className="flex items-center justify-center gap-1.5 h-[56px] bg-white">
        <div className="w-8 h-8 rounded-[6px] bg-gray-100" />
        <div className="w-8 h-8 rounded-[6px] bg-gray-100" />
        <div className="w-8 h-8 rounded-[6px] bg-gray-100" />
      </div>

      {/* محتوا */}
      <div className="p-4 pt-0 flex flex-col items-center text-center flex-1">
        {/* بلوکِ نام — ارتفاعِ ۶۰px مثل کارت واقعی (دو خط) */}
        <div className="mb-4 h-[60px] w-full flex flex-col items-center justify-start gap-2 pt-1">
          <Shimmer className="h-4 w-3/4 rounded" />
          <Shimmer className="h-3 w-1/2 rounded" />
        </div>

        {/* قیمت */}
        <div className="mt-auto flex flex-col items-center">
          <Shimmer className="h-5 w-24 rounded" />
        </div>

        {/* ردیفِ اکشن — هم‌تراز با border-t/pt-4 کارت واقعی */}
        <div className="flex items-center gap-7 border-t border-gray-50 pt-4 w-full justify-center mt-4">
          <div className="w-5 h-5 rounded-full bg-gray-100" />
          <div className="w-5 h-5 rounded-full bg-gray-100" />
          <div className="w-5 h-5 rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

/**
 * شبکه‌ی اسکلتون: دقیقاً همان grid کارت‌های واقعی (۲ ستون موبایل / ۳ تبلت / ۴ دسکتاپ)
 * با ۸ کارت = دو ردیفِ کامل در دسکتاپ.
 */
export default function ProductGridSkeleton({ count = 8 }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
