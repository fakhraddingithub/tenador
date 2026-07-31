"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import { ProductCardSkeleton } from "@/components/templates/sports/ProductCardSkeleton";
import useWishlist from "@/hooks/useWishlist";

function RemoveButton({ product }) {
  const { toggle, isLoading } = useWishlist(product);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      disabled={isLoading}
      aria-label={`حذف ${product.name} از علاقه‌مندی‌ها`}
      title="حذف از علاقه‌مندی‌ها"
      className="absolute left-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm backdrop-blur transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-60"
    >
      <X size={18} />
    </button>
  );
}

export default function WishlistModule() {
  const { items, isLoading, error, refresh } = useWishlist();
  const [selectedProduct, setSelectedProduct] = useState(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 lg:px-0">
        {[0, 1, 2, 3, 4, 5].map((item) => <ProductCardSkeleton key={item} />)}
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 px-3 lg:px-0"
      dir="rtl"
    >
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
          <Heart size={20} className="text-[var(--color-primary)]" fill="currentColor" />
          علاقه‌مندی‌های من
        </h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          محصولاتی که برای مشاهده دوباره ذخیره کرده‌اید
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-rose-100 bg-white p-8 text-center">
          <p className="text-sm text-rose-600">بارگذاری علاقه‌مندی‌ها انجام نشد.</p>
          <button type="button" onClick={() => refresh()} className="mt-3 text-sm font-bold text-[var(--color-primary)]">
            تلاش دوباره
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-slate-200 bg-white px-4 py-12 text-center sm:py-16">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
            <Heart size={30} />
          </span>
          <h2 className="mt-4 font-bold text-slate-700">هنوز محصولی ذخیره نکرده‌اید</h2>
          <p className="mt-1 text-sm text-slate-400">با زدن آیکون قلب، محصول به این صفحه اضافه می‌شود.</p>
          <Link href="/products" className="mt-5 inline-flex rounded-[6px] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
            مشاهده محصولات
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onQuickView={() => setSelectedProduct(product)}
              overlay={<RemoveButton product={product} />}
            />
          ))}
        </div>
      )}

      <QuickViewModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
      />
    </motion.section>
  );
}
