"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ProductCard from "@/components/modules/cart/ProductCard";
import UsedProductCard from "@/components/templates/secondHands/UsedProductCard";

const QuickViewModal = dynamic(() => import("@/components/modules/cart/QuickViewModal"), { ssr: false });
const UsedQuickViewModal = dynamic(() => import("@/components/templates/secondHands/Usedquickviewmodal"), { ssr: false });

export function PublicProductGrid({ products = [], rate = 1 }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  if (!products.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            rate={rate}
            onQuickView={() => setSelectedProduct(product)}
            onToggleWishlist={() => {}}
          />
        ))}
      </div>
      <QuickViewModal product={selectedProduct} rate={rate} isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} />
    </>
  );
}

export function PublicUsedProductGrid({ products = [] }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  if (!products.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {products.map((product) => (
          <UsedProductCard key={product._id} product={product} onQuickView={() => setSelectedProduct(product)} />
        ))}
      </div>
      <UsedQuickViewModal product={selectedProduct} isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} />
    </>
  );
}
