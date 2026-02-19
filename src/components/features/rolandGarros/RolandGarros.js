"use client";

import Button from "@/components/ui/Button";
import { FiArrowLeft, FiCircle } from "react-icons/fi";
import Image from "next/image";

export default function RolandGarros() {
  return (
    <section className="py-24 lg:py-32 bg-[#1a1c22] relative overflow-hidden">
      
      {/* متن غول‌پیکر فارسی در پس‌زمینه برای هویت‌بخشی */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0">
        <h2 className="text-[25vw] font-black text-white/[0.03] leading-none whitespace-nowrap">
        Roland Garros
        </h2>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-0">
          
          {/* بخش محتوا - سمت راست (در حالت دسکتاپ) */}
          <div className="w-full lg:w-1/2 z-20 order-2 lg:order-1">
            <div className="bg-[#20232ae6] backdrop-blur-xl p-8 lg:p-16 rounded-[2.5rem] border border-white/10 shadow-2xl lg:translate-x-12 relative overflow-hidden group">
              
              {/* المان تزئینی داخل باکس */}
              <div className="absolute top-0 left-0 w-2 h-full bg-[#aa4725]" />

              <div className="flex items-center gap-4 mb-8">
                 <FiCircle className="text-[#aa4725] animate-pulse" fill="#aa4725" size={12} />
                 <span className="text-[#aa4725] text-sm font-black tracking-widest uppercase">کالکشن رسمی 2025</span>
              </div>

              <h3 className="text-5xl lg:text-7xl font-black text-white mb-8 leading-[1.2]">
                رولاند <br />
                <span className="text-[#aa4725]">گاروس</span>
              </h3>

              <p className="text-gray-300 text-xl leading-relaxed max-w-md mb-12 font-light">
                تجربه‌ای که از قلب پاریس می‌آید. راکت‌ها و اکسسوری‌هایی که مرز بین هنر و ورزش را از بین برده‌اند؛ برای کسانی که به دنبال اصالت هستند.
              </p>

              <div className="flex flex-wrap gap-8 items-center">
                <Button className="group/btn !bg-[#aa4725] !text-white !rounded-2xl !px-12 !py-6 !text-xl !font-black transition-all hover:scale-105 shadow-[0_20px_40px_rgba(170,71,37,0.3)] flex items-center gap-4">
                  <span>مشاهده محصولات</span>
                  <FiArrowLeft size={24} className="group-hover:-translate-x-2 transition-transform" />
                </Button>
                
                <div className="flex flex-col">
                  <span className="text-white text-3xl font-black italic">۱۰۰٪</span>
                  <span className="text-gray-500 text-xs font-bold">اصالت تضمین شده</span>
                </div>
              </div>
            </div>
          </div>

          {/* بخش تصویر - سمت چپ (در حالت دسکتاپ) */}
          <div className="w-full lg:w-3/5 order-1 lg:order-2 relative">
            {/* افکت نوری دور تصویر */}
            <div className="absolute -inset-10 bg-[#aa4725]/20 rounded-full blur-[120px] opacity-50" />
            
            <div className="relative aspect-[4/5] lg:aspect-[16/11] rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-4 border-[#20232a]">
              <Image
                src="/images/roland-garros.webp"
                alt="محصولات رولاند گاروس"
                fill
                priority
                className="object-cover transition-transform duration-[3s] hover:scale-110"
              />
              {/* گرادینت ملایم برای دیده شدن بهتر لبه‌های متن */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#20232a]/60 via-transparent to-transparent" />
            </div>

            {/* ویجت شناور کنار عکس */}
            <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-3xl shadow-2xl hidden md:block group-hover:rotate-3 transition-transform duration-500">
               <div className="flex flex-col items-center gap-1">
                  <span className="text-[#20232a] text-4xl font-black italic tracking-tighter">PARIS</span>
                  <span className="text-[#aa4725] text-[10px] font-bold uppercase tracking-widest">تورنمنت 2025</span>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* المان‌های تزئینی محیطی */}
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#aa4725]/10 rounded-full blur-[100px]" />
    </section>
  );
}