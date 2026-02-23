"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  FaTimes, FaShoppingCart, FaHeart, FaRegHeart, FaPlus, FaMinus,
} from "react-icons/fa";
import { addToCart } from "@/lib/cart";
import { toast } from "react-toastify";

/* ─────────────────────────────────────────
   Helpers (همان منطق ProductInfo)
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
    Object.entries(map).map(([k, s]) => [k, Array.from(s)])
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
  isOpen,
  onClose,
  onToggleWishlist,
  isWishlisted,
}) {
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);

  const hasVariants =
    Array.isArray(product?.variants) && product.variants.length > 0;

  /* ── Label map from category.variantAttributes ── */
  const labelMap = useMemo(
    () => buildLabelMap(product?.category?.variantAttributes),
    [product?.category]
  );

  const variantOptions = useMemo(
    () => groupVariantOptions(product?.variants),
    [product?.variants]
  );

  const optionKeys = Object.keys(variantOptions);

  /* ── Gallery: base + all variant images ── */
  const allImages = useMemo(() => {
    if (!product) return [];
    const base = [product.mainImage, ...(product.gallery || [])].filter(Boolean);
    const variantImgs = (product.variants || [])
      .flatMap((v) => v.images || [])
      .filter(Boolean)
      .filter((img) => !base.includes(img));
    return [...base, ...variantImgs];
  }, [product]);

  /* Active gallery image — driven by selected variant */
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
  // Derive the displayed image: if user manually picked a thumb use it,
  // otherwise use the first of activeGalleryImages
  const displayedImage = selectedImage ?? activeGalleryImages[0] ?? product?.mainImage;

  /* When variant changes, jump gallery to its first image */
  function handleVariantSelect(attrKey, value) {
    const newSelection = { ...selection, [attrKey]: value };
    setSelection(newSelection);

    if (optionKeys.every((k) => newSelection[k])) {
      const matched = findMatchingVariant(product.variants, newSelection);
      setSelectedVariant(matched);
      // Jump gallery to first variant image
      if (matched?.images?.length) {
        setSelectedImage(matched.images[0]);
      }
    } else {
      setSelectedVariant(null);
      setSelectedImage(null);
    }
  }

  /* ── Price ── */
  const displayPrice = selectedVariant?.price ?? product?.basePrice ?? 0;

  /* ── Stock ── */
  const variantStock = selectedVariant?.stock ?? null;
  const isOutOfStock =
    hasVariants ? selectedVariant !== null && variantStock === 0 : false;

  /* ── Add to cart ── */
  function handleAddToCart() {
    if (hasVariants) {
      if (optionKeys.some((k) => !selection[k])) {
        toast.warning("لطفاً تمام ویژگی‌های محصول را انتخاب کنید");
        return;
      }
      if (!selectedVariant) {
        toast.error("این ترکیب موجود نیست");
        return;
      }
      if (isOutOfStock) {
        toast.error("این واریانت موجود نیست");
        return;
      }
      addToCart(product, quantity, selectedVariant);
    } else {
      addToCart(product, quantity, null);
    }
    toast.success("به سبد خرید اضافه شد");
  }

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[6px] shadow-2xl overflow-hidden flex flex-col md:flex-row text-right">

        {/* دکمه بستن */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-[6px] bg-gray-100/80 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md border border-white/20"
        >
          <FaTimes size={18} />
        </button>

        {/* ── چپ: گالری ── */}
        <div className="w-full md:w-[45%] p-6 flex flex-col gap-4 bg-[#fcfcfc] border-l border-gray-100">
          {/* عکس اصلی */}
          <div className="relative aspect-square w-full rounded-[6px] overflow-hidden bg-white border border-gray-100 group">
            <Image
              src={displayedImage}
              alt={product.name}
              fill
              className="object-contain p-6 transition-all duration-500 group-hover:scale-110"
            />
          </div>

          {/* Thumbnails */}
          <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
            {activeGalleryImages.map((img) => {
              const isActive = displayedImage === img;
              return (
                <button
                  key={img}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-[6px] border-2 transition-all overflow-hidden bg-white ${
                    isActive
                      ? "border-[#aa4725] shadow-md"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt="thumb" fill className="object-cover p-1" />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── راست: اطلاعات ── */}
        <div className="w-full md:w-[55%] p-8 flex flex-col overflow-y-auto">

          {/* برند و عنوان */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] bg-[#aa4725] text-white px-3 py-1 rounded-[4px] font-bold tracking-wider uppercase">
                {product.brand?.name}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                کد کالا: {product.sku}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1a1a1a] leading-tight mb-4">
              {product.name}
            </h2>
            <div className="bg-gray-50/80 border border-gray-100 p-4 rounded-[6px] text-sm text-gray-600 leading-7">
              <div
                className="line-clamp-4 overflow-y-auto max-h-32"
                dangerouslySetInnerHTML={{
                  __html: product.shortDescription || product.longDescription,
                }}
              />
            </div>
          </div>

          {/* ── Variant Selectors ── */}
          {hasVariants && (
            <div className="flex flex-col gap-6 mb-8">
              {optionKeys.map((attrKey) => {
                const values = variantOptions[attrKey];
                const label = labelMap[attrKey] || attrKey;

                return (
                  <div key={attrKey} className="flex flex-col gap-3">
                    <h4 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-1 h-4 bg-[#aa4725] rounded-full" />
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
                        const hasStock = product.variants.some(
                          (v) =>
                            v.attributes?.[attrKey] === val &&
                            (v.stock === undefined || v.stock > 0)
                        );

                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={!hasStock}
                            onClick={() => handleVariantSelect(attrKey, val)}
                            title={!hasStock ? "ناموجود" : val}
                            className={`
                              relative min-w-[60px] px-4 h-11 rounded-[6px] text-xs font-bold
                              transition-all duration-300 border flex items-center justify-center gap-2
                              ${
                                isActive
                                  ? "bg-[#aa4725] text-white border-[#aa4725] shadow-lg shadow-[#aa4725]/30 scale-[1.05]"
                                  : hasStock
                                  ? "bg-white/40 backdrop-blur-md border-gray-200 text-gray-500 hover:border-[#aa4725]/40 hover:bg-white/60"
                                  : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through"
                              }
                            `}
                          >
                            {isActive && (
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            )}
                            {val}
                            {!hasStock && (
                              <span className="absolute inset-0 pointer-events-none rounded-[6px] overflow-hidden">
                                <span className="absolute inset-0 bg-gradient-to-br from-transparent via-gray-200/40 to-transparent" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* فیدبک موجودی */}
              {selectedVariant && (
                <p className={`text-xs font-medium ${isOutOfStock ? "text-red-500" : "text-green-600"}`}>
                  {isOutOfStock
                    ? "این واریانت موجود نیست"
                    : `موجودی: ${variantStock} عدد`}
                </p>
              )}
            </div>
          )}

          {/* ── قیمت و خرید ── */}
          <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              {/* قیمت */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-400 font-bold">قیمت نهایی:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#aa4725]">
                    {displayPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-[#aa4725]">تومان</span>
                </div>
              </div>

              {/* تعداد */}
              <div className="flex items-center bg-gray-100 rounded-[6px] p-1 border border-gray-200">
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm hover:text-[#aa4725] transition-all"
                >
                  <FaPlus size={12} />
                </button>
                <span className="px-5 font-bold text-lg text-[#1a1a1a]">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-[4px] shadow-sm hover:text-red-500 transition-all"
                >
                  <FaMinus size={12} />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-[5] h-14 rounded-[6px] font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${
                  isOutOfStock
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                    : "bg-[#aa4725] text-white hover:bg-[#8e3b1e] shadow-[#aa4725]/20"
                }`}
              >
                <FaShoppingCart size={20} />
                افزودن به سبد خرید
              </button>

              <button
                onClick={onToggleWishlist}
                className={`flex-1 h-14 flex items-center justify-center rounded-[6px] border-2 transition-all ${
                  isWishlisted
                    ? "bg-red-50 border-red-100 text-red-500"
                    : "bg-white border-gray-100 text-gray-300 hover:border-red-100 hover:text-red-400"
                }`}
              >
                {isWishlisted ? <FaHeart size={24} /> : <FaRegHeart size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}