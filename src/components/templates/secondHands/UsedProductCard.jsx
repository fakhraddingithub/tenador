"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye, FaRegHeart, FaHeart, FaArrowLeft } from "react-icons/fa";
import { FiStar } from "react-icons/fi";

export default function UsedProductCard({
  product,
  onQuickView,
  onToggleWishlist,
  isWishlisted = false,
}) {
  const { name, price, overallScore, images, baseProduct } = product;
  const mainImage = images?.[0] || baseProduct?.mainImage;
  const [activeImage] = useState(mainImage);

  const splitName = (text = "") => {
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
      return {
        farsi: text.substring(0, match.index).trim(),
        english: match[0].trim(),
      };
    }
    return { farsi: text, english: "" };
  };

  const { farsi, english } = splitName(name);

  return (
    <div className="group relative bg-white border border-gray-200 rounded-[6px] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 overflow-hidden h-full flex flex-col">
      <Link
        href={`/second-hands/${product._id}`}
        className="absolute inset-0 z-0"
      />

      {/* لوگو برند - هماهنگ با سایز کارت اصلی */}
      {baseProduct?.brand?.icon && (
        <div className="absolute top-3 left-3 z-20">
          <Image
            src={baseProduct.brand.icon}
            alt={baseProduct.brand.title || "brand"}
            width={30}
            height={30}
            className="object-contain"
          />
        </div>
      )}

      {/* تصویر اصلی - پدینگ و افکت هاور بروزرسانی شد */}
      <Link
        href={`/second-hands/${product._id}`}
        className="relative w-full aspect-square bg-[#fcfcfc] overflow-hidden"
      >
        <Image
          src={activeImage || "/images/placeholder.jpg"}
          alt={name}
          fill
          className="object-contain p-3 transition-all duration-500 group-hover:scale-110"
        />
      </Link>

      {/* امتیاز سلامت - هماهنگ با ارتفاع باکس واریانت‌ها */}
      <div className="relative z-20 flex items-center justify-center h-[56px] bg-white">
        <div className="flex items-center gap-2 px-3 text-[var(--color-primary)]">
          <FiStar size={16} className="fill-current" />
          <span className="text-[13px] font-bold">امتیاز سلامت:</span>
          <span className="text-[15px] font-black">{`${overallScore}/10`}</span>
        </div>
      </div>

      {/* محتوا و متون کالا */}
      <div className="p-4 pt-0 flex flex-col items-center text-center relative z-10 pointer-events-none flex-1">
        <div className="mb-4 h-[60px] flex flex-col justify-start">
          <h3 className="text-[14px] font-bold text-gray-800 leading-6 mb-1">
            {farsi}
          </h3>
          <p className="text-[12px] text-gray-800 font-medium leading-4 line-clamp-2 dir-ltr">
            {english}
          </p>
        </div>

        {/* قیمت به همراه اعداد فارسی */}
        <div className="mt-auto flex flex-col items-center">
          <span className="text-[18px] font-black text-[#aa4725]">
            {Number(price).toLocaleString("fa-IR")}{" "}
            <small className="text-[10px] font-bold">تومان</small>
          </span>
        </div>

        {/* دکمه‌های اکشن بار پایینی */}
        <div className="flex items-center gap-7 pointer-events-auto border-t border-gray-50 pt-4 w-full justify-center">
          <ActionButton
            icon={<FaEye />}
            label="نمایش سریع"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.();
            }}
          />

          <Link
            href={`/second-hands/${product._id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ActionButton icon={<FaArrowLeft />} label="صفحه محصول" />
          </Link>

          <ActionButton
            icon={
              isWishlisted ? (
                <FaHeart className="text-red-500" />
              ) : (
                <FaRegHeart />
              )
            }
            label={isWishlisted ? "حذف از لیست" : "افزودن به علاقه‌مندی"}
            onClick={(e) => {
              e.preventDefault();
              onToggleWishlist?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <div className="relative group/btn flex flex-col items-center">
      {/* تول‌تیپ پیشرفته کپی شده از کامپوننت اصلی به همراه فلش کوچک زیرین */}
      <span className="absolute -top-9 bg-gray-800 text-white text-[9px] px-2 py-1 rounded-[3px] whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-1 group-hover/btn:translate-y-0">
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </span>
      <button
        onClick={onClick}
        className="text-gray-800 hover:text-[#aa4725] transition-colors duration-300 text-[18px] cursor-pointer"
      >
        {icon}
      </button>
    </div>
  );
}