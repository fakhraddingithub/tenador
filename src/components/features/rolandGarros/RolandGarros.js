"use client";

import Button from "@/components/ui/Button";
import { FiArrowLeft, FiAward } from "react-icons/fi";
import Image from "next/image";

export default function RolandGarros() {
  return (
    <section 
      className="relative w-full min-h-[85vh] flex items-center justify-center bg-[#1a1c22] py-20 overflow-hidden font-sans" 
      dir="rtl"
    >
      {/* بک‌گراند مینیمال و نورپردازی محیطی */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#aa4725] rounded-full mix-blend-multiply filter blur-[150px] opacity-20 animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-0 left-1/4 w-[30rem] h-[30rem] bg-[#20232a] rounded-full filter blur-[120px] opacity-60" />

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* بخش محتوا - سمت راست */}
          <div className="w-full lg:w-1/2 flex flex-col items-start z-20">
            
            {/* بج (Badge) مینیمال */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#20232a]/80 border border-white/5 backdrop-blur-md mb-8 shadow-sm transition-all hover:bg-[#20232a]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#aa4725] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#aa4725]"></span>
              </span>
              <span className="text-[#aa4725] text-xs font-bold tracking-widest uppercase mt-0.5">
                کالکشن رسمی ۲۰۲۵
              </span>
            </div>

            {/* عنوان اصلی با افکت گرادیانت */}
            <h2 className="text-6xl sm:text-7xl lg:text-[5.5rem] font-black text-white leading-[1.15] mb-6 tracking-tight">
              رولاند <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#aa4725] to-[#e86a3e]">
                گاروس
              </span>
            </h2>

            {/* توضیحات با استایل نقل‌قول مدرن */}
            <p className="text-gray-400 text-lg sm:text-xl font-light leading-relaxed max-w-lg mb-10 border-r-2 border-[#aa4725]/40 pr-5">
              تجربه‌ای که از قلب پاریس می‌آید. راکت‌ها و اکسسوری‌هایی که مرز بین هنر و ورزش را از بین برده‌اند؛ طراحی شده برای کسانی که به دنبال اصالت هستند.
            </p>

            {/* دکمه‌ها و اکشن‌ها */}
            <div className="flex flex-col sm:flex-row items-center gap-8 w-full sm:w-auto">
              <Button className="group relative w-full sm:w-auto flex items-center justify-center gap-3 bg-[#aa4725] hover:bg-[#c9542c] text-white rounded-2xl px-8 py-4 text-lg font-bold transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(170,71,37,0.4)] hover:shadow-[0_15px_40px_-10px_rgba(170,71,37,0.6)] hover:-translate-y-1 overflow-hidden">
                <span className="relative z-10 mt-0.5">مشاهده محصولات</span>
                <FiArrowLeft className="relative z-10 transition-transform duration-300 group-hover:-translate-x-2" size={22} />
                
                {/* افکت درخشش (Shine) روی دکمه هنگام هاور */}
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
              </Button>

              <div className="flex items-center gap-3 text-gray-400 opacity-70 hover:opacity-100 transition-opacity duration-300 cursor-default">
                <FiAward size={26} className="text-[#aa4725]" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">۱۰۰٪ اورجینال</span>
                  <span className="text-xs font-light">اصالت تضمین شده</span>
                </div>
              </div>
            </div>
          </div>

          {/* بخش تصویر - سمت چپ */}
          <div className="w-full lg:w-1/2 relative group mt-10 lg:mt-0">
            
            {/* ویجت شناور مینیمال */}
            <div className="absolute -right-6 top-12 bg-[#20232a]/90 backdrop-blur-xl border border-white/10 px-5 py-4 rounded-2xl shadow-2xl z-20 transition-transform duration-500 group-hover:-translate-y-3 hidden sm:block">
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-white font-black text-xl tracking-widest italic">PARIS</span>
                <span className="text-[#aa4725] text-[10px] font-bold uppercase tracking-wider">Tournament</span>
              </div>
            </div>

            {/* کانتینر اصلی تصویر */}
            <div className="relative aspect-[4/5] w-full max-w-md mx-auto lg:max-w-none rounded-[2.5rem] overflow-hidden bg-[#20232a] border border-white/5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] transform transition-transform duration-700 group-hover:scale-[1.02]">
              {/* گرادیانت ملایم روی تصویر برای خوانایی بهتر */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c22]/80 via-transparent to-transparent z-10"></div>
              
              <Image
                src="/images/roland-garros.webp"
                alt="محصولات رولاند گاروس"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-[15s] ease-out group-hover:scale-110"
              />
            </div>

            {/* حلقه تزئینی متحرک دور تصویر */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[105%] h-[105%] border border-[#aa4725]/20 rounded-[3rem] -z-10 transition-all duration-700 group-hover:rotate-2 group-hover:scale-105 group-hover:border-[#aa4725]/40 pointer-events-none"></div>
          </div>

        </div>
      </div>

      {/* استایل داخلی برای انیمیشن Shimmer دکمه */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(150%); }
        }
      `}} />
    </section>
  );
}