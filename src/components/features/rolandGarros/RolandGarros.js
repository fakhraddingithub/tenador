"use client";

import { FiArrowLeft, FiShoppingBag, FiMaximize, FiShield } from "react-icons/fi";
import Image from "next/image";
import Button from "@/components/ui/Button";

export default function RolandGarros() {
  return (
    <section className="relative w-full min-h-screen bg-[#1a1c22] overflow-hidden font-sans flex flex-col justify-between" dir="rtl">
      
      {/* 
        بخش اول: معرفی متمرکز و ایمرسیو (Immersive) 
        این بخش تمام توجه کاربر را به عظمت کالکشن جلب می‌کند
      */}
      <div className="relative flex-1 flex flex-col items-center justify-center w-full pt-16 md:pt-24 pb-12">
        
        {/* نورپردازی‌های محیطی در مرکز */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] md:w-[40vw] md:h-[40vw] bg-[#aa4725]/20 blur-[120px] rounded-full pointer-events-none" />

        {/* تایپوگرافی غول‌پیکر در پس‌زمینه */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-0 pointer-events-none select-none overflow-hidden">
          <h1 className="text-[22vw] md:text-[16vw] font-black text-white/[0.02] leading-none tracking-tighter uppercase mx-auto">
            CLAY COURT
          </h1>
        </div>

        {/* محتوای مرکزی */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 w-full">
          
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#aa4725]/10 border border-[#aa4725]/30 text-[#aa4725] text-xs md:text-sm font-bold tracking-widest uppercase mb-8 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#aa4725] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
            کالکشن خاک رس ۲۰۲۵
          </div>

          <h2 className="text-6xl md:text-8xl lg:text-[7rem] font-black text-white tracking-tight mb-6 drop-shadow-2xl">
            رولاند <span className="text-[#aa4725]">گاروس</span>
          </h2>

          <p className="text-gray-400 max-w-2xl text-base md:text-xl font-light mb-10 md:mb-16 leading-relaxed px-4">
            تلاقی هنر پاریسی و مهندسی دقیق ورزشی. تجهیزاتی که برای تسلط بر سخت‌ترین زمین‌های خاک رس جهان طراحی شده‌اند.
          </p>

          {/* 
            تصویر اصلی محصول/کالکشن 
            به جای یک عکس ساده، از یک قاب عریض سینمایی استفاده شده است
          */}
          <div className="relative w-full max-w-5xl aspect-[4/3] md:aspect-[21/9] rounded-[2rem] md:rounded-[3rem] overflow-hidden group cursor-pointer shadow-[0_0_80px_rgba(170,71,37,0.15)] border border-white/5">
            <Image
              src="/images/roland-garros.webp"
              alt="کالکشن رولاند گاروس"
              fill
              priority
              className="object-cover transition-transform duration-[20s] ease-out group-hover:scale-110"
            />
            {/* شیدینگ داخلی برای زیبایی و خوانایی دکمه روی عکس */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c22] via-[#1a1c22]/20 to-transparent opacity-90 md:opacity-70" />
            
            {/* دکمه اکشن شناور روی تصویر */}
            <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 z-20">
              <Button className="bg-[#aa4725] text-white rounded-2xl px-5 py-3 md:px-8 md:py-4 text-sm md:text-base font-bold flex items-center gap-3 transition-all hover:bg-white hover:text-[#aa4725] hover:scale-105 shadow-2xl">
                <FiShoppingBag size={20} />
                <span>خرید کالکشن</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        بخش دوم: گرید ویژگی‌ها (Feature Grid)
        استفاده از پدینگ 64px در دسکتاپ برای حفظ تناسب و جلوگیری از بیرون‌زدگی ۴ کارت
      */}
      <div className="relative z-20 w-full px-6 lg:px-[64px] pb-12 md:pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* کارت ویژگی 1 */}
          <div className="bg-[#20232a]/60 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-[2rem] hover:bg-[#20232a] transition-all duration-300 group hover:-translate-y-2">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#aa4725]/10 flex items-center justify-center mb-6 group-hover:bg-[#aa4725] transition-colors duration-300">
              <FiShield className="text-[#aa4725] group-hover:text-white transition-colors" size={24} />
            </div>
            <h3 className="text-white font-bold text-lg md:text-xl mb-3">تضمین اصالت کالا</h3>
            <p className="text-gray-500 text-sm leading-relaxed">تمامی محصولات با گواهی رسمی، کارت سلامت و سریال نامبر معتبر جهانی عرضه می‌شوند.</p>
          </div>

          {/* کارت ویژگی 2 */}
          <div className="bg-[#20232a]/60 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-[2rem] hover:bg-[#20232a] transition-all duration-300 group hover:-translate-y-2">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#aa4725]/10 flex items-center justify-center mb-6 group-hover:bg-[#aa4725] transition-colors duration-300">
              <FiMaximize className="text-[#aa4725] group-hover:text-white transition-colors" size={24} />
            </div>
            <h3 className="text-white font-bold text-lg md:text-xl mb-3">مهندسی دقیق</h3>
            <p className="text-gray-500 text-sm leading-relaxed">طراحی آیرودینامیک فریم‌ها برای حداکثر پایداری در ضربات اسپین سنگین و کنترل بی‌نظیر.</p>
          </div>

          {/* کارت ویژگی 3 */}
          <div className="bg-[#20232a]/60 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-[2rem] hover:bg-[#20232a] transition-all duration-300 group hover:-translate-y-2">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#aa4725]/10 flex items-center justify-center mb-6 group-hover:bg-[#aa4725] transition-colors duration-300">
              <svg className="w-6 h-6 text-[#aa4725] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg md:text-xl mb-3">ارسال تخصصی</h3>
            <p className="text-gray-500 text-sm leading-relaxed">بسته‌بندی ایمن و ارسال سریع برای حفظ سلامت کامل تجهیزات حرفه‌ای شما.</p>
          </div>

          {/* کارت 4 (کارت کال‌تو‌اکشن متمایز) */}
          <div className="bg-gradient-to-br from-[#aa4725] to-[#7a3017] p-6 md:p-8 rounded-[2rem] hover:shadow-[0_20px_40px_-10px_rgba(170,71,37,0.5)] transition-all duration-300 group cursor-pointer flex flex-col justify-between overflow-hidden relative">
            {/* پترن محو در پس‌زمینه کارت */}
            <div className="absolute -right-10 -top-10 opacity-10">
              <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-white font-black text-3xl mb-3 tracking-tight">PARIS <br/> 2025</h3>
              <p className="text-white/80 text-sm font-medium">مشاهده کاتالوگ کامل تجهیزات تورنمنت.</p>
            </div>
            <div className="relative z-10 mt-8 flex justify-end">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:-translate-x-2 transition-transform duration-300">
                <FiArrowLeft className="text-white" size={24} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}