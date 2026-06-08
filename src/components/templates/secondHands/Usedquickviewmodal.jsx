"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FaTimes,
  FaHeart,
  FaRegHeart,
  FaArrowLeft,
} from "react-icons/fa";
import { FiShield, FiTag } from "react-icons/fi";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
const SCORE_STYLE = (s) => {
  if (s == null) return null;
  if (s >= 8) return { color: "bg-green-500", label: "عالی" };
  if (s >= 5) return { color: "bg-amber-500", label: "خوب" };
  return             { color: "bg-red-500",   label: "متوسط" };
};

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function UsedQuickViewModal({
  product,
  isOpen,
  onClose,
  isWishlisted,
  onToggleWishlist,
}) {
  const [selectedImage, setSelectedImage] = useState(null);

  // همه تصاویر: ابتدا images محصول دست‌دوم، سپس mainImage از baseProduct
  const allImages = useMemo(() => {
    if (!product) return [];
    const own  = (product.images || []).filter(Boolean);
    const base = product.baseProduct?.mainImage ? [product.baseProduct.mainImage] : [];
    const merged = [...own, ...base];
    return [...new Set(merged)]; // بدون تکرار
  }, [product]);

  const displayedImage = selectedImage ?? allImages[0] ?? null;

  useEffect(() => {
    if (product) setSelectedImage(null); // ریست وقتی محصول عوض می‌شه
  }, [product]);

  // بستن با Escape
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // قفل اسکرول
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const { name, price, overallScore, description, baseProduct, healthScores, customFields, tested } = product;
  const score = SCORE_STYLE(overallScore);
  const allScores = [...(healthScores || []), ...(customFields || [])];

  // جدا کردن بخش فارسی و انگلیسی نام
  const splitName = (text = "") => {
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
      return { farsi: text.substring(0, match.index).trim(), english: match[0].trim() };
    }
    return { farsi: text, english: "" };
  };
  const { farsi, english } = splitName(name);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      dir="rtl"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="
        relative w-full bg-white shadow-2xl overflow-hidden
        flex flex-col
        rounded-t-2xl max-h-[92dvh]
        sm:rounded-[8px] sm:max-w-2xl sm:max-h-[88vh]
        lg:max-w-5xl lg:flex-row lg:max-h-[90vh]
        text-right
      ">

        {/* ── دکمه بستن ── */}
        <button
          onClick={onClose}
          className="
            absolute top-3 left-3 z-50
            w-9 h-9 flex items-center justify-center
            rounded-full bg-gray-100/90 hover:bg-[#aa4725] hover:text-white
            transition-all border border-white/30 shadow-sm
          "
        >
          <FaTimes size={15} />
        </button>

        {/* ── موبایل: نوار کشیدن ── */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* ══════════════════════════════════════
            گالری
        ══════════════════════════════════════ */}
        <div className="
          shrink-0
          flex flex-col gap-2 p-3 bg-[#fcfcfc] border-b border-gray-100
          sm:p-4 sm:gap-3
          lg:w-[42%] lg:border-b-0 lg:border-l lg:p-6 lg:gap-4 lg:overflow-y-auto
        ">
          {/* عکس اصلی */}
          <div className="
            relative w-full overflow-hidden rounded-lg bg-white border border-gray-100 group
            aspect-[4/3] sm:aspect-square lg:aspect-square
          ">
            {displayedImage ? (
              <Image
                src={displayedImage}
                alt={name}
                fill
                className="object-contain p-4 transition-all duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <FiTag size={48} />
              </div>
            )}

            {/* badge دست‌دوم + نشان تست‌شده */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              {tested && <VerifiedBadge size={22} />}
              <span className="bg-[#aa4725] text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                <FiTag size={9} /> دست‌دوم
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => {
                const isActive = displayedImage === img;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={`
                      relative shrink-0 rounded-md border-2 transition-all overflow-hidden bg-white
                      w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20
                      ${isActive
                        ? "border-[#aa4725] shadow-md"
                        : "border-transparent opacity-55 hover:opacity-100"}
                    `}
                  >
                    <Image src={img} alt="" fill className="object-cover p-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            اطلاعات
        ══════════════════════════════════════ */}
        <div className="
          flex-1 overflow-y-auto flex flex-col
          p-4 gap-4 sm:p-6 sm:gap-5 lg:p-8 lg:gap-6
        ">

          {/* برند + نام */}
          <div className="flex items-start gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold leading-snug line-clamp-2">
                {farsi}
              </h2>
              {english && (
                <p className="text-sm sm:text-base lg:text-lg font-semibold mt-0.5 tracking-wide text-gray-600 truncate" dir="ltr">
                  {english}
                </p>
              )}
              {baseProduct?.category && (
                <p className="text-xs text-gray-400 mt-1">{baseProduct.category.title}</p>
              )}
            </div>
            {baseProduct?.brand?.logo && (
              <div className="shrink-0">
                <Image
                  src={baseProduct.brand.logo}
                  alt={baseProduct.brand.title || "brand"}
                  width={56}
                  height={56}
                  className="object-contain opacity-90"
                />
              </div>
            )}
          </div>

          {/* برچسب تست‌شده — هم‌سبک با نشان تأیید روی تصاویر */}
          {tested && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[#1d9bf0]/20 bg-[#1d9bf0]/5">
              <VerifiedBadge size={22} />
              <div>
                <p className="text-sm font-black text-[#1d9bf0]">تست‌شده</p>
                <p className="text-xs text-gray-500 font-semibold">
                  این محصول توسط کارشناسان ما تست و تأیید شده است
                </p>
              </div>
            </div>
          )}

          {/* امتیاز سلامت کلی */}
          {score && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
              overallScore >= 8 ? 'bg-green-50 border-green-100' :
              overallScore >= 5 ? 'bg-amber-50 border-amber-100' :
                                  'bg-red-50 border-red-100'
            }`}>
              <FiShield size={18} className={
                overallScore >= 8 ? 'text-green-600' :
                overallScore >= 5 ? 'text-amber-600' : 'text-red-500'
              } />
              <div>
                <p className="text-xs text-gray-500 font-semibold">کارت سلامت</p>
                <p className={`text-sm font-black ${
                  overallScore >= 8 ? 'text-green-700' :
                  overallScore >= 5 ? 'text-amber-700' : 'text-red-600'
                }`}>
                  امتیاز {overallScore}/10 — {score.label}
                </p>
              </div>
            </div>
          )}

          {/* جزئیات امتیاز فیلدها */}
          {allScores.length > 0 && (
            <div className="bg-gray-50/80 border border-gray-100 p-3 sm:p-4 rounded-lg flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-500 mb-1">جزئیات ارزیابی</p>
              {allScores.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-28 truncate shrink-0">
                    {s.label || s.key}
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-[#aa4725] transition-all"
                      style={{ width: `${(s.rating / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-10 text-left">{s.rating}/10</span>
                </div>
              ))}
            </div>
          )}

          {/* توضیحات */}
          {description && (
            <div className="bg-gray-50/80 border border-gray-100 p-3 sm:p-4 rounded-lg text-xs sm:text-sm text-gray-600 leading-7">
              {description}
            </div>
          )}

          {/* قیمت + دکمه‌ها */}
          <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-100 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] sm:text-xs text-gray-400 font-bold">قیمت:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-bold text-[#aa4725]">
                    {Number(price).toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#aa4725]">تومان</span>
                </div>
              </div>
            </div>

            {/* دکمه‌ها */}
            <div className="flex gap-2 sm:gap-3">
              <Link
                href={`/second-hand/${product.slug || product._id}`}
                onClick={onClose}
                className="
                  flex-[5] h-12 sm:h-13 lg:h-14
                  rounded-lg font-bold text-sm sm:text-base lg:text-lg
                  flex items-center justify-center gap-2 sm:gap-3
                  bg-[#aa4725] text-white hover:bg-[#8e3b1e]
                  transition-all shadow-xl shadow-[#aa4725]/20 active:scale-95
                "
              >
                <FaArrowLeft size={15} />
                صفحه محصول
              </Link>

              <button
                onClick={onToggleWishlist}
                className={`
                  flex-1 h-12 sm:h-13 lg:h-14 min-w-[46px]
                  flex items-center justify-center rounded-lg border-2 transition-all
                  ${isWishlisted
                    ? "bg-red-50 border-red-100 text-red-500"
                    : "bg-white border-gray-100 text-gray-300 hover:border-red-100 hover:text-red-400"}
                `}
              >
                {isWishlisted ? <FaHeart size={20} /> : <FaRegHeart size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}