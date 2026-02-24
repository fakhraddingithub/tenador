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

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const ProductInfo = ({ product, selectedVariant, onVariantChange }) => {
  const hasVariants =
    Array.isArray(product.variants) && product.variants.length > 0;

  const [selection, setSelection] = useState({});

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

  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const variantStock = selectedVariant?.stock ?? null;
  const isOutOfStock =
    hasVariants ? selectedVariant !== null && variantStock === 0 : false;

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
      addToCart(product, 1, selectedVariant);
    } else {
      addToCart(product, 1, null);
    }
    toast.success("به سبد خرید اضافه شد");
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
        <Link href={`/brands/${product.brand.slug || product.brand._id}`} className="self-end absolute top-0 left-0">
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

      {/* Price */}
      <ProductPrice
        basePrice={displayPrice}
        discountedPrice={null}
        hasDiscount={false}
      />

      {/* ── Variant Selectors ── */}
      {hasVariants && (
        <div className="space-y-5">
          {optionKeys.map((attrKey) => {
            const values = variantOptions[attrKey];
            // Label comes from category.variantAttributes — no hardcoding
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
                        onClick={() => handleSelect(attrKey, val)}
                        title={!hasStock ? "ناموجود" : val}
                        className={`
                          relative px-4 py-2 rounded-lg border-2 text-sm font-medium
                          transition-all duration-200 select-none
                          ${
                            isSelected
                              ? "border-[#aa4725] bg-[#aa4725]/5 text-[#aa4725] shadow-sm"
                              : hasStock
                              ? "border-gray-200 text-gray-700 hover:border-[#aa4725]/50"
                              : "border-gray-100 text-gray-300 cursor-not-allowed line-through bg-gray-50"
                          }
                        `}
                      >
                        {val}
                        {!hasStock && (
                          <span
                            className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                            aria-hidden
                          >
                            <span className="absolute inset-0 bg-gradient-to-br from-transparent via-gray-300/40 to-transparent" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Stock feedback */}
          {selectedVariant && (
            <p
              className={`text-xs font-medium ${
                isOutOfStock ? "text-red-500" : "text-green-600"
              }`}
            >
              {isOutOfStock
                ? "این واریانت موجود نیست"
                : `موجودی: ${variantStock} عدد`}
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center gap-3 mt-2">
        <AddToCartButton onAddToCart={handleAddToCart} disabled={isOutOfStock} />
        <WishlistButton onToggle={handleWishlist} />
      </div>
    </div>
  );
};

export default ProductInfo;