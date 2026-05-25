"use client";

import { useState, useEffect } from "react";
import { FaMars, FaVenus, FaMedal, FaRunning, FaFlag } from "react-icons/fa";

export default function ShowcaseAthletes() {
  const [data, setData] = useState({ men: [], women: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const res = await fetch("/api/athletes/showcase");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error("خطا در دریافت اطلاعات:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAthletes();
  }, []);

  // کامپوننت داخلی برای نمایش یک ردیف (کارت ورزشکار)
  const AthleteCard = ({ athlete, index }) => (
    <div className="relative group flex items-center gap-4 bg-[var(--color-background)] p-4 md:p-5 rounded-[2rem] shadow-sm border border-[var(--border)] hover:border-[var(--color-primary)] hover:shadow-xl transition-all duration-300 overflow-hidden">
      
      {/* بک‌گراند هاور با رنگ Primary به صورت ملایم */}
      <div className="absolute inset-0 bg-[var(--color-primary)] opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />

      {/* شماره (ظاهر رنکینگ) */}
      <div className="w-8 shrink-0 text-center">
        <span className="text-3xl font-black text-gray-200 group-hover:text-[var(--color-primary)] transition-colors duration-300 italic">
          {index + 1}
        </span>
      </div>

      {/* تصویر آواتار */}
      <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-full overflow-hidden border-[3px] border-gray-100 group-hover:border-[var(--color-primary)] transition-colors duration-300 shadow-md">
        <img
          src={athlete.photo || "/default-avatar.png"} // یک عکس پیش‌فرض در صورت نبود عکس تنظیم کنید
          alt={athlete.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* اطلاعات */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-lg text-[var(--color-text)] truncate mb-1">
          {athlete.title}
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500">
          {athlete.sport && (
            <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
              <FaRunning className="text-[var(--color-primary)]" />
              {athlete.sport.name}
            </span>
          )}
          {athlete.nationality && (
            <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
              <FaFlag className="text-gray-400" />
              {athlete.nationality}
            </span>
          )}
        </div>
      </div>

      {/* حامیان مالی (لوگوها) */}
      {athlete.sponsors && athlete.sponsors.length > 0 && (
        <div className="hidden sm:flex shrink-0 -space-x-2 -space-x-reverse items-center justify-end">
          {athlete.sponsors.slice(0, 3).map((sponsor, i) => (
            <div 
              key={sponsor._id || i} 
              className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center p-1 shadow-sm"
              title={sponsor.name}
            >
              <img src={sponsor.logo} alt={sponsor.name} className="w-full h-full object-contain" />
            </div>
          ))}
          {athlete.sponsors.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shadow-sm z-10">
              +{athlete.sponsors.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // لودینگ استیت (اسکلتون جذاب)
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-xl w-64 mx-auto mb-12"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {[1, 2].map((col) => (
            <div key={col} className="space-y-4">
              <div className="h-12 bg-gray-200 rounded-2xl w-48 mb-6"></div>
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-24 bg-gray-100 rounded-[2rem] w-full"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* هدر بخش */}
        <div className="text-center mb-12 md:mb-16">
          <span className="text-[var(--color-primary)] font-bold tracking-widest uppercase text-xs mb-3 block">
            Featured Athletes
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-[var(--color-text)] flex items-center justify-center gap-3">
            <FaMedal className="text-[var(--color-secondary)]" /> 
            ستارگان برتر امروز
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto text-sm font-medium">
            نگاهی به برجسته‌ترین قهرمانان و چهره‌های ورزشی که نامشان در دنیای ورزش می‌درخشد.
          </p>
        </div>

        {/* گرید دو ستونه - در حالت RTL ستون راست (مردان) اول رندر می‌شود */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          
          {/* ─── ستون راست: مردان ─── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100 mb-6">
              <h3 className="text-2xl font-black text-[var(--color-text)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FaMars size={20} />
                </div>
                بخش مردان
              </h3>
            </div>
            
            <div className="flex flex-col gap-4">
              {data.men.length > 0 ? (
                data.men.map((athlete, index) => (
                  <AthleteCard key={athlete._id} athlete={athlete} index={index} />
                ))
              ) : (
                <p className="text-gray-400 text-sm italic text-center py-8">ورزشکاری یافت نشد</p>
              )}
            </div>
          </div>

          {/* ─── ستون چپ: زنان ─── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100 mb-6">
              <h3 className="text-2xl font-black text-[var(--color-text)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
                  <FaVenus size={20} />
                </div>
                بخش زنان
              </h3>
            </div>
            
            <div className="flex flex-col gap-4">
              {data.women.length > 0 ? (
                data.women.map((athlete, index) => (
                  <AthleteCard key={athlete._id} athlete={athlete} index={index} />
                ))
              ) : (
                <p className="text-gray-400 text-sm italic text-center py-8">ورزشکاری یافت نشد</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}