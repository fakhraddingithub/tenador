"use client";

import { useState, useEffect, useMemo } from "react";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";

// ۵ ردیف در گرید ۴‌ستونه = ۲۰ محصول در هر صفحه
const PAGE_SIZE = 20;

export default function ProductList({ products = [], rate, onAddToCart, onToggleWishlist }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const total = Array.isArray(products) ? products.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // با تغییر فیلتر/سرچ (آرایه‌ی products عوض می‌شود) به صفحه‌ی اول برگرد
  useEffect(() => {
    setPage(1);
  }, [products]);

  // اگر تعداد صفحات کم شد و page بیرون از بازه افتاد، اصلاح کن
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return (products || []).slice(start, start + PAGE_SIZE);
  }, [products, page]);

  if (!Array.isArray(products) || products.length === 0) {
    return <div className="py-10 text-center text-gray-500">محصولی برای نمایش وجود ندارد</div>;
  }

  const goTo = (p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // شماره‌ی صفحات قابل‌نمایش (با ... برای مجموعه‌های بزرگ)
  const pageNumbers = useMemo(() => {
    const out = [];
    const add = (n) => out.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) add(i);
    } else {
      add(1);
      if (page > 3) add("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
      if (page < totalPages - 2) add("…");
      add(totalPages);
    }
    return out;
  }, [page, totalPages]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleProducts.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            rate={rate}
            isWishlisted={product.isWishlisted}
            onQuickView={() => { setSelectedProduct(product); setIsModalOpen(true); }}
            onAddToCart={() => onAddToCart?.(product)}
            onToggleWishlist={() => onToggleWishlist?.(product)}
          />
        ))}
      </div>

      {/* پیجینیشن — فقط وقتی بیش از یک صفحه داریم */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-10 select-none" dir="ltr">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 rounded-[6px] border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-[#aa4725] hover:text-[#aa4725] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            قبلی
          </button>

          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
            ) : (
              <button
                key={n}
                onClick={() => goTo(n)}
                className={`min-w-[40px] px-3 py-2 rounded-[6px] border text-sm font-bold transition-colors ${
                  n === page
                    ? "border-[#aa4725] bg-[#aa4725] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#aa4725] hover:text-[#aa4725]"
                }`}
              >
                {n.toLocaleString("fa-IR")}
              </button>
            )
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-[6px] border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-[#aa4725] hover:text-[#aa4725] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            بعدی
          </button>
        </nav>
      )}

      {/* rate به مودال پاس داده می‌شود */}
      <QuickViewModal
        product={selectedProduct}
        rate={rate}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
      />
    </>
  );
}
