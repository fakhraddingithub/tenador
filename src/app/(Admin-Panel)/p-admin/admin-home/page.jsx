"use client";

import Link from "next/link";
import { 
  FiLayout, FiImage, FiChevronLeft, 
  FiSettings, FiGrid, FiLayers 
} from "react-icons/fi";

export default function AdminHomeManager() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 lg:p-10">
      <div className="max-w-5xl mx-auto">
        
        {/* هدر ساده و شیک */}
        <header className="mb-12">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FiLayout className="text-[var(--color-primary)]" />
            مدیریت ویترین
          </h1>
          <p className="text-gray-500 mt-2">بخش مورد نظر برای ویرایش را انتخاب کنید</p>
        </header>

        {/* شبکه مدیریت بخش‌ها */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* کارت مدیریت اسلایدر اصلی - مقصد شما */}
          <Link href="/p-admin/admin-home/slider">
            <div className="group bg-white border border-gray-100 p-8 rounded-[var(--radius)] shadow-sm hover:shadow-xl hover:border-[var(--color-primary)] transition-all duration-300 relative overflow-hidden h-full">
              {/* المان دکوراتیو پس‌زمینه کارت */}
              <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <FiImage size={180} />
              </div>

              <div className="flex flex-col h-full">
                <div className="w-14 h-14 bg-[var(--color-primary)]/10 rounded-[var(--radius)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FiImage className="text-[var(--color-primary)] text-2xl" />
                </div>
                
                <h3 className="text-xl font-bold mb-3">مدیریت اسلایدر اصلی</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                  تغییر تصاویر، متون، لینک‌ها و اولویت‌بندی اسلایدهای بنر اصلی سایت.
                </p>

                <div className="mt-auto flex items-center gap-2 text-[var(--color-primary)] font-bold text-sm">
                  ورود به بخش مدیریت اسلایدر
                  <FiChevronLeft className="group-hover:-translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
          <Link href="/p-admin/admin-home/banners">
            <div className="group bg-white border border-gray-100 p-8 rounded-[var(--radius)] shadow-sm hover:shadow-xl hover:border-[var(--color-primary)] transition-all duration-300 relative overflow-hidden h-full">
              {/* المان دکوراتیو پس‌زمینه کارت */}
              <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <FiImage size={180} />
              </div>

              <div className="flex flex-col h-full">
                <div className="w-14 h-14 bg-[var(--color-primary)]/10 rounded-[var(--radius)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FiImage className="text-[var(--color-primary)] text-2xl" />
                </div>
                
                <h3 className="text-xl font-bold mb-3">مدیریت بنرها</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8">
                  تغییر تصاویر، متون، لینک‌ها و بنر های اصلی سایت.
                </p>

                <div className="mt-auto flex items-center gap-2 text-[var(--color-primary)] font-bold text-sm">
                  ورود به بخش مدیریت بنرها
                  <FiChevronLeft className="group-hover:-translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          {/* نمونه کارت‌های دیگر برای سایر بخش‌ها (بصورت غیرفعال یا فعال) */}
          <div className="opacity-60 cursor-not-allowed bg-gray-50 border border-dashed border-gray-200 p-8 rounded-[var(--radius)] flex flex-col justify-center items-center text-center">
             <FiLayers size={40} className="text-gray-300 mb-4" />
             <p className="text-gray-400 font-bold">مدیریت سایر بخش‌ها</p>
             <span className="text-[10px] bg-gray-200 px-2 py-1 rounded mt-2">بزودی</span>
          </div>

        </div>

      </div>
    </div>
  );
}