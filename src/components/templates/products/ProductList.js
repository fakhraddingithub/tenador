"use client";

import { useState, useEffect, useMemo } from "react";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import { ProductCardSkeleton } from "@/components/templates/sports/ProductCardSkeleton";

// ۵ ردیف در گرید ۴‌ستونه = ۲۰ محصول در هر صفحه
const PAGE_SIZE = 20;

// تعداد محصولاتِ «اولویت‌دار» که فوراً (در همان رندرِ اول) به‌صورتِ کارتِ واقعی
// نمایش داده می‌شوند — ۲ ردیفِ کاملِ دسکتاپ. بقیه‌ی محصولاتِ همین صفحه ابتدا
// اسکلتون‌اند و بلافاصله پس از پِینتِ اول، خودکار (با requestAnimationFrame، نه
// با اسکرول) به کارتِ واقعی تبدیل می‌شوند تا رندرِ سنگین، اولین محتوا را بلاک نکند.
const PRIORITY_COUNT = 8;
const REVEAL_CHUNK = 4;

// `cardOverlay` is an optional React node (decoration) layered onto every card.
// It must be a node, not a function — a function can't cross the server→client
// boundary when a Server Component renders this Client Component.
// `campaignBadge` is a plain serializable object ({text,bgColor,textColor}) that
// each ProductCard renders in its badge stack with the exact discount-badge style.
export default function ProductList({ products = [], rate, onAddToCart, onToggleWishlist, cardOverlay = null, campaignBadge = null }) {
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

  // ── پخشِ تدریجیِ کلاینت‌ساید (progressive reveal) ──
  // تعداد کارت‌های واقعیِ نمایش‌داده‌شده از صفحه‌ی فعلی. در رندرِ اول فقط
  // PRIORITY_COUNT کارتِ واقعی + بقیه اسکلتون؛ سپس فریم‌به‌فریم بقیه آشکار می‌شوند.
  const [revealed, setRevealed] = useState(PRIORITY_COUNT);

  // با هر تغییرِ صفحه/فیلتر (visibleProducts عوض می‌شود) دوباره از همان الگوی
  // «۸ تای اول فوری، بقیه استریم» شروع می‌کنیم.
  useEffect(() => {
    // ریستِ شمارنده هنگامِ تعویضِ صفحه/فیلتر — همگام‌سازی با ورودیِ بیرونی
    // (همان قراردادِ این کدبیس برای این قاعده‌ی لینت).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(PRIORITY_COUNT);
    if (visibleProducts.length <= PRIORITY_COUNT) return;

    let raf;
    let current = PRIORITY_COUNT;
    const step = () => {
      current = Math.min(current + REVEAL_CHUNK, visibleProducts.length);
      setRevealed(current);
      if (current < visibleProducts.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visibleProducts]);

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
        {visibleProducts.map((product, i) =>
          i < revealed ? (
            <ProductCard
              key={product._id}
              product={product}
              rate={rate}
              isWishlisted={product.isWishlisted}
              overlay={cardOverlay}
              campaignBadge={campaignBadge}
              onQuickView={() => { setSelectedProduct(product); setIsModalOpen(true); }}
              onAddToCart={() => onAddToCart?.(product)}
              onToggleWishlist={() => onToggleWishlist?.(product)}
            />
          ) : (
            // کلید = همان product._id تا وقتی اسکلتون به کارتِ واقعی تبدیل می‌شود،
            // در همان جایگاه جابه‌جا شود (بدونِ پرشِ چیدمان؛ ابعاد یکسان است).
            <ProductCardSkeleton key={product._id} />
          )
        )}
      </div>

      {/* پیجینیشن — فقط وقتی بیش از یک صفحه داریم */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-10 select-none" dir="ltr">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 rounded-[6px] border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                }`}
              >
                {n.toLocaleString("fa-IR")}
              </button>
            )
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-[6px] border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
