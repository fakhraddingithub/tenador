"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ProductCard from "@/components/modules/cart/ProductCard";
import UsedProductCard from "@/components/templates/secondHands/UsedProductCard";

const QuickViewModal = dynamic(() => import("@/components/modules/cart/QuickViewModal"), { ssr: false });
const UsedQuickViewModal = dynamic(() => import("@/components/templates/secondHands/Usedquickviewmodal"), { ssr: false });

/**
 * ستون‌ها: بیرونِ بلوکِ ادغام‌شده همان نقطه‌شکن‌های صفحه (اندازه‌ی کارت در صفحه
 * عوض نمی‌شود)، و داخلِ آن *بر اساسِ عرضِ خانه*. media query عرضِ پنجره را
 * می‌سنجد، پس داخلِ ستونی ۳۰۰ پیکسلی هم «دسکتاپ» بود و چهار ستون می‌ساخت —
 * ریشه‌ی باگِ «کارتِ محصولِ باریک».
 *
 * رشته‌ها عمداً ثابت‌اند: تیلویند فقط کلاسِ عینی را می‌سازد.
 */
const GRID_PAGE = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const GRID_FILL_ONE = "grid-cols-1";
const GRID_FILL_MANY = "grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))]";
export const slotColumns = (fill, count) => (!fill ? GRID_PAGE : count === 1 ? GRID_FILL_ONE : GRID_FILL_MANY);

export function PublicProductGrid({ products = [], rate = 1, fill = false }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  if (!products.length) return null;
  return (
    <>
      <div className={`grid gap-3 ${slotColumns(fill, products.length)}`}>
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

export function PublicUsedProductGrid({ products = [], fill = false }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  if (!products.length) return null;
  return (
    <>
      <div className={`grid gap-3 ${fill ? slotColumns(fill, products.length) : "grid-cols-2 md:grid-cols-3"}`}>
        {products.map((product) => (
          <UsedProductCard key={product._id} product={product} onQuickView={() => setSelectedProduct(product)} />
        ))}
      </div>
      <UsedQuickViewModal product={selectedProduct} isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} />
    </>
  );
}
