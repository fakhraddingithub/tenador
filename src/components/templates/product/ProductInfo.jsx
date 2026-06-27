"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import ProductHeader from "./ProductHeader";
import ProductPrice from "./ProductPrice";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "./WishlistButton";
import VariantSelector from "./VariantSelector";
import { useOrderFlowCart } from "@/components/modules/orderFlow/useOrderFlowCart";
import { valueImages, attrUnits, unitValue, valueAvailable } from "@/lib/variantImages";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function groupVariantOptions(variants = []) {
  const map = {};
  for (const variant of variants) {
    for (const [key, val] of Object.entries(variant.attributes || {})) {
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
  return Object.fromEntries(
    variantAttributes.map((a) => [a.name, a.label])
  );
}

// نمایش مقدار تخفیف یک پله (درصد یا مبلغ ثابت تومان)
function formatTierValue(tier) {
  if (!tier) return "";
  return tier.kind === "percent"
    ? `${tier.value}%`
    : `${Number(tier.value).toLocaleString("fa-IR")} تومان`;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const ProductInfo = ({ product, selectedVariant, onVariantChange, onSelectionChange }) => {
  const hasVariants =
    Array.isArray(product.variants) && product.variants.length > 0;

  const [selection, setSelection] = useState({});
  const [unitSelection, setUnitSelection] = useState({}); // واحدِ فعالِ هر ویژگیِ چندواحدی
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState(""); // استیت برای مدیریت خطای انتخاب ویژگی
  const addToCartWrapperRef = useRef(null); // رفرنس برای پیدا کردن مکان دکمه در صفحه

  // افزودن به سبد با پشتیبانی از فرایند سفارش
  const { requestAddToCart, flowModal } = useOrderFlowCart();

  const labelMap = useMemo(
    () => buildLabelMap(product.category?.variantAttributes),
    [product.category]
  );

  const variantOptions = useMemo(
    () => groupVariantOptions(product.variants),
    [product.variants]
  );

  const optionKeys = Object.keys(variantOptions);

  // چندواحدی: واحدِ فعال، برچسبِ مقدار در آن واحد، و تعویضِ واحد
  const getActiveUnit = (attrKey) =>
    unitSelection[attrKey] ?? attrUnits(product, attrKey)[0];
  const getValueLabel = (attrKey, val) =>
    unitValue(product, attrKey, val, getActiveUnit(attrKey));
  const onUnitChange = (attrKey, unit) =>
    setUnitSelection((prev) => ({ ...prev, [attrKey]: unit }));

  function handleSelect(attrKey, value) {
    const newSelection = { ...selection, [attrKey]: value };
    setSelection(newSelection);
    onSelectionChange?.(newSelection);
    setErrorMessage("");

    if (optionKeys.every((k) => newSelection[k])) {
      onVariantChange(findMatchingVariant(product.variants, newSelection));
    } else {
      onVariantChange(null);
    }
  }

  // ── قیمت پایه (یورو) ────────────────────────────────────────────────────────
  const basePrice = (selectedVariant && selectedVariant.price) || product.basePrice;

  // ── دریافت تخفیف واقعی از price API ─────────────────────────────────────────
  const [priceApiData, setPriceApiData] = useState(null);

  useEffect(() => {
    if (!product?._id) return;
    let cancelled = false;
    fetch(`/api/product/${product._id}/price`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && !data.error) setPriceApiData(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?._id]);

  // ── قیمت نهایی با توجه به واریانت و تخفیف ──────────────────────────────────
  const { basePriceToman, finalPriceToman, discountPercent, hasDiscount } = useMemo(() => {
    if (!priceApiData) {
      // قبل از load: قیمت پایه از سرور همین حالا تومان است؛ بدون تخفیف نمایش بده
      // (تخفیف/حراج پس از پاسخ price API روی همین مقدار اعمال می‌شود)
      const raw = Math.floor(basePrice / 1000) * 1000;
      return { basePriceToman: raw, finalPriceToman: raw, discountPercent: 0, hasDiscount: false };
    }

    if (selectedVariant) {
      const vData = priceApiData.variants?.find((v) => String(v._id) === String(selectedVariant._id));
      if (vData) {
        const hasD = vData.finalPriceToman < vData.basePriceToman;
        return { basePriceToman: vData.basePriceToman, finalPriceToman: vData.finalPriceToman, discountPercent: vData.discountPercent || 0, hasDiscount: hasD };
      }
      // واریانت در price API نبود: fallback به قیمت کلی محصول
    }

    const hasD = priceApiData.finalPriceToman < priceApiData.basePriceToman;
    return { basePriceToman: priceApiData.basePriceToman, finalPriceToman: priceApiData.finalPriceToman, discountPercent: priceApiData.discountPercent || 0, hasDiscount: hasD };
  }, [priceApiData, selectedVariant, basePrice]);

  const finalUnitPrice = hasDiscount ? finalPriceToman : basePriceToman;

  // ── تخفیف تعدادی (از سیستم مدیریت تخفیف‌ها — price API) ────────────────────
  const quantityDiscount = priceApiData?.quantityDiscount ?? null;
  const hasQuantityTiers = Boolean(quantityDiscount?.tiers?.length);

  // پله‌های نمایشی: پله «عادی» (۱ عدد، بدون تخفیف) + پله‌های تعریف‌شده ادمین
  const displayTiers = useMemo(() => {
    if (!hasQuantityTiers) return [];
    const labels = ["خوب", "عالی", "ویژه", "استثنایی"];
    return [
      { qty: 1, kind: "percent", value: 0, label: "عادی" },
      ...quantityDiscount.tiers.map((t, i) => ({
        qty: t.minQty,
        kind: t.kind,
        value: t.value,
        label: labels[Math.min(i, labels.length - 1)],
      })),
    ];
  }, [quantityDiscount, hasQuantityTiers]);

  // بهترین پله‌ای که تعداد فعلی به آن رسیده است (هم‌منطق با سرور)
  const activeQuantityTier = useMemo(() => {
    if (!hasQuantityTiers) return null;
    let best = null;
    for (const t of quantityDiscount.tiers) {
      if (quantity >= t.minQty && (!best || t.minQty > best.minQty)) best = t;
    }
    return best;
  }, [quantityDiscount, hasQuantityTiers, quantity]);

  // اولین پله‌ای که هنوز به آن نرسیده‌ایم (برای پیام تشویقی)
  const nextQuantityTier = useMemo(() => {
    if (!hasQuantityTiers) return null;
    return (
      [...quantityDiscount.tiers]
        .sort((a, b) => a.minQty - b.minQty)
        .find((t) => quantity < t.minQty) || null
    );
  }, [quantityDiscount, hasQuantityTiers, quantity]);

  // تخفیف تعدادی روی قیمت واحدِ پس از سایر تخفیف‌ها — دقیقاً مثل priceEngine سرور
  const qtyDiscountPerUnit = activeQuantityTier
    ? Math.max(
        0,
        Math.min(
          activeQuantityTier.kind === "percent"
            ? Math.floor((finalUnitPrice * activeQuantityTier.value) / 100)
            : Math.floor(activeQuantityTier.value),
          finalUnitPrice
        )
      )
    : 0;

  const effectiveUnitPrice = finalUnitPrice - qtyDiscountPerUnit;
  const originalTotalPrice = basePriceToman * quantity;
  const totalPrice         = effectiveUnitPrice * quantity;
  const totalSavings       = originalTotalPrice - totalPrice;
  const combinedDiscountPercent =
    basePriceToman > 0
      ? Math.round(((basePriceToman - effectiveUnitPrice) / basePriceToman) * 100)
      : 0;

  function handleQuantityChange(newQty) {
    if (newQty < 1) return;
    setQuantity(newQty);
  }

 // فانکشن ساخت انیمیشن پرواز عکس محصول به سبد خرید
 const triggerFlyToCartAnimation = () => {
  const cartIcon = document.getElementById("cart-nav-icon");
  const buttonElem = addToCartWrapperRef.current;
  
  // گرفتن آدرس عکس محصول (مطمئن شوید مسیر درست است)
  const productImgSrc = product.mainImage || product.image; 

  if (!cartIcon || !buttonElem || !productImgSrc) return;

  const btnRect = buttonElem.getBoundingClientRect();
  const cartRect = cartIcon.getBoundingClientRect();

  // ایجاد المان تصویر برای پرواز
  const flyer = document.createElement("img");
  flyer.src = productImgSrc;

  // استایل‌های تصویر متحرک
  Object.assign(flyer.style, {
    position: "fixed",
    top: `${btnRect.top}px`,
    left: `${btnRect.left + btnRect.width / 2 - 25}px`, // مرکز کردن نسبت به دکمه
    width: "60px",
    height: "60px",
    objectFit: "cover",
    borderRadius: "12px", // کمی گرد برای زیبایی
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    zIndex: "9999",
    pointerEvents: "none",
    transition: "all 0.9s cubic-bezier(0.42, 0, 0.58, 1)", // حرکت نرم شتاب‌دار
    opacity: "1",
  });

  document.body.appendChild(flyer);

  // شروع انیمیشن
  requestAnimationFrame(() => {
    flyer.style.top = `${cartRect.top}px`;
    flyer.style.left = `${cartRect.left}px`;
    flyer.style.width = "20px"; // کوچک شدن همزمان با رسیدن به سبد
    flyer.style.height = "20px";
    flyer.style.opacity = "0.2";
    flyer.style.transform = "rotate(360deg)"; // یک چرخش جذاب هنگام پرواز
  });

  // پاکسازی و افکت لرزش سبد خرید
  setTimeout(() => {
    if (document.body.contains(flyer)) {
      document.body.removeChild(flyer);
    }
    // افکت لرزش سبد خرید در هدر
    cartIcon.classList.add("cart-bounce");
    setTimeout(() => cartIcon.classList.remove("cart-bounce"), 300);
  }, 900);
};

  function handleAddToCart() {
    let variantId = null;

    if (hasVariants) {
      // پیدا کردن ویژگی‌هایی که هنوز انتخاب نشده‌اند
      const missingKeys = optionKeys.filter((k) => !selection[k]);

      if (missingKeys.length > 0) {
        // تبدیل کلید ویژگی به لیبل فارسی
        const missingLabels = missingKeys.map((k) => labelMap[k] || k).join(" و ");
        setErrorMessage(`لطفاً ${missingLabels} را انتخاب کنید.`);
        return false; // اعتبارسنجی ناموفق → دکمه نباید تایید نشان دهد
      }
      if (!selectedVariant) {
        setErrorMessage("این ترکیب در حال حاضر موجود نیست.");
        return false; // اعتبارسنجی ناموفق → دکمه نباید تایید نشان دهد
      }
      variantId = selectedVariant._id;
    }

    // اگر دسته‌بندی فرایند داشته باشد مودال باز می‌شود، وگرنه مستقیم افزوده می‌شود
    requestAddToCart({
      product,
      quantity,
      variantId,
      onAdded: () => {
        setErrorMessage(""); // پاک کردن خطا در صورت موفقیت
        triggerFlyToCartAnimation(); // اجرای انیمیشن پرواز
      },
    });

    return true; // اعتبارسنجی موفق → افزودن انجام شد
  }

  const handleWishlist = (isWishlisted) => {
    console.log(
      isWishlisted ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد"
    );
  };

  return (
    <div className="flex flex-col h-full justify-between gap-6 relative">
      {/* Brand logo */}
      {product.brand?.logo && (
        <Link
          href={`/brands/${product.brand.slug || product.brand._id}`}
          className="self-end absolute top-0 left-0"
        >
          <img
            src={product.brand.logo}
            alt={product.brand.title || product.brand.name}
            className="h-24 w-auto object-contain cursor-pointer"
          />
        </Link>
      )}

      {/* Name + short description */}
      <ProductHeader
        name={product.name}
        shortDescription={product.shortDescription}
      />

      {/* Price Section */}
      <div className="space-y-3">
        {hasDiscount ? (
          <div className="space-y-2">
            {/* قیمت اصلی خط‌خورده */}
            <div className="flex items-center gap-2">
              <span className="text-lg text-gray-400 line-through">
                {basePriceToman.toLocaleString("fa-IR")} تومان
              </span>
              {discountPercent > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  {discountPercent}٪ تخفیف
                </span>
              )}
            </div>
            {/* قیمت تخفیف‌خورده */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#aa4725]">
                {finalPriceToman.toLocaleString("fa-IR")}
              </span>
              <span className="text-lg text-gray-600">تومان</span>
            </div>
            {/* نمایش میزان صرفه‌جویی */}
            {totalSavings > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold text-green-700">
                  صرفه‌جویی {totalSavings.toLocaleString("fa-IR")} تومانی
                </span>
              </div>
            )}
          </div>
        ) : (
          <ProductPrice
            basePrice={basePriceToman}
            discountedPrice={null}
            hasDiscount={false}
          />
        )}
      </div>

      {/* ── Variant Selectors ── */}
      {hasVariants && (
        <VariantSelector
          optionKeys={optionKeys}
          variantOptions={variantOptions}
          labelMap={labelMap}
          selection={selection}
          onSelect={handleSelect}
          getValueImage={(attrKey, val) =>
            valueImages(product, attrKey, val)[0] || null
          }
          getValueLabel={getValueLabel}
          getUnits={(attrKey) => attrUnits(product, attrKey)}
          getActiveUnit={getActiveUnit}
          onUnitChange={onUnitChange}
          isValueDisabled={(attrKey, val) =>
            !valueAvailable(product.variants, optionKeys, selection, attrKey, val)
          }
        />
      )}

      {/* ── Quantity Selector with Discount Tiers ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">تعداد</p>
          {hasQuantityTiers && (
            <div className="flex items-center gap-1 text-xs">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-amber-600 font-medium">پیشنهاد ویژه فعال</span>
            </div>
          )}
        </div>
        
        {/* Quantity Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
              className="px-4 py-3 bg-gray-50 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="w-20 text-center font-bold text-lg text-gray-800 focus:outline-none"
              min="1"
            />
            
            <button
              type="button"
              onClick={() => handleQuantityChange(quantity + 1)}
              className="px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Discount Hint */}
          {hasQuantityTiers && (
            <div className="flex-1">
              {!activeQuantityTier && nextQuantityTier && (
                <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    با خرید <strong>{nextQuantityTier.minQty} عدد</strong>،{" "}
                    {formatTierValue(nextQuantityTier)} تخفیف بگیرید
                  </p>
                </div>
              )}
              {activeQuantityTier && nextQuantityTier && (
                <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-green-700 leading-relaxed">
                    <strong>{formatTierValue(activeQuantityTier)} تخفیف فعال!</strong>{" "}
                    با خرید {nextQuantityTier.minQty} عدد، {formatTierValue(nextQuantityTier)} تخفیف بگیرید
                  </p>
                </div>
              )}
              {activeQuantityTier && !nextQuantityTier && (
                <div className="flex items-start gap-2 p-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg">
                  <svg className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-xs text-orange-700 leading-relaxed font-medium">
                    🎉 تبریک! شما بیشترین تخفیف ({formatTierValue(activeQuantityTier)}) را دریافت می‌کنید
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discount Tiers Display */}
        {hasQuantityTiers && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${displayTiers.length}, minmax(0, 1fr))` }}
          >
            {displayTiers.map((tier, index) => {
              const next = displayTiers[index + 1] || null;
              const isActive = quantity >= tier.qty && (!next || quantity < next.qty);
              const isPassed = Boolean(next && quantity >= next.qty);

              return (
                <div
                  key={tier.qty}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all duration-300
                    ${isActive 
                      ? 'border-[#aa4725] bg-[#aa4725]/5 shadow-md scale-105' 
                      : isPassed
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#aa4725] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {isPassed && !isActive && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center">
                    <div className={`text-xs font-medium mb-1 ${isActive ? 'text-[#aa4725]' : isPassed ? 'text-green-600' : 'text-gray-500'}`}>
                      {tier.label}
                    </div>
                    <div className={`text-lg font-bold mb-0.5 ${isActive ? 'text-[#aa4725]' : isPassed ? 'text-green-600' : 'text-gray-600'}`}>
                      {tier.qty}+ عدد
                    </div>
                    <div className={`text-xs font-semibold ${isActive ? 'text-[#aa4725]' : isPassed ? 'text-green-600' : 'text-gray-500'}`}>
                      {tier.value > 0 ? `${formatTierValue(tier)} تخفیف` : 'بدون تخفیف'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Price Summary for Quantity Discounts */}
        {hasQuantityTiers && totalSavings > 0 && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">قیمت هر واحد:</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-xs">
                  {basePriceToman.toLocaleString("fa-IR")}
                </span>
                <span className="font-bold text-[#aa4725]">
                  {effectiveUnitPrice.toLocaleString("fa-IR")} تومان
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">تعداد:</span>
              <span className="font-bold text-gray-800">{quantity} عدد</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-300">
              <span className="text-gray-600">جمع اولیه:</span>
              <span className="font-semibold text-gray-500">
                {originalTotalPrice.toLocaleString("fa-IR")} تومان
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 font-medium">تخفیف شما ({combinedDiscountPercent}%):</span>
              <span className="font-bold text-green-600">
                - {totalSavings.toLocaleString("fa-IR")} تومان
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-base font-bold text-gray-800">
                قیمت نهایی:
              </span>
              <span className="text-2xl font-bold text-[#aa4725]">
                {totalPrice.toLocaleString("fa-IR")} تومان
              </span>
            </div>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="mt-4">
        {/* نمایش ارور بالا سر دکمه با انیمیشن Pulse در صورت وجود */}
        {errorMessage && (
          <div className="flex items-center gap-2 py-2.5 px-4 mb-3 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg animate-pulse w-fit">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* قرار دادن دکمه افزودن به سبد در یک Wrapper برای دریافت موقعیت مختصاتی */}
          <div className="flex-1" ref={addToCartWrapperRef}>
            {/* دکمه همیشه فعال است؛ اگر ویژگی‌ای انتخاب نشده باشد، هنگام کلیک
                پیامِ inline بالای دکمه نمایش داده می‌شود (handleAddToCart) */}
            <AddToCartButton onAddToCart={handleAddToCart} />
          </div>
          <WishlistButton onToggle={handleWishlist} />
        </div>
      </div>

      {/* مودال فرایند سفارش */}
      {flowModal}
    </div>
  );
};

export default ProductInfo;