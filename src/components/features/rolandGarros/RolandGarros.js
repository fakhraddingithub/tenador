"use client";

import Button from "@/components/ui/Button";
import { FiArrowLeft, FiCircle } from "react-icons/fi";
import Image from "next/image";

export default function RolandGarros() {
  return (
    <section className="relative overflow-hidden bg-[#1a1c22] py-20 sm:py-24 lg:py-28">
      {/* متن پس‌زمینه */}
      <div className="pointer-events-none absolute top-[10%] left-1/2 z-0 w-full -translate-x-1/2 text-center">
        <h2 className="whitespace-nowrap text-[28vw] sm:text-[22vw] lg:text-[16vw] font-black italic leading-none tracking-[-0.08em] text-white/[0.03]">
          Roland Garros
        </h2>
      </div>

      <div className="container mx-auto relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-10 lg:flex-row lg:items-center lg:gap-8">
          {/* بخش محتوا */}
          <div className="order-2 w-full max-w-2xl lg:order-1 lg:w-5/12 lg:max-w-none">
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#20232ae6] p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:translate-x-6 lg:p-10 xl:p-12">
              <div className="absolute left-0 top-0 h-full w-2 bg-[#aa4725]" />

              <div className="mb-6 flex items-center justify-center gap-4 lg:justify-end">
                <FiCircle
                  className="animate-pulse text-[#aa4725]"
                  fill="#aa4725"
                  size={12}
                />
                <span className="text-sm font-bold tracking-widest text-[#aa4725] uppercase">
                  کالکشن رسمی 2026
                </span>
              </div>

              <h3 className="mb-6 text-center lg:text-right text-3xl font-bold leading-[1.15] text-white sm:text-5xl lg:text-6xl">
                رولاند <span className="text-[#aa4725]">گاروس </span>
                <span className="mt-3 block text-left text-xl sm:text-2xl lg:text-3xl font-black italic tracking-[-0.06em] text-white/70">
                  Roland <span className="text-[#aa4725]">Garros</span>
                </span>
              </h3>

              <p className="mx-auto lg:mr-0 lg:ml-auto mb-8 max-w-md text-center lg:text-right text-base leading-relaxed text-gray-300 font-light sm:text-lg lg:text-lg">
                تجربه‌ای که از قلب پاریس می‌آید. راکت‌ها و اکسسوری‌هایی که مرز
                بین هنر و ورزش را از بین برده‌اند؛ برای کسانی که به دنبال اصالت
                هستند.
              </p>

              <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-end">
                <Button className="group/btn inline-flex items-center gap-3 rounded-2xl !bg-[#aa4725] !px-8 !py-4 !text-base !font-black !text-white shadow-[0_20px_40px_rgba(170,71,37,0.3)] transition-all hover:scale-105 sm:!px-10 sm:!py-5 sm:!text-lg">
                  <span>مشاهده محصولات</span>
                  <FiArrowLeft
                    size={22}
                    className="transition-transform group-hover/btn:-translate-x-2"
                  />
                </Button>

                <div className="flex flex-col items-center sm:items-start">
                  <span className="text-2xl font-black italic text-white sm:text-3xl">
                    ۱۰۰٪
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    اصالت تضمین شده
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* بخش تصویر */}
          <div className="order-1 w-full max-w-4xl lg:order-2 lg:w-7/12 lg:max-w-none">
            <div className="relative mx-auto w-full">
              <div className="absolute -inset-8 rounded-full bg-[#aa4725]/20 blur-[100px] opacity-50" />

              <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] border-4 border-[#20232a] shadow-[0_35px_90px_-20px_rgba(0,0,0,0.5)] sm:aspect-[16/11]">
                <Image
                  src="/images/roland-garros.webp"
                  alt="محصولات رولاند گاروس"
                  fill
                  priority
                  className="object-cover transition-transform duration-[3s] hover:scale-110"
                />

                <div className="absolute inset-0 bg-gradient-to-r from-[#20232a]/60 via-transparent to-transparent" />
              </div>

              <div className="absolute -bottom-5 -right-3 hidden rounded-3xl bg-white p-4 shadow-2xl transition-transform duration-500 md:block lg:-bottom-6 lg:-right-6 lg:p-5">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl font-black italic tracking-tighter text-[#20232a] lg:text-4xl">
                    PARIS
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-[#aa4725] uppercase">
                    تورنمنت 2026
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* المان تزئینی پایین */}
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#aa4725]/10 blur-[100px]" />
    </section>
  );
}
