"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  FaTimes,
  FaShoppingCart,
  FaHeart,
  FaRegHeart,
  FaPlus,
  FaMinus,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useOrderFlowCart } from "@/components/modules/orderFlow/useOrderFlowCart";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function groupVariantOptions(variants = []) {
  const map = {};
  for (const v of variants) {
    for (const [key, val] of Object.entries(v.attributes || {})) {
      if (!map[key]) map[key] = new Set();
      map[key].add(val);
    }
  }
  return Object.fromEntries(
    Object.entries(map).map(([k, s]) => [k, Array.from(s)]),
  );
}

function findMatchingVariant(variants = [], selection = {}) {
  if (!Object.keys(selection).length) return null;
  return (
    variants.find((v) => {
      const attrs = v.attributes || {};
      return Object.entries(selection).every(([k, val]) => attrs[k] === val);
    }) || null
  );
}

function buildLabelMap(variantAttributes = []) {
  return Object.fromEntries(variantAttributes.map((a) => [a.name, a.label]));
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export default function QuickViewModal({
  product,
  rate,
  isOpen,
  onClose,
  onToggleWishlist,
  isWishlisted,
}) {
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);

  // افزودن به سبد با پشتیبانی از فرایند سفارش
  const { requestAddToCart, flowModal } = useOrderFlowCart();

  const hasVariants =
    Array.isArray(product?.variants) && product.variants.length > 0;

  const labelMap = useMemo(
    () => buildLabelMap(product?.category?.variantAttributes),
    [product?.category],
  );

  const variantOptions = useMemo(
    () => groupVariantOptions(product?.variants),
    [product?.variants],
  );

  const optionKeys = Object.keys(variantOptions);

  const allImages = useMemo(() => {
    if (!product) return [];
    const base = [product.mainImage, ...(product.gallery || [])].filter(
      Boolean,
    );
    const variantImgs = (product.variants || [])
      .flatMap((v) => v.images || [])
      .filter(Boolean)
      .filter((img) => !base.includes(img));
    return [...base, ...variantImgs];
  }, [product]);

  const activeGalleryImages = useMemo(() => {
    if (
      selectedVariant &&
      Array.isArray(selectedVariant.images) &&
      selectedVariant.images.length > 0
    ) {
      const selectedImgs = selectedVariant.images.filter(Boolean);
      const rest = allImages.filter((img) => !selectedImgs.includes(img));
      return [...selectedImgs, ...rest];
    }
    return allImages;
  }, [allImages, selectedVariant]);

  const [selectedImage, setSelectedImage] = useState(null);
  const displayedImage =
    selectedImage ?? activeGalleryImages[0] ?? product?.mainImage;

  function handleVariantSelect(attrKey, value) {
    const newSelection = { ...selection, [attrKey]: value };
    setSelection(newSelection);

    if (optionKeys.every((k) => newSelection[k])) {
      const matched = findMatchingVariant(product.variants, newSelection);
      setSelectedVariant(matched);
      if (matched?.images?.length) {
        setSelectedImage(matched.images[0]);
      }
    } else {
      setSelectedVariant(null);
      setSelectedImage(null);
    }
  }

  // ── قیمت پایه به تومان ────────────────────────────────────────────────────
  const baseTomanPrice = useMemo(() => {
    const eurPrice = selectedVariant
      ? Number(selectedVariant.price)
      : Number(product?.basePrice);
    return Math.floor(Math.round(eurPrice * (rate || 0)) / 1000) * 1000;
  }, [selectedVariant, product?.basePrice, rate]);

  // ── دریافت داده‌های تخفیف از price API ─────────────────────────────────────
  const [priceApiData, setPriceApiData] = useState(null);

  useEffect(() => {
    if (!product?._id || !rate) return;
    let cancelled = false;
    setPriceApiData(null);
    fetch(`/api/product/${product._id}/price`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && !data.error) setPriceApiData(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?._id, rate]);

  // ── قیمت نهایی و تخفیف (با توجه به واریانت انتخاب‌شده) ────────────────────
  const { finalTomanPrice, discountPercent, hasDiscount } = useMemo(() => {
    if (!priceApiData) return { finalTomanPrice: baseTomanPrice, discountPercent: 0, hasDiscount: false };

    if (selectedVariant) {
      // پیدا کردن واریانت در داده price API
      const vData = priceApiData.variants?.find((v) => String(v._id) === String(selectedVariant._id));
      if (vData && vData.finalPriceToman < vData.basePriceToman) {
        return { finalTomanPrice: vData.finalPriceToman, discountPercent: vData.discountPercent || 0, hasDiscount: true };
      }
      return { finalTomanPrice: baseTomanPrice, discountPercent: 0, hasDiscount: false };
    }

    // بدون واریانت: تخفیف کلی محصول
    if (priceApiData.finalPriceToman < priceApiData.basePriceToman) {
      return { finalTomanPrice: priceApiData.finalPriceToman, discountPercent: priceApiData.discountPercent || 0, hasDiscount: true };
    }
    return { finalTomanPrice: baseTomanPrice, discountPercent: 0, hasDiscount: false };
  }, [priceApiData, selectedVariant, baseTomanPrice]);

  // displayPrice همان قیمت نهایی است (برای سازگاری با کدهای زیر)
  const displayPrice = finalTomanPrice;

  function handleAddToCart() {
    let variantId = null;

    if (hasVariants) {
      if (optionKeys.some((k) => !selection[k])) {
        toast.warning("لطفاً تمام ویژگی‌های محصول را انتخاب کنید");
        return;
      }
      if (!selectedVariant) {
        toast.error("این ترکیب موجود نیست");
        return;
      }
      variantId = selectedVariant._id;
    }

    // اگر دسته‌بندی فرایند داشته باشد مودال باز می‌شود، وگرنه مستقیم افزوده می‌شود
    requestAddToCart({
      product,
      quantity,
      variantId,
      onAdded: () => toast.success("به سبد خرید اضافه شد"),
    });
  }

  if (!isOpen || !product) return null;

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
      <div
        className="
        relative w-full bg-white shadow-2xl overflow-hidden
        flex flex-col
        /* Mobile: bottom sheet با rounded-t */
        rounded-t-2xl max-h-[92dvh]
        /* Tablet+ : modal مرکزی */
        sm:rounded-[8px] sm:max-w-2xl sm:max-h-[88vh]
        /* Desktop: دو ستونی */
        lg:max-w-5xl lg:flex-row lg:max-h-[90vh]
        text-right
      "
      >
        {/* ── دکمه بستن ── */}
        <button
          onClick={onClose}
          className="
            absolute top-3 left-3 z-50
            w-9 h-9 flex items-center justify-center
            rounded-full bg-gray-100/90 hover:bg-[#aa4725] hover:text-white
            transition-all border border-white/30
            shadow-sm
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
            موبایل/تبلت: ردیف افقی بالا
            دسکتاپ: ستون چپ
        ══════════════════════════════════════ */}
        <div
          className="
          shrink-0
          /* موبایل: فضای کوچک بالا */
          flex flex-col gap-2 p-3 bg-[#fcfcfc] border-b border-gray-100
          /* تبلت */
          sm:p-4 sm:gap-3
          /* دسکتاپ: ستون چپ ثابت */
          lg:w-[42%] lg:border-b-0 lg:border-l lg:p-6 lg:gap-4 lg:overflow-y-auto
        "
        >
          {/* عکس اصلی */}
          <div
            className="
            relative w-full overflow-hidden rounded-lg bg-white border border-gray-100 group
            /* موبایل: کوچک‌تر */
            aspect-[4/3]
            /* تبلت */
            sm:aspect-square
            /* دسکتاپ: مربع کامل */
            lg:aspect-square
          "
          >
            <Image
              src={displayedImage}
              alt={product.name}
              fill
              className="object-contain p-4 transition-all duration-500 group-hover:scale-110"
            />
          </div>

          {/* Thumbnails */}
          {activeGalleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {activeGalleryImages.map((img) => {
                const isActive = displayedImage === img;
                return (
                  <button
                    key={img}
                    onClick={() => setSelectedImage(img)}
                    className={`
                      relative shrink-0 rounded-md border-2 transition-all overflow-hidden bg-white
                      w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20
                      ${
                        isActive
                          ? "border-[#aa4725] shadow-md"
                          : "border-transparent opacity-55 hover:opacity-100"
                      }
                    `}
                  >
                    <Image
                      src={img}
                      alt="thumb"
                      fill
                      className="object-cover p-1"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            اطلاعات
            موبایل/تبلت: اسکرول‌پذیر پایین
            دسکتاپ: ستون راست اسکرول‌پذیر
        ══════════════════════════════════════ */}
        <div
          className="
          flex-1 overflow-y-auto
          flex flex-col
          p-4 gap-4
          sm:p-6 sm:gap-5
          lg:p-8 lg:gap-6
        "
        >
          {/* برند و عنوان */}
          <div className="flex items-start gap-3 mt-1">
            <div className="flex-1 min-w-0">
              {(() => {
                const match = product.name.match(/[a-zA-Z\(].*/);
                const farsi = match
                  ? product.name.substring(0, match.index).trim()
                  : product.name;
                const english = match ? match[0].trim() : "";
                return (
                  <>
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold leading-snug line-clamp-2">
                      {farsi}
                    </h2>
                    {english && (
                      <p
                        className="text-sm sm:text-base lg:text-lg font-semibold mt-0.5 tracking-wide text-gray-600 truncate"
                        dir="ltr"
                      >
                        {english}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            {product.brand?.logo && (
              <a
                href={`/brands/${product.brand.slug || product.brand._id}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                title={product.brand.title || product.brand.name}
              >
                <img
                  src={product.brand.logo}
                  alt={product.brand.title || product.brand.name}
                  className="h-12 sm:h-14 lg:h-16 w-auto object-contain opacity-100 hover:opacity-75 transition-opacity"
                />
              </a>
            )}
          </div>

          {/* توضیحات کوتاه — بدون اسکرول */}
          <div className="bg-gray-50/80 border border-gray-100 p-3 sm:p-4 rounded-lg text-xs sm:text-sm text-gray-600 leading-7">
            <div
              dangerouslySetInnerHTML={{
                __html: product.shortDescription || product.longDescription,
              }}
            />
          </div>

          {/* ── Variant Selectors ── */}
          {hasVariants && (
            <div className="flex flex-col gap-4 sm:gap-5">
              {optionKeys.map((attrKey) => {
                const values = variantOptions[attrKey];
                const label = labelMap[attrKey] || attrKey;

                return (
                  <div key={attrKey} className="flex flex-col gap-2 sm:gap-3">
                    <h4 className="text-[13px] sm:text-[14px] font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-1 h-4 bg-[#aa4725] rounded-full shrink-0" />
                      {label}
                      {selection[attrKey] && (
                        <span className="font-normal text-gray-400 text-xs mr-1">
                          {selection[attrKey]}
                        </span>
                      )}
                    </h4>

                    <div className="flex flex-wrap gap-2">
                      {values.map((val) => {
                        const isActive = selection[attrKey] === val;

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleVariantSelect(attrKey, val)}
                            title={val}
                            className={`
                              relative min-w-[52px] sm:min-w-[60px] px-3 sm:px-4
                              h-9 sm:h-10 lg:h-11
                              rounded-lg text-xs font-bold
                              transition-all duration-300 border
                              flex items-center justify-center gap-1.5
                              ${
                                isActive
                                  ? "bg-[#aa4725] text-white border-[#aa4725] shadow-lg shadow-[#aa4725]/30 scale-[1.05]"
                                  : "bg-white/40 backdrop-blur-md border-gray-200 text-gray-500 hover:border-[#aa4725]/40 hover:bg-white/60"
                              }
                            `}
                          >
                            {isActive && (
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shrink-0" />
                            )}
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── قیمت و خرید ── */}
          <div className="mt-auto pt-4 sm:pt-5 border-t border-gray-100 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between">
              {/* قیمت */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] sm:text-xs text-gray-400 font-bold">
                  قیمت نهایی:
                </span>
                {hasDiscount ? (
                  <>
                    {/* قیمت اصلی خط‌خورده */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-300 line-through">
                        {baseTomanPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-300 line-through">تومان</span>
                      {discountPercent > 0 && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                          {discountPercent}٪
                        </span>
                      )}
                    </div>
                    {/* قیمت تخفیف‌خورده */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold text-[#aa4725]">
                        {displayPrice.toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#aa4725]">
                        تومان
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-[#aa4725]">
                      {displayPrice.toLocaleString()}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#aa4725]">
                      تومان
                    </span>
                  </div>
                )}
              </div>

              {/* تعداد */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-[#aa4725] transition-all"
                >
                  <FaPlus size={11} />
                </button>
                <span className="px-3 sm:px-4 font-bold text-base sm:text-lg text-[#1a1a1a] min-w-[2.5rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white rounded-md shadow-sm hover:text-[#aa4725] transition-all"
                >
                  <FaMinus size={11} />
                </button>
              </div>
            </div>

            {/* دکمه‌ها */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleAddToCart}
                className="
                  flex-[5] h-12 sm:h-13 lg:h-14
                  rounded-lg font-bold text-sm sm:text-base lg:text-lg
                  flex items-center justify-center gap-2 sm:gap-3
                  transition-all shadow-xl active:scale-95
                  bg-[#aa4725] text-white hover:bg-[#8e3b1e] shadow-[#aa4725]/20
                "
              >
                <FaShoppingCart size={17} />
                افزودن به سبد خرید
              </button>

              <button
                onClick={onToggleWishlist}
                className={`
                  flex-1 h-12 sm:h-13 lg:h-14
                  flex items-center justify-center rounded-lg border-2 transition-all
                  min-w-[46px]
                  ${
                    isWishlisted
                      ? "bg-red-50 border-red-100 text-red-500"
                      : "bg-white border-gray-100 text-gray-300 hover:border-red-100 hover:text-red-400"
                  }
                `}
              >
                {isWishlisted ? (
                  <FaHeart size={20} />
                ) : (
                  <FaRegHeart size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* مودال فرایند سفارش */}
      {flowModal}
    </div>
  );
}
