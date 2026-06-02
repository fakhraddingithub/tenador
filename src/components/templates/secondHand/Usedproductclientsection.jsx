"use client";

import { useMemo } from "react";
import ProductGallery from "@/components/templates/product/ProductGallery";
import UsedProductInfo from "./UsedProductInfo";

const UsedProductClientSection = ({ product }) => {
  const galleryImages = useMemo(() => {
    const ownImages = (product?.images || []).filter(Boolean);

    return ownImages;
  }, [product?.images]);
  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12 xl:gap-16">
      {/* Gallery */}
      <div className="order-2 lg:order-1">
        <div className="mx-auto max-w-md lg:max-w-none">
          <ProductGallery
            images={galleryImages}
            logo={product?.baseProduct?.brand?.icon || null}
          />
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