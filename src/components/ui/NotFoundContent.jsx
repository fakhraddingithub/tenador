import Link from "next/link";
import { Home, ShoppingBag } from "lucide-react";

/**
 * محتوای صفحه ۴۰۴ — هماهنگ با تم و رنگ‌بندی سایت تنادور.
 * در دو جا استفاده می‌شود:
 *  - src/app/not-found.jsx        (آدرس‌های نامعتبر در کل سایت)
 *  - src/app/(Site)/not-found.jsx (فراخوانی notFound() داخل صفحات سایت)
 */
export default function NotFoundContent() {
  return (
    <section
      dir="rtl"
      className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[var(--color-background)]"
    >
      <div className="max-w-xl w-full text-center">
        {/* عدد ۴۰۴ با توپ تنیس به عنوان صفرِ میانی */}
        <div className="relative mb-8 flex items-center justify-center select-none">
          <span className="text-[110px] sm:text-[150px] font-black leading-none text-[#aa4725]">
            ۴
          </span>
          <span className="mx-1 sm:mx-2 relative inline-flex items-center justify-center">
            <span className="block w-[78px] h-[78px] sm:w-[110px] sm:h-[110px] rounded-full bg-[#ffbf00] shadow-lg shadow-[#ffbf00]/30" />
            {/* خطوط منحنی توپ تنیس */}
            <span className="absolute inset-0 rounded-full border-[3px] border-white/70" />
            <span className="absolute w-[78px] h-[78px] sm:w-[110px] sm:h-[110px] rounded-full border-t-[3px] border-white/70 rotate-45" />
          </span>
          <span className="text-[110px] sm:text-[150px] font-black leading-none text-[#aa4725]">
            ۴
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[#0d0d0d] mb-3">
          صفحه‌ای که دنبالش بودید پیدا نشد
        </h1>
        <p className="text-sm sm:text-base text-gray-500 leading-7 mb-8 max-w-md mx-auto">
          ممکن است آدرس را اشتباه وارد کرده باشید یا این صفحه حذف یا جابه‌جا شده باشد.
          می‌توانید به صفحه اصلی برگردید یا فهرست محصولات ما را ببینید.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              bg-[#aa4725] hover:bg-[#8f3b1e] text-white font-bold text-sm
              px-6 py-3 rounded-[6px] transition-all shadow-lg shadow-[#aa4725]/20 active:scale-95"
          >
            <Home size={18} />
            صفحه اصلی
          </Link>
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
