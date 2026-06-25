"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye, FaRegHeart, FaHeart, FaArrowLeft } from "react-icons/fa";
import { valueImageSwatches } from "@/lib/variantImages";

export default function ProductCard({ product, rate, onQuickView, onToggleWishlist, isWishlisted = false, overlay = null, campaignBadge = null }) {
  const { mainImage, name, slug, basePrice, label } = product;

  // ── قیمت‌ها از سرور می‌آیند (attachListingPrices) — دیگر هیچ درخواست price-API
  //    به ازای هر کارت زده نمی‌شود. در صورت نبودِ مقدار سروری، fallback محلی. ──
  const basePriceToman = useMemo(() => {
    if (product.basePriceToman != null) return product.basePriceToman;
    return Math.floor(Math.round(Number(basePrice) * (rate || 1)) / 1000) * 1000;
  }, [product.basePriceToman, basePrice, rate]);

  const finalPriceToman = product.finalPriceToman != null ? product.finalPriceToman : basePriceToman;
  const discountPercent = product.discountPercent ?? 0;
  const hasDiscount = finalPriceToman < basePriceToman;

  // ── سوآچ‌های واریانت ────────────────────────────────────────────────────────
  // اولویت با تصاویرِ سطحِ مقدار (variantMeta، رفتار جدیدِ Change 2/4)؛ اگر نبود به
  // تصاویرِ سطحِ واریانت (variant.images، رفتار قدیمی) برمی‌گردیم تا محصولاتِ قدیمی
  // هم سوآچ داشته باشند (سازگاریِ عقب‌رو).
  const swatches = useMemo(() => {
    const metaSwatches = valueImageSwatches(product);
    if (metaSwatches.length > 0) return metaSwatches;
    return (product.variants || [])
      .filter((v) => Array.isArray(v.images) && v.images.length > 0)
      .map((v) => ({ key: v._id, image: v.images[0] }));
  }, [product]);
  const [activeImage, setActiveImage]       = useState(mainImage);
  const [activeVariantId, setActiveVariantId] = useState(null);

  const splitName = (text) => {
    const match = text.match(/[a-zA-Z\(].*/);
    if (match) return { farsi: text.substring(0, match.index).trim(), english: match[0].trim() };
    return { farsi: text, english: "" };
  };
  const { farsi, english } = splitName(name);

  // بج «تخفیف» (label === "discount") حذف شد — جای آن بج «ویژه» برای محصولاتی
  // که تخفیف تعدادی فعال دارند نمایش داده می‌شود
  const labelMap = { new: { text: "جدید", color: "bg-[#01a281]" }, limited: { text: "محدود", color: "bg-purple-500" }, hot: { text: "پرفروش", color: "bg-amber-500" } };

  const badgeShape = { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)" };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-[6px] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 overflow-hidden h-full flex flex-col">
      <Link href={`/products/${slug}`} className="absolute inset-0 z-0" />

      {/* اسلات اختیاری روکش (ربان/استیکر/بج رویداد) — صفحات معمولی چیزی پاس نمی‌دهند */}
      {overlay}

      {product.brand?.icon && (
        <div className="absolute top-3 left-3 z-20">
          <Image src={product.brand.icon} alt="brand" width={30} height={30} className="object-contain" />
        </div>
      )}

      {/* Badges — لبه‌ی راستِ همه‌ی بج‌ها روی لبه‌ی راستِ کارت قفل می‌شود؛
          dir=rtl + items-start یعنی inline-start = سمت راست (مستقل از طول متن) */}
      <div dir="rtl" className="absolute top-4 right-0 z-20 flex flex-col gap-1 items-start">
        {/* بج کمپین — دقیقاً همان استایلِ بج‌های تخفیف/محدود (همان clip-path و کلاس‌ها)؛
            فقط متن و رنگ از داده‌ی کمپین (cardCustomization.badge) خوانده می‌شود. */}
        {campaignBadge?.text && (
          <div className="relative py-1 pr-3 pl-5 text-[10px] font-bold shadow-sm"
            style={{
              ...badgeShape,
              background: campaignBadge.bgColor || "var(--color-primary)",
              color: campaignBadge.textColor || "#ffffff",
            }}>
            {campaignBadge.text}
          </div>
        )}

        {/* درصد تخفیف */}
        {hasDiscount && discountPercent > 0 && (
          <div className="relative py-1 pr-3 pl-5 text-[10px] font-bold text-white shadow-sm bg-red-500"
            style={badgeShape}>
            {discountPercent} ٪
          </div>
        )}

        {/* بج «ویژه» — محصول تخفیف تعدادی فعال دارد (رنگ ثانویه‌ی برند) */}
        {product.hasQuantityDiscount && (
          <div className="relative py-1 pr-3 pl-5 text-[10px] font-bold text-[#1a1a1a] shadow-sm"
            style={{ ...badgeShape, background: "var(--color-secondary)" }}>
            ویژه
          </div>
        )}

        {/* لیبل محصول (جدید / محدود / پرفروش) */}
        {label && labelMap[label] && (
          <div className={`relative py-1 pr-3 pl-5 text-[10px] font-bold text-white shadow-sm ${labelMap[label].color}`}
            style={badgeShape}>
            {labelMap[label].text}
          </div>
        )}
      </div>

      {/* تصویر */}
      <Link href={`/products/${slug}`} className="relative w-full aspect-square bg-[#fcfcfc] overflow-hidden">
        <Image src={activeImage} alt={name} fill className="object-contain p-3 transition-all duration-500 group-hover:scale-110" />
      </Link>

      {/* سوآچ‌های واریانت */}
      <div className="relative z-20 flex items-center justify-center gap-1.5 h-[56px] bg-white">
        {swatches.length > 0 ? swatches.map((swatch) => (
          <button key={swatch.key} type="button"
            title={swatch.value || undefined}
            onMouseEnter={() => { setActiveImage(swatch.image); setActiveVariantId(swatch.key); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveImage(swatch.image); setActiveVariantId(swatch.key); }}
            className={`relative w-8 h-8 rounded-[6px] overflow-hidden border-2 transition-all duration-200 ${activeVariantId === swatch.key ? "border-[var(--color-primary)] scale-110 shadow-md" : "border-gray-100 hover:border-[color-mix(in_srgb,var(--color-primary)_60%,transparent)] opacity-80 hover:opacity-100"}`}>
            <Image src={swatch.image} alt={swatch.value || name} fill className="object-cover" />
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
              <span className="text-[18px] font-black text-[var(--color-primary)]">
                {finalPriceToman.toLocaleString("fa-IR")} <small className="text-[10px] font-bold">تومان</small>
              </span>
            </>
          ) : (
            <span className="text-[18px] font-black text-[var(--color-primary)]">
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
      <button onClick={onClick} className="text-gray-800 hover:text-[var(--color-primary)] transition-colors duration-300 text-[18px]">{icon}</button>
    </div>
  );
}
