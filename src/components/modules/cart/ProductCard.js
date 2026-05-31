"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye, FaRegHeart, FaHeart, FaArrowLeft } from "react-icons/fa";

export default function ProductCard({ product, rate, onQuickView, onToggleWishlist, isWishlisted = false }) {
  const { mainImage, name, slug, basePrice, label } = product;

  // ── قیمت پایه به تومان ────────────────────────────────────────────────────
  const basePriceToman = useMemo(() => {
    return Math.floor(Math.round(Number(basePrice) * (rate || 1)) / 1000) * 1000;
  }, [basePrice, rate]);

  // ── دریافت تخفیف از price API ─────────────────────────────────────────────
  const [discountData, setDiscountData] = useState(null);

  useEffect(() => {
    if (!product?._id) return;
    let cancelled = false;
    fetch(`/api/product/${product._id}/price`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.error) return;
        if (data.finalPriceToman < data.basePriceToman) {
          setDiscountData({ finalPriceToman: data.finalPriceToman, discountPercent: data.discountPercent || 0 });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?._id]);

  const hasDiscount    = discountData !== null;
  const finalPriceToman = hasDiscount ? discountData.finalPriceToman : basePriceToman;

  // ── واریانت‌ها ──────────────────────────────────────────────────────────────
  const variantsWithImages = useMemo(
    () => (product.variants || []).filter((v) => Array.isArray(v.images) && v.images.length > 0),
    [product.variants]
  );
  const [activeImage, setActiveImage]       = useState(mainImage);
  const [activeVariantId, setActiveVariantId] = useState(null);

  const splitName = (text) => {
    const match = text.match(/[a-zA-Z\(].*/);
    if (match) return { farsi: text.substring(0, match.index).trim(), english: match[0].trim() };
    return { farsi: text, english: "" };
  };
  const { farsi, english } = splitName(name);

  const labelMap = { new: { text: "جدید", color: "bg-[#01a281]" }, limited: { text: "محدود", color: "bg-purple-500" }, discount: { text: "تخفیف", color: "bg-red-500" }, hot: { text: "پرفروش", color: "bg-amber-500" } };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-[6px] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 overflow-hidden h-full flex flex-col">
      <Link href={`/products/${slug}`} className="absolute inset-0 z-0" />

      {product.brand?.icon && (
        <div className="absolute top-3 left-3 z-20">
          <Image src={product.brand.icon} alt="brand" width={30} height={30} className="object-contain" />
        </div>
      )}

      {/* Badge */}
      <div className="absolute top-4 right-0 z-20 flex flex-col gap-1 items-end">
        {hasDiscount && discountData.discountPercent > 0 ? (
          <div className="relative py-1 pr-3 pl-5 text-[10px] font-bold text-white shadow-sm bg-red-500"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)" }}>
            {discountData.discountPercent} ٪
          </div>
        ) : label && labelMap[label] ? (
          <div className={`relative py-1 pr-3 pl-5 text-[10px] font-bold text-white shadow-sm ${labelMap[label].color}`}
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)" }}>
            {labelMap[label].text}
          </div>
        ) : null}
      </div>

      {/* تصویر */}
      <Link href={`/products/${slug}`} className="relative w-full aspect-square bg-[#fcfcfc] overflow-hidden">
        <Image src={activeImage} alt={name} fill className="object-contain p-3 transition-all duration-500 group-hover:scale-110" />
      </Link>

      {/* واریانت‌ها */}
      <div className="relative z-20 flex items-center justify-center gap-1.5 h-[56px] bg-white">
        {variantsWithImages.length > 0 ? variantsWithImages.map((variant) => (
          <button key={variant._id} type="button"
            onMouseEnter={() => { setActiveImage(variant.images[0]); setActiveVariantId(variant._id); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveImage(variant.images[0]); setActiveVariantId(variant._id); }}
            className={`relative w-8 h-8 rounded-[6px] overflow-hidden border-2 transition-all duration-200 ${activeVariantId === variant._id ? "border-[#aa4725] scale-110 shadow-md" : "border-gray-100 hover:border-[#aa4725]/60 opacity-80 hover:opacity-100"}`}>
            <Image src={variant.images[0]} alt="" fill className="object-cover" />
          </button>
        )) : <div className="h-8" />}
      </div>

      {/* محتوا */}
      <div className="p-4 pt-0 flex flex-col items-center text-center relative z-10 pointer-events-none flex-1">
        <div className="mb-4 h-[60px] flex flex-col justify-start">
          <h3 className="text-[14px] font-bold text-gray-800 leading-6 mb-1">{farsi}</h3>
          <p className="text-[12px] text-gray-800 font-medium leading-4 line-clamp-2 dir-ltr">{english}</p>
        </div>

        {/* قیمت */}
        <div className="mt-auto flex flex-col items-center">
          {hasDiscount ? (
            <>
              <span className="text-[12px] line-through text-gray-300 mb-0.5 leading-none">
                {basePriceToman.toLocaleString("fa-IR")} <small className="text-[10px]">تومان</small>
              </span>
              <span className="text-[18px] font-black text-[#aa4725]">
                {finalPriceToman.toLocaleString("fa-IR")} <small className="text-[10px] font-bold">تومان</small>
              </span>
            </>
          ) : (
            <span className="text-[18px] font-black text-[#aa4725]">
              {basePriceToman.toLocaleString("fa-IR")} <small className="text-[10px] font-bold">تومان</small>
            </span>
          )}
        </div>

        <div className="flex items-center gap-7 pointer-events-auto border-t border-gray-50 pt-4 w-full justify-center">
          <ActionButton icon={<FaEye />} label="نمایش سریع" onClick={(e) => { e.preventDefault(); onQuickView(); }} />
          <Link href={`/products/${slug}`} onClick={(e) => e.stopPropagation()}>
            <ActionButton icon={<FaArrowLeft />} label="صفحه محصول" />
          </Link>
          <ActionButton
            icon={isWishlisted ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
            label={isWishlisted ? "حذف از لیست" : "افزودن به علاقه مندی"}
            onClick={(e) => { e.preventDefault(); onToggleWishlist(); }}
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
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </span>
      <button onClick={onClick} className="text-gray-800 hover:text-[#aa4725] transition-colors duration-300 text-[18px]">{icon}</button>
    </div>
  );
}
