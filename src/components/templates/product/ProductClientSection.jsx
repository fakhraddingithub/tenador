"use client";

import { useState, useMemo } from "react";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";
import { buildGalleryImages } from "@/lib/variantImages";

/**
 * Owns selectedVariant + (partial) selection so Gallery and Info stay in sync.
 * گالری با هر تغییرِ انتخاب (حتی ناقص، مثلاً فقط رنگ) تصاویرِ همان مقدار را نشان می‌دهد.
 * یکتاسازی و حلِ تصاویرِ سطحِ مقدار در buildGalleryImages انجام می‌شود.
 * Rendered by ProductTemplate (server component).
 */
const ProductClientSection = ({ product }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selection, setSelection] = useState({});

  const galleryImages = useMemo(
    () => buildGalleryImages(product, selection),
    [product, selection]
  );

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12 xl:gap-16">
      {/* Top on Mobile / Left on Desktop - Gallery */}
      <div className="w-full">
        <div className="mx-auto max-w-md lg:max-w-none">
          <ProductGallery
            images={galleryImages}
            logo={product?.brand?.icon}
            productName={product?.name}
          />
        </div>
      </div>

      {/* Bottom on Mobile / Right on Desktop - Info */}
      <div className="w-full">
        <ProductInfo
          product={product}
          selectedVariant={selectedVariant}
          onVariantChange={setSelectedVariant}
          onSelectionChange={setSelection}
        />
      </div>
    </div>
  );
};

export default ProductClientSection;