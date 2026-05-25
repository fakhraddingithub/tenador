"use client";

import { useEffect, useState } from "react";
import BannerRenderer from "./BannerRenderer";
import StripBannerRenderer from "./StripBannerRenderer";

/**
 * BannerSection
 * کامپوننت اصلی نمایش بنرها در صفحه اصلی فروشگاه
 * لایوت: یک بنر افقی (wide) + دو بنر عمودی (tall-1, tall-2) + یک نوار (strip)
 */
export default function BannerSection() {
  const [banners, setBanners] = useState({ wide: null, tall1: null, tall2: null, strip: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch("/api/banners");
      const data = await res.json();
      if (data.success) {
        const map = { wide: null, tall1: null, tall2: null, strip: null };
        data.banners.forEach((b) => {
          if (b.position === "wide" && !map.wide) map.wide = b;
          if (b.position === "tall-1" && !map.tall1) map.tall1 = b;
          if (b.position === "tall-2" && !map.tall2) map.tall2 = b;
          if (b.position === "strip" && !map.strip) map.strip = b;
        });
        setBanners(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <BannerSkeleton />;

  if (!banners.wide && !banners.tall1 && !banners.tall2 && !banners.strip) return null;

  // کلاس‌های مشترک برای خانه‌های بنر (هاور، انیمیشن و استفاده از متغیر گلوبال برای گردی گوشه‌ها)
  const cellClasses = "rounded-[var(--radius)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.18)]";
  const placeholderClasses = "w-full h-full bg-gradient-to-br from-[#f0f0f0] to-[#e8e8e8] border-2 border-dashed border-[#ddd] flex items-center justify-center text-[#aaa] text-[13px] rounded-[var(--radius)]";

  return (
    <section className="py-6 font-sans" dir="rtl">
      
      {/* گرید اصلی: 
        در موبایل 2 ستون دارد (برای اینکه دو بنر تال کنار هم بیفتند)
        در دسکتاپ 4 ستون دارد (واید 2 ستون می‌گیرد و هر تال 1 ستون) 
      */}
      <div className="max-w-screen-xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* بنر اصلی (Wide) */}
        <div className={`col-span-2 h-[220px] md:h-[320px] ${cellClasses}`}>
          {banners.wide ? (
            <BannerRenderer banner={banners.wide} />
          ) : (
            <div className={placeholderClasses}>بنر اصلی</div>
          )}
        </div>

        {/* بنر کناری ۱ (Tall 1) */}
        <div className={`col-span-1 h-[220px] md:h-[320px] ${cellClasses}`}>
          {banners.tall1 ? (
            <BannerRenderer banner={banners.tall1} />
          ) : (
            <div className={placeholderClasses}>بنر کناری ۱</div>
          )}
        </div>

        {/* بنر کناری ۲ (Tall 2) */}
        <div className={`col-span-1 h-[220px] md:h-[320px] ${cellClasses}`}>
          {banners.tall2 ? (
            <BannerRenderer banner={banners.tall2} />
          ) : (
            <div className={placeholderClasses}>بنر کناری ۲</div>
          )}
        </div>
      </div>

      {/* بنر نواری (Strip) */}
      {banners.strip && (
        <div className="max-w-screen-xl mx-auto px-4 mt-4">
          <div className={`h-[60px] md:h-[72px] rounded-[var(--radius)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}>
            <StripBannerRenderer banner={banners.strip} />
          </div>
        </div>
      )}
    </section>
  );
}

// کامپوننت اسکلتون با استایل‌های تیلویند
function BannerSkeleton() {
  const skelClasses = "rounded-[var(--radius)] bg-gray-200 animate-pulse";

  return (
    <section className="py-6" dir="rtl">
      <div className="max-w-screen-xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`col-span-2 h-[220px] md:h-[320px] ${skelClasses}`} />
        <div className={`col-span-1 h-[220px] md:h-[320px] ${skelClasses}`} />
        <div className={`col-span-1 h-[220px] md:h-[320px] ${skelClasses}`} />
      </div>
      <div className="max-w-screen-xl mx-auto px-4 mt-4">
        <div className={`h-[60px] md:h-[72px] ${skelClasses}`} />
      </div>
    </section>
  );
}