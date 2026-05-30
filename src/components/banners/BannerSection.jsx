// این فایل دیگر "use client" نیست و به صورت پیش‌فرض Server Component است
import BannerRenderer from "./BannerRenderer";
import StripBannerRenderer from "./StripBannerRenderer";

// یک تابع کمکی برای گرفتن داده‌ها در سرور
async function getBanners() {
  try {
    // نکته: در سرور کامپوننت‌ها باید آدرس کامل (Absolute URL) بدهید یا مستقیماً به دیتابیس وصل شوید
    // اگر از Next.js 13/14 استفاده می‌کنید، می‌توانید مستقیما از دیتابیس هم کوئری بگیرید
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/banners`, {
      next: { revalidate: 3600 }, // کش کردن داده‌ها برای ۱ ساعت (بسیار مهم برای سرعت)
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.success) {
      const map = { wide: null, tall1: null, tall2: null, strip: null };
      data.banners.forEach((b) => {
        if (b.position === "wide" && !map.wide) map.wide = b;
        if (b.position === "tall-1" && !map.tall1) map.tall1 = b;
        if (b.position === "tall-2" && !map.tall2) map.tall2 = b;
        if (b.position === "strip" && !map.strip) map.strip = b;
      });
      return map;
    }
  } catch (err) {
    console.error("Error fetching banners:", err);
    return null;
  }
  return null;
}

/**
 * BannerSection (Server Component)
 */
export default async function BannerSection() {
  const banners = await getBanners();

  if (!banners || (!banners.wide && !banners.tall1 && !banners.tall2 && !banners.strip)) {
    return null; // یا یک کامپوننت فال‌بک/اسکلتون نشان دهید
  }

  const cellClasses = "rounded-[var(--radius)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.18)]";
  const placeholderClasses = "w-full h-full bg-gradient-to-br from-[#f0f0f0] to-[#e8e8e8] border-2 border-dashed border-[#ddd] flex items-center justify-center text-[#aaa] text-[13px] rounded-[var(--radius)]";

  return (
    <section className="container mx-auto py-6 px-4 md:px-12 lg:px-16 xl:px-20 font-sans" dir="rtl">
      <div className="max-w-screen-xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        
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
        <div className="max-w-screen-xl mx-auto mt-4">
          <div className={`h-[60px] md:h-[72px] rounded-[var(--radius)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}>
            <StripBannerRenderer banner={banners.strip} />
          </div>
        </div>
      )}
    </section>
  );
}