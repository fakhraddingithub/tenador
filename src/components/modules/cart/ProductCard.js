"use client";

import Image from "next/image";
import Link from "next/link";
import { FaEye, FaRegHeart, FaHeart, FaArrowLeft } from "react-icons/fa";

export default function ProductCard({
  product,
  onQuickView,
  onToggleWishlist,
  isWishlisted = false,
}) {
  const { mainImage, name, slug, basePrice, discountPrice, label } = product;

  const safePrice = Number(basePrice) || 0;
  const safeDiscount = Number(discountPrice) || null;

  // تابع هوشمند برای جدا کردن فارسی از انگلیسی و پرانتزها
  const splitName = (text) => {
    // پیدا کردن اولین جایی که متن انگلیسی یا پرانتز شروع می‌شود
    const match = text.match(/[a-zA-Z\(].*/);
    if (match) {
      const firstPart = text.substring(0, match.index).trim();
      const secondPart = match[0].trim();
      return { farsi: firstPart, english: secondPart };
    }
    return { farsi: text, english: "" };
  };

  const { farsi, english } = splitName(name);

  // ترجمه لیبل‌ها
  const labelMap = {
    new: { text: "جدید", color: "bg-blue-500" },
    limited: { text: "محدود", color: "bg-purple-500" },
    discount: { text: "تخفیف", color: "bg-red-500" },
    hot: { text: "پرفروش", color: "bg-amber-500" },
  };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-[6px] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:-translate-y-1 overflow-hidden h-full flex flex-col">
      {/* لینک سراسری */}
      <Link href={`/products/${slug}`} className="absolute inset-0 z-0" />
      {/* لوگوی برند - بالا چپ */}
      {product.brand?.icon && (
        <div className="absolute top-3 left-3 z-20">
          <Image
            src={product.brand.icon}
            alt="brand"
            width={30}
            height={30}
            className="object-contain"
          />
        </div>
      )}
      {/* بج‌های کناری - سمت راست */}
      <div className="absolute top-4 right-0 z-20 flex flex-col gap-1 items-end">
        {label && labelMap[label] && (
          <div
            className={`relative py-1 pr-3 pl-5 text-[10px] font-bold text-white shadow-sm bookmark-tag ${labelMap[label].color}`}
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)",
              WebkitClipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)" // برای پشتیبانی در مرورگرهای قدیمی‌تر
            }}
          >
            {labelMap[label].text}
          </div>
        )}
      </div>
      {/* تصویر محصول */}
      <div className="relative w-full aspect-square bg-[#fcfcfc] overflow-hidden">
        <Image
          src={mainImage}
          alt={name}
          fill
          className="object-contain p-8 transition-transform duration-700 group-hover:scale-110"
        />
      </div>
      {/* بخش محتوا */}
      <div className="p-4 flex flex-col items-center text-center relative z-10 pointer-events-none flex-1">
        {/* نام محصول با تفکیک دو خطی */}
        <div className="mb-4 h-[60px] flex flex-col justify-start">
          <h3 className="text-[14px] font-bold text-gray-800 leading-6 mb-1">
            {farsi}
          </h3>
          <p className="text-[12px] text-gray-800 font-medium leading-4 line-clamp-2 dir-ltr">
            {english}
          </p>
        </div>

        {/* بخش قیمت */}
        <div className="mt-auto mb-6 flex flex-col items-center">
          {safeDiscount ? (
            <>
              <span className="text-[11px] line-through text-gray-300 mb-0.5">
                {safePrice.toLocaleString()}
              </span>
              <span className="text-[18px] font-black text-[#aa4725]">
                {safeDiscount.toLocaleString()}{" "}
                <small className="text-[10px] font-bold">تومان</small>
              </span>
            </>
          ) : (
            <span className="text-[18px] font-black text-[#aa4725]">
              {safePrice.toLocaleString()}{" "}
              <small className="text-[10px] font-bold">تومان</small>
            </span>
          )}
        </div>

        {/* دکمه‌های عملیاتی */}
        <div className="flex items-center gap-7 pointer-events-auto border-t border-gray-50 pt-4 w-full justify-center">
          <ActionButton
            icon={<FaEye />}
            label="نمایش سریع"
            onClick={(e) => {
              e.preventDefault();
              onQuickView();
            }}
          />

          <Link href={`/products/${slug}`} onClick={(e) => e.stopPropagation()}>
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
            label={isWishlisted ? "حذف از لیست" : "افزودن به علاقه مندی"}
            onClick={(e) => {
              e.preventDefault();
              onToggleWishlist();
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
      <span className="absolute -top-9 bg-gray-800 text-white text-[9px] px-2 py-1 rounded-[3px] whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-all duration-300 pointer-events-none transform translate-y-1 group-hover/btn:translate-y-0">
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></span>
      </span>

      <button
        onClick={onClick}
        className="text-gray-800 hover:text-[#aa4725] transition-colors duration-300 text-[18px]"
      >
        {icon}
      </button>
    </div>
  );
}
