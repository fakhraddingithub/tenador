"use client";

import { useState, useMemo } from "react";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";

/**
 * Owns the selectedVariant state so Gallery and Info stay in sync.
 * Rendered by ProductTemplate (server component).
 */
const ProductClientSection = ({ product }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

  const galleryImages = useMemo(() => {
    // 1. بررسی اینکه آیا حداقل یکی از واریانت‌ها عکس دارد یا خیر
    const anyVariantHasImages = (product.variants || []).some(
      v => Array.isArray(v.images) && v.images.length > 0
    );

    // 2. اگر هیچ واریانتی عکس نداشت، mainImage اضافه می‌شود؛ در غیر این صورت حذف می‌شود
    const base = [
      ...(!anyVariantHasImages ? [product.mainImage] : []),
      ...(product.gallery || []),
    ].filter(Boolean);

    // استخراج تمام عکس‌های واریانت‌ها برای استفاده در ادامه
    const allVariantImages = (product.variants || [])
      .flatMap(v => v.images || [])
      .filter(Boolean)
      .filter(img => !base.includes(img)); // جلوگیری از عکس‌های تکراری

    if (
      selectedVariant &&
      Array.isArray(selectedVariant.images) &&
      selectedVariant.images.length > 0
    ) {
      // اگر واریانتی انتخاب شده بود و عکس داشت: عکس‌های آن اول، سپس تصاویر پایه، سپس بقیه
      const selectedImgs = selectedVariant.images.filter(Boolean);
      const otherVariantImgs = allVariantImages.filter(
        img => !selectedImgs.includes(img)
      );
      return [...selectedImgs, ...base, ...otherVariantImgs];
    }

    return [...base, ...allVariantImages];
  }, [product.mainImage, product.gallery, product.variants, selectedVariant]);

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12 xl:gap-16">
      {/* Left - Gallery */}
      <div className="order-2 lg:order-1">
        <div className="mx-auto max-w-md lg:max-w-none">
          <ProductGallery images={galleryImages} logo={product?.brand?.icon} />
        </div>
      </div>

      {/* Right - Info */}
      <div className="order-1 lg:order-2">
        <div className="order-1 lg:order-2">
          <ProductInfo
            product={product}
            selectedVariant={selectedVariant}
            onVariantChange={setSelectedVariant}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductClientSection;