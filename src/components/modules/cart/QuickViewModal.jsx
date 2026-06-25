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
import GalleryImageViewer from "@/components/ui/GalleryImageViewer";
import VariantSelector from "@/components/templates/product/VariantSelector";
import { buildGalleryImages, valueImages, attrUnits, unitValue } from "@/lib/variantImages";

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

// نمایش مقدار تخفیف یک پله تعدادی (درصد یا مبلغ ثابت تومان)
function formatTierValue(tier) {
  if (!tier) return "";
  return tier.kind === "percent"
    ? `${tier.value}٪`
    : `${Number(tier.value).toLocaleString("fa-IR")} تومان`;
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
  const [unitSelection, setUnitSelection] = useState({}); // واحدِ فعالِ هر ویژگیِ چندواحدی
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

  // چندواحدی: واحدِ فعال، برچسبِ مقدار در آن واحد، و تعویضِ واحد
  const getActiveUnit = (attrKey) =>
    unitSelection[attrKey] ?? attrUnits(product, attrKey)[0];
  const getValueLabel = (attrKey, val) =>
    unitValue(product, attrKey, val, getActiveUnit(attrKey));
  const onUnitChange = (attrKey, unit) =>
    setUnitSelection((prev) => ({ ...prev, [attrKey]: unit }));

  // گالریِ یکتاسازی‌شده با اولویتِ تصاویرِ مقادیرِ انتخاب‌شده (مثلاً رنگ انتخاب‌شده)
  const activeGalleryImages = useMemo(
    () => buildGalleryImages(product, selection),
    [product, selection],
  );

  const [selectedImage, setSelectedImage] = useState(null);
  const displayedImage =
    selectedImage ?? activeGalleryImages[0] ?? product?.mainImage;

  function handleVariantSelect(attrKey, value) {
    const newSelection = { ...selection, [attrKey]: value };
    setSelection(newSelection);
    // گالری با اولویتِ تصاویرِ مقدارِ انتخاب‌شده به‌روزرسانی می‌شود؛ انتخابِ دستیِ
    // تصویر صفر می‌شود تا تصویرِ همان مقدار جلو بیفتد.
    setSelectedImage(null);

    if (optionKeys.every((k) => newSelection[k])) {
      setSelectedVariant(findMatchingVariant(product.variants, newSelection));
    } else {
      setSelectedVariant(null);
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

  // ── تخفیف تعدادی (از سیستم مدیریت تخفیف‌ها — price API) ────────────────────
  const quantityDiscount = priceApiData?.quantityDiscount ?? null;
  const hasQuantityTiers = Boolean(quantityDiscount?.tiers?.length);

  // بهترین پله‌ای که تعداد فعلی به آن رسیده است (هم‌منطق با priceEngine سرور)
  const activeQuantityTier = useMemo(() => {
    if (!hasQuantityTiers) return null;
    let best = null;
    for (const t of quantityDiscount.tiers) {
      if (quantity >= t.minQty && (!best || t.minQty > best.minQty)) best = t;
    }
    return best;
  }, [quantityDiscount, hasQuantityTiers, quantity]);

  const qtyDiscountPerUnit = activeQuantityTier
    ? Math.max(
        0,
        Math.min(
          activeQuantityTier.kind === "percent"
            ? Math.floor((finalTomanPrice * activeQuantityTier.value) / 100)
            : Math.floor(activeQuantityTier.value),
          finalTomanPrice
        )
      )
    : 0;

  // قیمت واحد نمایشی پس از همه تخفیف‌ها (شامل تخفیف تعدادی)
  const displayPrice = finalTomanPrice - qtyDiscountPerUnit;
  const effectiveHasDiscount = hasDiscount || qtyDiscountPerUnit > 0;
  const effectiveDiscountPercent =
    baseTomanPrice > 0
      ? Math.round(((baseTomanPrice - displayPrice) / baseTomanPrice) * 100)
      : 0;

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
            w-9 h-9 flex items-center justify-center text-[#aa4725]
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

            {/* لایهٔ تعاملی: تول‌تیپِ دنبال‌کنندهٔ ماوس + لایت‌باکسِ زوم */}
            <GalleryImageViewer
              src={displayedImage}
              alt={product.name}
              images={activeGalleryImages}
              index={activeGalleryImages.indexOf(displayedImage)}
            />
          </div>

          {/* Thumbnails */}
          {activeGalleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {activeGalleryImages.map((img, idx) => {
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
                      alt={`${product.name} - تصویر ${idx + 1}`}
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
            <VariantSelector
              compact
              optionKeys={optionKeys}
              variantOptions={variantOptions}
              labelMap={labelMap}
              selection={selection}
              onSelect={handleVariantSelect}
              getValueImage={(attrKey, val) =>
                valueImages(product, attrKey, val)[0] || null
              }
              getValueLabel={getValueLabel}
              getUnits={(attrKey) => attrUnits(product, attrKey)}
              getActiveUnit={getActiveUnit}
              onUnitChange={onUnitChange}
            />
          )}

          {/* ── تخفیف تعدادی ── */}
          {hasQuantityTiers && (
            <div className="bg-purple-50/70 border border-purple-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-purple-700">
                تخفیف خرید تعدادی
                {activeQuantityTier && (
                  <span className="mr-1.5 font-medium text-purple-500">
                    ({formatTierValue(activeQuantityTier)} تخفیف فعال شد)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...quantityDiscount.tiers]
                  .sort((a, b) => a.minQty - b.minQty)
                  .map((t) => {
                    const isActive = activeQuantityTier?.minQty === t.minQty;
                    return (
                      <span
                        key={t.minQty}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                          isActive
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-purple-700 border-purple-200"
                        }`}
                      >
                        {t.minQty}+ عدد → {formatTierValue(t)}
                      </span>
                    );
                  })}
              </div>
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
                {effectiveHasDiscount ? (
                  <>
                    {/* قیمت اصلی خط‌خورده */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-gray-300 line-through">
                        {baseTomanPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-300 line-through">تومان</span>
                      {effectiveDiscountPercent > 0 && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                          {effectiveDiscountPercent}٪
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
