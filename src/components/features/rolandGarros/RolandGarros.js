"use client";

import Button from "@/components/ui/Button";
import { FiArrowLeft, FiCircle, FiShield, FiStar } from "react-icons/fi";
import Image from "next/image";

export default function RolandGarros() {
  return (
    <section
      dir="rtl"
      className="relative overflow-hidden bg-[#1a1c22] py-20 sm:py-24 lg:py-32"
    >
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#aa4725]/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-56 w-56 rounded-full bg-[#aa4725]/5 blur-3xl" />
      </div>

      {/* subtle watermark */}
      <div className="pointer-events-none absolute inset-0 hidden select-none items-center justify-center lg:flex">
        <h2 className="text-[12vw] font-bold leading-none tracking-tight text-white/[0.03]">
          Roland Garros
        </h2>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* content */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.055] sm:p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#aa4725]/15 ring-1 ring-[#aa4725]/20">
                  <FiCircle className="text-[#aa4725]" size={10} />
                </span>
                <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#aa4725]">
                  کالکشن رسمی 2025
                </span>
              </div>

              <h3 className="text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                رولاند
                <br />
                <span className="text-[#aa4725]">گاروس</span>
              </h3>

              <p className="mt-5 max-w-md text-sm leading-7 text-gray-300 sm:text-base">
                انتخابی برای کسانی که دنبال ظاهر شیک، هویت معتبر و جزئیات
                دقیق‌اند؛ بدون شلوغ‌کاری، فقط طراحی حساب‌شده و اصیل.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button className="group inline-flex items-center gap-3 rounded-2xl !bg-[#aa4725] !px-6 !py-4 !text-sm !font-bold !text-white shadow-[0_18px_40px_rgba(170,71,37,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(170,71,37,0.32)] sm:!px-7 sm:!py-5 sm:!text-base">
                  <span>مشاهده محصولات</span>
                  <FiArrowLeft
                    size={20}
                    className="transition-transform duration-300 group-hover:-translate-x-1"
                  />
                </Button>

                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <FiShield className="text-[#aa4725]" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">۱۰۰٪</span>
                    <span className="text-[11px] text-gray-400">اصالت تضمین‌شده</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <FiStar className="text-[#aa4725]" size={14} />
                    <span className="text-sm font-bold">طراحی مینیمال</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-gray-400">
                    تمیز، مدرن و بدون شلوغی اضافی.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <FiStar className="text-[#aa4725]" size={14} />
                    <span className="text-sm font-bold">نمای لوکس</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-gray-400">
                    حس premium با کنتراست کنترل‌شده.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* image */}
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="group relative">
              {/* glow */}
              <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-[#aa4725]/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-70" />

              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10 bg-[#20232a] shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:aspect-[16/11] lg:rounded-[2.5rem]">
                <Image
                  src="/images/roland-garros.webp"
                  alt="محصولات رولاند گاروس"
                  fill
                  priority
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />

                {/* overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c22]/75 via-[#1a1c22]/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1c22]/35 via-transparent to-transparent" />

                {/* top badge */}
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md sm:left-6 sm:top-6">
                  <span className="text-[10px] font-extrabold tracking-[0.24em] text-white/90">
                    PARIS · 2026
                  </span>
                </div>

                {/* bottom info */}
                <div className="absolute bottom-4 right-4 rounded-2xl border border-white/10 bg-[#1a1c22]/70 px-4 py-3 backdrop-blur-md sm:bottom-6 sm:right-6 sm:px-5 sm:py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#aa4725]">
                    Roland Garros
                  </p>
                  <p className="mt-1 text-sm font-bold text-white sm:text-base">
                    اصالت، قدرت، سادگی
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}