"use client";

/**
 * src/components/templates/sports/SerieGroupedView.jsx
 *
 * نمای صفحه‌ی سری ریشه (level 0): محصولات بر اساس زیرسری‌های مستقیم (level 1)
 * گروه‌بندی می‌شوند. هر بخش روی عنوان زیرسری کلیک‌پذیر است و به صفحه‌ی آن
 * زیرسری هدایت می‌کند. بخش‌ها به‌صورت تدریجی (infinite scroll) بارگذاری می‌شوند.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import SearchBar from "@/components/templates/products/SearchBar";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import { FiShoppingBag, FiLayers, FiLoader, FiFilter, FiRotateCcw } from "react-icons/fi";

const BATCH_SECTIONS = 2;

export default function SerieGroupedView({
  pageInfo = {},
  filters = {},
  rate,
  serieId,
  sportId = null,
  categoryId = null,
  brandSlug = "",
  initialData = {},
  title = "",
}) {
  const serieTitle = pageInfo?.title || pageInfo?.name || "";
  const sportSlug = filters?.sport?.slug || "";

  // ─── State ───
  const [sections, setSections] = useState(initialData.sections || []);
  const [index, setIndex] = useState(initialData.index || []);
  const [nextOffset, setNextOffset] = useState(initialData.nextOffset ?? 0);
  const [hasMore, setHasMore] = useState(Boolean(initialData.hasMore));
  const [totalCount, setTotalCount] = useState(initialData.totalCount ?? 0);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ─── Refs ───
  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);
  const sectionsRef = useRef(sections);
  const hasMoreRef = useRef(hasMore);
  const nextOffsetRef = useRef(nextOffset);
  const loadedKeysRef = useRef(new Set((initialData.sections || []).map((s) => s.key)));
  const filterRef = useRef({ search: "", minPrice: 0, maxPrice: 0 });
  const sentinelRef = useRef(null);
  const mountedRef = useRef(false);

  const syncRefs = (next) => {
    if (next.sections !== undefined) sectionsRef.current = next.sections;
    if (next.hasMore !== undefined) hasMoreRef.current = next.hasMore;
    if (next.nextOffset !== undefined) nextOffsetRef.current = next.nextOffset;
  };

  const buildUrl = useCallback(
    (offset, { withIndex = false } = {}) => {
      const f = filterRef.current;
      const params = new URLSearchParams();
      params.set("serieId", serieId);
      if (sportId) params.set("sportId", sportId);
      if (categoryId) params.set("categoryId", categoryId);
      params.set("offset", String(offset));
      params.set("limit", String(BATCH_SECTIONS));
      if (f.minPrice > 0) params.set("minPrice", String(f.minPrice));
      if (f.maxPrice > 0) params.set("maxPrice", String(f.maxPrice));
      if (f.search) params.set("search", f.search);
      if (withIndex) params.set("withIndex", "1");
      return `/api/series/grouped?${params.toString()}`;
    },
    [serieId, sportId, categoryId]
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const reqId = ++reqIdRef.current;
    try {
      const res = await fetch(buildUrl(nextOffsetRef.current));
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (reqId !== reqIdRef.current) return;

      const incoming = (data.sections || []).filter(
        (s) => !loadedKeysRef.current.has(s.key)
      );
      incoming.forEach((s) => loadedKeysRef.current.add(s.key));

      const merged = [...sectionsRef.current, ...incoming];
      syncRefs({ sections: merged, hasMore: Boolean(data.hasMore), nextOffset: data.nextOffset ?? nextOffsetRef.current });
      setSections(merged);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(data.nextOffset ?? nextOffsetRef.current);
    } catch (e) {
      if (reqId === reqIdRef.current) console.error("loadMore error", e);
    } finally {
      if (reqId === reqIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [buildUrl]);

  const applyFilters = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    loadingRef.current = true;
    setLoading(true);
    loadedKeysRef.current = new Set();

    try {
      const res = await fetch(buildUrl(0, { withIndex: true }));
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      if (reqId !== reqIdRef.current) return;

      const incoming = data.sections || [];
      incoming.forEach((s) => loadedKeysRef.current.add(s.key));

      syncRefs({ sections: incoming, hasMore: Boolean(data.hasMore), nextOffset: data.nextOffset ?? 0 });
      setSections(incoming);
      setIndex(data.index || []);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(data.nextOffset ?? 0);
      setTotalCount(data.totalCount ?? 0);
    } catch (e) {
      if (reqId === reqIdRef.current) console.error("applyFilters error", e);
    } finally {
      if (reqId === reqIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [buildUrl]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      filterRef.current = {
        search: searchTerm.trim(),
        minPrice: Number(minPrice) || 0,
        maxPrice: Number(maxPrice) || 0,
      };
      applyFilters();
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, minPrice, maxPrice, applyFilters]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, sections.length]);

  const jumpTo = useCallback(
    async (key) => {
      let guard = 0;
      while (
        !sectionsRef.current.some((s) => s.key === key) &&
        hasMoreRef.current &&
        guard < 50
      ) {
        await loadMore();
        guard++;
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`serie-section-${key}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [loadMore]
  );

  const resetFilters = () => {
    setSearchTerm("");
    setMinPrice("");
    setMaxPrice("");
  };

  // تعداد فیلترهای فعالِ سایدبار — فقط برای بجِ دکمه‌ی موبایلِ MobileFilterDrawer.
  const activeCount =
    (Number(minPrice) > 0 ? 1 : 0) + (Number(maxPrice) > 0 ? 1 : 0);

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const isEmpty = !loading && sections.length === 0;

  return (
    <div className="bg-[#fcfcfc] min-h-screen" dir="rtl">
      {/* ───────────────── Hero ───────────────── */}
      <div className="relative h-[100px] md:h-[220px] w-full overflow-hidden">
        <img
          src={pageInfo.headImage || pageInfo.image || "/images/default-sport.jpg"}
          alt={serieTitle}
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-4 drop-shadow-xl">
            {serieTitle}
          </h1>
          <div className="w-20 h-1 bg-[var(--color-primary)] rounded-full mb-4" />
        </div>
      </div>

      {/* ───────────────── Main ───────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-1/4">
          <MobileFilterDrawer activeCount={activeCount} onReset={resetFilters}>
          <div className="sticky top-24 flex flex-col gap-5">
            <div className="flex items-center justify-between bg-white p-4 rounded-[6px] border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-[#1a1a1a]">
                <FiFilter className="text-[var(--color-primary)]" size={14} />
                <span>فیلترها</span>
              </div>
              <button
                onClick={resetFilters}
                className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <FiRotateCcw size={11} /> حذف فیلترها
              </button>
            </div>

            {/* نویگیشن زیرسری‌ها */}
            {index.length > 0 && (
              <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm p-5">
                <h4 className="text-sm font-bold text-[#1a1a1a] mb-4 flex items-center gap-2">
                  <FiLayers className="text-[var(--color-primary)]" size={14} />
                  زیرسری‌ها
                </h4>
                <div className="flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar">
                  {index.map((entry) =>
                    entry.slug && sportSlug && brandSlug ? (
                      <Link
                        key={entry.key}
                        href={`/${sportSlug}/${brandSlug}/${entry.slug}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] text-right hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-xs font-bold text-gray-600 group-hover:text-[var(--color-primary)] truncate">
                          {entry.title}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
                          {entry.productCount.toLocaleString("fa-IR")}
                        </span>
                      </Link>
                    ) : (
                      <button
                        key={entry.key}
                        onClick={() => jumpTo(entry.key)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] text-right hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-xs font-bold text-gray-600 group-hover:text-[var(--color-primary)] truncate">
                          {entry.title}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
                          {entry.productCount.toLocaleString("fa-IR")}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* فیلتر قیمت */}
            <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm p-5">
              <h4 className="text-sm font-bold text-[#1a1a1a] mb-4">محدوده قیمت (تومان)</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="از"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[var(--color-primary)] outline-none font-bold"
                />
                <input
                  type="number"
                  placeholder="تا"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-1/2 h-10 bg-gray-50 border border-gray-100 rounded-[6px] text-xs px-2 focus:border-[var(--color-primary)] outline-none font-bold"
                />
              </div>
            </div>
          </div>
          </MobileFilterDrawer>
        </aside>

        {/* Sections */}
        <main className="w-full lg:w-3/4">
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-5 rounded-[var(--radius)] border border-gray-100 shadow-sm">
            <div className="w-full md:w-2/3">
              <SearchBar value={searchTerm} onChange={setSearchTerm} />
            </div>
            <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
              <FiShoppingBag className="text-[var(--color-primary)]" />
              <span className="font-bold">تعداد کالا:</span>
              <span className="text-[var(--color-text)] font-bold">
                {totalCount.toLocaleString("fa-IR")}
              </span>
            </div>
          </div>

          {isEmpty ? (
            <div className="text-center py-24 bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-100">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShoppingBag size={40} className="text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold text-xl">
                هیچ کالایی با این فیلترها مطابقت ندارد!
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 text-[var(--color-primary)] font-bold underline"
              >
                پاک کردن تمام فیلترها
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {sections.map((section) => (
                <section
                  key={section.key}
                  id={`serie-section-${section.key}`}
                  className="scroll-mt-24"
                >
                  {/* هدر بخش — عنوان زیرسری با لینک به صفحه‌ی آن */}
                  <div className="relative mb-7 flex items-center justify-center rounded-[var(--radius)] bg-white border border-gray-100 shadow-sm py-7 px-16">
                    {pageInfo?.logo && (
                      <img
                        src={pageInfo.logo}
                        alt={serieTitle}
                        className="absolute left-4 top-1/2 -translate-y-1/2 h-9 md:h-10 w-auto object-contain opacity-90"
                      />
                    )}
                    <div className="flex flex-col items-center gap-2">
                      {section.serie?.slug && sportSlug && brandSlug ? (
                        <Link
                          href={`/${sportSlug}/${brandSlug}/${section.serie.slug}`}
                          className="text-2xl md:text-3xl font-bold text-[#1a1a1a] tracking-tight text-center hover:text-[var(--color-primary)] transition-colors"
                        >
                          {section.serie.title}
                        </Link>
                      ) : (
                        <h2 className="text-2xl md:text-3xl font-bold text-[#1a1a1a] tracking-tight text-center">
                          {section.serie?.title}
                        </h2>
                      )}
                      <span className="block w-12 h-1 rounded-full bg-[var(--color-primary)]" />
                    </div>
                  </div>

                  {/* محصولات بخش */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {section.products.map((product) => (
                      <ProductCard
                        key={product._id}
                        product={product}
                        rate={rate}
                        isWishlisted={product.isWishlisted}
                        onQuickView={() => openQuickView(product)}
                        onToggleWishlist={() => {}}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <div ref={sentinelRef} className="h-px w-full" />

              {loading && (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                  <FiLoader className="animate-spin" />
                  <span className="text-sm font-bold">در حال بارگذاری...</span>
                </div>
              )}

              {!hasMore && !loading && sections.length > 0 && (
                <p className="text-center text-xs text-gray-300 font-bold py-6">
                  همه‌ی زیرسری‌ها نمایش داده شد
                </p>
              )}
            </div>
          )}
        </main>
      </div>

      <QuickViewModal
        product={selectedProduct}
        rate={rate}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
      />
    </div>
  );
}
