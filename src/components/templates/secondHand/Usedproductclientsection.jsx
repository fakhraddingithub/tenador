"use client";

import { useMemo } from "react";
import ProductGallery from "@/components/templates/product/ProductGallery";
import UsedProductInfo from "./UsedProductInfo";

const UsedProductClientSection = ({ product }) => {
  // تصاویر: ابتدا images محصول دست‌دوم، سپس mainImage و gallery از baseProduct
  const galleryImages = useMemo(() => {
    const ownImages = (product.images || []).filter(Boolean);
    const base      = [
      product.baseProduct.mainImage,
      ...(product.baseProduct.gallery || []),
    ].filter(Boolean);

    // تصاویر base که در own نیستن اضافه می‌شن
    const extra = base.filter((img) => !ownImages.includes(img));
    return [...ownImages, ...extra];
  }, [product.images, product.baseProduct]);

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12 xl:gap-16">
      {/* Gallery */}
      <div className="order-2 lg:order-1">
        <div className="mx-auto max-w-md lg:max-w-none">
          <ProductGallery images={galleryImages} />
        </div>
      </div>

      {/* Info */}
      <div className="order-1 lg:order-2">
        <UsedProductInfo product={product} />
      </div>
    </div>
  );
};

export default UsedProductClientSection;