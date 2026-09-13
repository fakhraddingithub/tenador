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
    <div className="grid min-w-0 grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-12 xl:gap-16">
      {/* Top on Mobile / Left on Desktop - Gallery */}
      <div className="min-w-0 w-full">
        <div className="mx-auto min-w-0 w-full max-w-md lg:max-w-none">
          <ProductGallery
            images={galleryImages}
            logo={product?.baseProduct?.brand?.icon || null}
            verified={!!product?.tested}
            productName={product?.name}
          />
        </div>
      </div>

      {/* Bottom on Mobile / Right on Desktop - Info */}
      <div className="min-w-0 w-full">
        <UsedProductInfo product={product} />
      </div>
    </div>
  );
};

export default UsedProductClientSection;
