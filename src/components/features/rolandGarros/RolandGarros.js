"use client";

import Button from "@/components/ui/Button";
import { FiArrowUpLeft, FiPlay, FiStar, FiCheck } from "react-icons/fi";
import Image from "next/image";

export default function RolandGarros() {
  return (
    <section 
      className="relative w-full min-h-screen bg-[#1a1c22] text-white flex items-center py-20 lg:py-0 overflow-hidden"
      dir="rtl"
    >
      {/* 
        Background Effects: 
        نورپردازی‌های ملایم و بافت پس‌زمینه برای عمق‌بخشی 
      */}
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#aa4725] rounded-full mix-blend-screen filter blur-[200px] opacity-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#20232a] rounded-full filter blur-[150px] opacity-80 pointer-events-none" />

      {/* متن غول‌پیکر محو به سبک مجلات مد */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -rotate-90 hidden lg:block opacity-[0.02] pointer-events-none select-none z-0">
        <span className="text-[15rem] font-black tracking-tighter whitespace-nowrap">
          PARIS 2025
        </span>
      </div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* =======================
              بخش محتوا (سمت راست در RTL) 
              ======================= */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-10 relative z-30">
            
            {/* بج کوچک و خاص */}
            <div className="group w-fit flex items-center gap-3 px-4 py-2 bg-[#20232a]/50 backdrop-blur-md rounded-full border border-white/5 shadow-lg cursor-default">
              <span className="w-2 h-2 rounded-full bg-[#aa4725] animate-pulse" />
              <span className="text-gray-300 text-xs font-bold tracking-wider uppercase">
                نسخه محدود • کالکشن جدید
              </span>
            </div>

            {/* تایپوگرافی نامتقارن و جذاب */}
            <div className="flex flex-col relative">
              <h2 className="text-7xl lg:text-[7rem] font-black leading-[0.9] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
                رولاند
              </h2>
              <h2 className="text-6xl lg:text-[6.5rem] font-black leading-[0.9] text-[#aa4725] pr-12 lg:pr-24">
                گاروس
              </h2>
              
              {/* خط تزئینی کنار عنوان */}
              <div className="absolute -right-6 top-4 bottom-4 w-1 bg-gradient-to-b from-[#aa4725] to-transparent rounded-full hidden lg:block" />
            </div>

            <p className="text-gray-400 text-lg sm:text-xl font-light leading-relaxed max-w-md">
              شاهکاری از قلب زمین‌های خاکی پاریس. ترکیبی بی‌نظیر از هنر طراحی مدرن و اصالت ورزش تنیس، خلق شده برای قهرمانان.
            </p>

            {/* بخش دکمه‌ها و اکشن‌ها */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Button className="group relative overflow-hidden bg-white text-[#1a1c22] rounded-full px-8 py-4 text-lg font-black transition-all duration-500 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)] flex items-center gap-3">
                <span className="relative z-10 mt-1">مشاهده کالکشن</span>
                <span className="relative z-10 w-8 h-8 rounded-full bg-[#1a1c22] flex items-center justify-center transition-transform duration-500 group-hover:-translate-x-1 group-hover:-rotate-45">
                  <FiArrowUpLeft className="text-white" size={18} />
                </span>
                {/* افکت هاور دکمه */}
                <div className="absolute inset-0 bg-gray-200 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </Button>

              {/* دکمه پخش ویدیو (مفهومی) */}
              <button className="flex items-center gap-4 text-gray-300 hover:text-white transition-colors group">
                <div className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center group-hover:border-[#aa4725] group-hover:bg-[#aa4725]/10 transition-all duration-300">
                  <FiPlay className="ml-1 group-hover:text-[#aa4725] transition-colors" size={20} />
                </div>
                <span className="text-sm font-bold tracking-wide uppercase mt-1">تیزر رسمی</span>
              </button>
            </div>
          </div>

          {/* =======================
              بخش تصویر (سمت چپ در RTL)
              ======================= */}
          <div className="lg:col-span-7 relative h-full flex justify-end items-center group mt-10 lg:mt-0">
            
            {/* باکس پس‌زمینه تصویر (ایجاد عمق 3D) */}
            <div className="absolute top-10 bottom-10 left-4 right-12 bg-[#20232a] rounded-[3rem] transform -rotate-3 transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-105" />

            {/* تصویر اصلی */}
            <div className="relative aspect-[4/5] w-full max-w-lg mx-auto lg:mx-0 lg:ml-8 rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10 z-20 transform transition-all duration-700 group-hover:scale-[1.02] group-hover:-translate-y-4">
              <Image
                src="/images/roland-garros.webp"
                alt="Roland Garros 2025"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 60vw"
                className="object-cover transform scale-105 transition-transform duration-[10s] group-hover:scale-110"
              />
              
              {/* گرادیانت داخلی عکس */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c22]/90 via-[#1a1c22]/20 to-transparent opacity-80" />
            </div>

            {/* کارت شناور 1: کیفیت و اصالت */}
            <div className="absolute top-1/4 -right-4 sm:-right-10 z-30 bg-[#20232a]/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 transform transition-all duration-500 hover:-translate-y-2 lg:group-hover:translate-x-4 animate-[bounce_4s_infinite_ease-in-out]">
              <div className="w-12 h-12 rounded-full bg-[#aa4725] flex items-center justify-center shadow-inner">
                <FiCheck size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-sm">۱۰۰٪ اورجینال</span>
                <span className="text-gray-400 text-xs mt-0.5">تضمین اصالت کالا</span>
              </div>
            </div>

            {/* کارت شناور 2: طراحی شده در پاریس */}
            <div className="absolute bottom-16 -left-2 sm:-left-8 z-30 bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow-2xl transform transition-all duration-500 lg:group-hover:-translate-x-6 lg:group-hover:-translate-y-2 delay-100">
              <div className="flex items-center gap-2 mb-2">
                <FiStar className="text-[#aa4725] fill-[#aa4725]" size={14} />
                <FiStar className="text-[#aa4725] fill-[#aa4725]" size={14} />
                <FiStar className="text-[#aa4725] fill-[#aa4725]" size={14} />
                <FiStar className="text-[#aa4725] fill-[#aa4725]" size={14} />
                <FiStar className="text-[#aa4725] fill-[#aa4725]" size={14} />
              </div>
              <p className="text-white font-bold text-lg leading-tight">
                طراحی شده در <br /> <span className="text-[#aa4725] italic font-black text-2xl">پاریس</span>
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}