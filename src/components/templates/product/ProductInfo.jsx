"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ProductHeader from "./ProductHeader";
import ProductPrice from "./ProductPrice";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "./WishlistButton";
import { addToCart } from "@/lib/cart";
import { toast } from "react-toastify";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

/** { color: ["سفید","مشکی"], size: ["S","M"] } from variants array */
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

/** Exact-match variant on every selected attribute key */
function findMatchingVariant(variants = [], selection = {}) {
  if (!Object.keys(selection).length) return null;
  return (
    variants.find((v) => {
      const attrs = v.attributes || {};
      return Object.entries(selection).every(([k, val]) => attrs[k] === val);
    }) || null
  );
}

/**
 * Build a label map from category.variantAttributes:
 * [{ name: "color", label: "رنگ" }, ...]  →  { color: "رنگ", ... }
 */
function buildLabelMap(variantAttributes = []) {
  return Object.fromEntries(
    variantAttributes.map((a) => [a.name, a.label])
  );
}

/**
 * Calculate discount based on quantity
 */
function calculateDiscount(quantity) {
  if (quantity >= 3) return 15;
  if (quantity >= 2) return 10;
  return 0;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const ProductInfo = ({ product, selectedVariant, onVariantChange }) => {
  const hasVariants =
    Array.isArray(product.variants) && product.variants.length > 0;

  const [selection, setSelection] = useState({});
  const [quantity, setQuantity] = useState(1);

  // Check if product has discount label - بررسی دقیق‌تر
  const hasDiscountLabel = product.label === "discount";

  // Label map derived from category definition — single source of truth
  const labelMap = useMemo(
    () => buildLabelMap(product.category?.variantAttributes),
    [product.category]
  );

  const variantOptions = useMemo(
    () => groupVariantOptions(product.variants),
    [product.variants]
  );

  const optionKeys = Object.keys(variantOptions);

  function handleSelect(attrKey, value) {
    const newSelection = { ...selection, [attrKey]: value };
    setSelection(newSelection);

    if (optionKeys.every((k) => newSelection[k])) {
      onVariantChange(findMatchingVariant(product.variants, newSelection));
    } else {
      onVariantChange(null);
    }
  }

  const basePrice = selectedVariant?.price ?? product.basePrice;

  // Calculate discounted price if discount label exists
  const discountPercent = hasDiscountLabel ? calculateDiscount(quantity) : 0;
  const finalUnitPrice = Math.round(basePrice * (1 - discountPercent / 100));
  const totalPrice = finalUnitPrice * quantity;
  const originalTotalPrice = basePrice * quantity;
  const totalSavings = originalTotalPrice - totalPrice;

  function handleQuantityChange(newQty) {
    if (newQty < 1) return;
    setQuantity(newQty);
  }

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
      addToCart(product, quantity, selectedVariant, finalUnitPrice);
    } else {
      addToCart(product, quantity, null, finalUnitPrice);
    }
    
    if (hasDiscountLabel && discountPercent > 0) {
      toast.success(
        <div>
          <div className="font-bold">{quantity} عدد به سبد خرید اضافه شد</div>
          <div className="text-sm text-green-600 mt-1">
            🎉 شما {totalSavings.toLocaleString("fa-IR")} تومان صرفه‌جویی کردید!
          </div>
        </div>
      );
    } else {
      toast.success(`${quantity} عدد به سبد خرید اضافه شد`);
    }
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
        {/* Main Price Display */}
        {hasDiscountLabel && discountPercent > 0 ? (
          <div className="space-y-2">
            {/* Original Price - Crossed out */}
            <div className="flex items-center gap-2">
              <span className="text-lg text-gray-400 line-through">
                {basePrice.toLocaleString("fa-IR")} تومان
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {discountPercent}٪ تخفیف
              </span>
            </div>
            
            {/* Discounted Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#aa4725]">
                {finalUnitPrice.toLocaleString("fa-IR")}
              </span>
              <span className="text-lg text-gray-600">تومان</span>
            </div>

            {/* Savings Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-semibold text-green-700">
                صرفه‌جویی {totalSavings.toLocaleString("fa-IR")} تومانی
              </span>
            </div>
          </div>
        ) : (
          <ProductPrice
            basePrice={basePrice}
            discountedPrice={null}
            hasDiscount={false}
          />
        )}
      </div>

      {/* ── Variant Selectors ── */}
      {hasVariants && (
        <div className="space-y-5">
          {optionKeys.map((attrKey) => {
            const values = variantOptions[attrKey];
            const label = labelMap[attrKey] || attrKey;

            return (
              <div key={attrKey}>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {label}
                  {selection[attrKey] && (
                    <span className="mr-2 font-normal text-gray-400">
                      {selection[attrKey]}
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap gap-2">
                  {values.map((val) => {
                    const isSelected = selection[attrKey] === val;

                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSelect(attrKey, val)}
                        title={val}
                        className={`
                          relative px-4 py-2 rounded-lg border-2 text-sm font-medium
                          transition-all duration-200 select-none
                          ${
                            isSelected
                              ? "border-[#aa4725] bg-[#aa4725]/5 text-[#aa4725] shadow-sm"
                              : "border-gray-200 text-gray-700 hover:border-[#aa4725]/50"
                          }
                        `}
                      >
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

      {/* ── Quantity Selector with Discount Tiers ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">تعداد</p>
          {hasDiscountLabel && (
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
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
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
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>

          {/* Discount Hint */}
          {hasDiscountLabel && (
            <div className="flex-1">
              {quantity === 1 && (
                <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    با خرید <strong>2 عدد</strong>، 10% تخفیف بگیرید
                  </p>
                </div>
              )}
              {quantity === 2 && (
                <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-green-700 leading-relaxed">
                    <strong>10% تخفیف فعال!</strong> با یک عدد بیشتر، 15% تخفیف بگیرید
                  </p>
                </div>
              )}
              {quantity >= 3 && (
                <div className="flex items-start gap-2 p-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg">
                  <svg className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-xs text-orange-700 leading-relaxed font-medium">
                    🎉 تبریک! شما بیشترین تخفیف (15%) را دریافت می‌کنید
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discount Tiers Display - فقط برای محصولات با label discount */}
        {hasDiscountLabel && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { qty: 1, discount: 0, label: "عادی" },
              { qty: 2, discount: 10, label: "خوب" },
              { qty: 3, discount: 15, label: "عالی" }
            ].map((tier) => {
              const isActive = quantity >= tier.qty && (tier.qty === 3 ? true : quantity < (tier.qty + 1));
              const isPassed = quantity > tier.qty;
              
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
                      {tier.discount > 0 ? `${tier.discount}% تخفیف` : 'بدون تخفیف'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Price Summary for Discount Products */}
        {hasDiscountLabel && discountPercent > 0 && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">قیمت هر واحد:</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-xs">
                  {basePrice.toLocaleString("fa-IR")}
                </span>
                <span className="font-bold text-[#aa4725]">
                  {finalUnitPrice.toLocaleString("fa-IR")} تومان
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
              <span className="text-green-600 font-medium">تخفیف شما ({discountPercent}%):</span>
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

      {/* CTA */}
      <div className="flex items-center gap-3 mt-2">
        <AddToCartButton onAddToCart={handleAddToCart} />
        <WishlistButton onToggle={handleWishlist} />
      </div>
    </div>
  );
};

export default ProductInfo;