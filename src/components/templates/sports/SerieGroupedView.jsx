"use client";

/**
 * src/components/templates/sports/SerieGroupedView.jsx
 *
 * نمای صفحه‌ی سری ریشه (level 0): محصولات بر اساس زیرسری‌های مستقیم (level 1)
 * گروه‌بندی می‌شوند. هر بخش روی عنوان زیرسری کلیک‌پذیر است و به صفحه‌ی آن
 * زیرسری هدایت می‌کند. بخش‌ها به‌صورت تدریجی (infinite scroll) بارگذاری می‌شوند.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import SearchBar from "@/components/templates/products/SearchBar";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import PriceRangeFilter, {
  getListingPriceToman,
} from "@/components/features/filters/PriceRangeFilter";
import useFilterScrollAnchor from "@/hooks/useFilterScrollAnchor";
import { FiShoppingBag, FiLayers, FiLoader, FiFilter, FiRotateCcw } from "react-icons/fi";
import { withQueryParams } from "@/lib/navbarAudience";
import {
  attemptFetch,
  backoffDelay,
  waitBeforeRetry,
} from "@/lib/groupedFetchRetry";

const BATCH_SECTIONS = 2;

export default function SerieGroupedView({
  pageInfo = {},
  filters = {},
  rate,
  serieId,
  sportId = null,
  categoryId = null,
  targetAudience = null,
  brandSlug = "",
  initialData = {},
  title = "",
  belowHero = null,
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
  // اطلاع‌رسانیِ منفعل — null | { op, phase: "retrying"|"terminal" }
  const [status, setStatus] = useState(null);
  // توکنی که فقط با «اعمالِ فیلتر» (ریستِ نتایج) بالا می‌رود، نه با loadMore.
  const [filterToken, setFilterToken] = useState(0);

  // قیمت‌ها عددی به تومان؛ 0 یعنی بدون کف/سقف (همان قراردادِ API)
  const [searchTerm, setSearchTerm] = useState("");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);

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
  // کنار زدنِ درخواستِ در جریان، لغوِ انتظارِ backoff، و پاک‌سازیِ unmount
  const abortRef = useRef(null);
  // نسخه‌ی فیلترهای قابلِ‌مشاهده — با هر تغییرِ ورودی بالا می‌رود
  const filterVersionRef = useRef(0);

  const syncRefs = (next) => {
    if (next.sections !== undefined) sectionsRef.current = next.sections;
    if (next.hasMore !== undefined) hasMoreRef.current = next.hasMore;
    if (next.nextOffset !== undefined) nextOffsetRef.current = next.nextOffset;
  };

  // همان قرارداد BrandGroupedView: منبعِ واحدِ مقادیرِ فیلترِ در حالِ نمایش.
  // debounce و دکمه‌ی تلاشِ دوباره هر دو از همین تابع می‌خوانند.
  const readPendingFilters = () => ({
    search: searchTerm.trim(),
    minPrice: Number(minPrice) || 0,
    maxPrice: Number(maxPrice) || 0,
  });

  // خالص: فیلترها آرگومان‌اند، نه خوانده‌شده از ref.
  const buildUrl = useCallback(
    (offset, { withIndex = false, filters }) => {
      const f = filters;
      const params = new URLSearchParams();
      params.set("serieId", serieId);
      if (sportId) params.set("sportId", sportId);
      if (categoryId) params.set("categoryId", categoryId);
      if (targetAudience) params.set("targetAudience", targetAudience);
      params.set("offset", String(offset));
      params.set("limit", String(BATCH_SECTIONS));
      if (f.minPrice > 0) params.set("minPrice", String(f.minPrice));
      if (f.maxPrice > 0) params.set("maxPrice", String(f.maxPrice));
      if (f.search) params.set("search", f.search);
      if (withIndex) params.set("withIndex", "1");
      return `/api/series/grouped?${params.toString()}`;
    },
    [serieId, sportId, categoryId, targetAudience]
  );

  // هر تغییرِ فیلترِ قابلِ‌مشاهده: نسخه را بالا ببر و هر درخواست/انتظارِ backoffِ
  // در جریان را همان‌جا لغو کن — در خودِ هندلرها، نه فقط در افکتِ debounce، تا
  // تلاشِ مجددِ مقدارِ قدیمی حتی در پنجره‌ی ۴۰۰ms هم زنده نماند.
  const invalidateFilters = useCallback(() => {
    filterVersionRef.current += 1;
    abortRef.current?.abort();
    setStatus(null);
  }, []);

  // ─── تنها مسیرِ واکشی — قراردادِ یکسان با BrandGroupedView ───
  // خروجی: "success" | "terminal" | "aborted" | "skipped".
  //
  // حلقه‌ی تلاشِ مجدد داخلِ خودِ run است (نه با setTimeoutِ بیرونی) تا:
  //  • jumpTo بتواند با await واقعاً منتظرِ عبور از تلاش‌های مجدد بماند،
  //  • loadingRef در تمامِ مدت true بماند و observer درخواستِ موازی نسازد،
  //  • لغو کردن با یک abort همه‌چیز (fetch و انتظارِ backoff) را با هم بردارد.
  //
  // قاعده‌ی commit: هیچ ref ای که در سازگاریِ نتایج نقش دارد پیش از پاسخِ موفق
  // تغییر نمی‌کند.
  const run = useCallback(
    async (op, opts = {}) => {
      if (op === "loadMore" && (loadingRef.current || !hasMoreRef.current)) {
        return "skipped";
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      const reqId = ++reqIdRef.current;
      const version = op === "applyFilters" ? opts.version : null;

      loadingRef.current = true;
      setLoading(true);
      setStatus(null);

      // شمارنده‌ی تلاش local است، پس هر عملیاتِ موفق آن را طبیعتاً صفر می‌کند
      let attempt = 0;

      try {
        for (;;) {
          const stale =
            signal.aborted ||
            reqId !== reqIdRef.current ||
            (op === "applyFilters" && version !== filterVersionRef.current);
          if (stale) return "aborted";

          const filters = op === "applyFilters" ? opts.filters : filterRef.current;
          const url =
            op === "applyFilters"
              ? buildUrl(0, { withIndex: true, filters })
              : buildUrl(nextOffsetRef.current, { filters });

          const out = await attemptFetch(url, signal);

          // کنارگذاشته‌شده/unmount → بی‌صدا، بدونِ commit و بدونِ تلاشِ مجدد
          if (out.kind === "aborted" || signal.aborted || reqId !== reqIdRef.current) {
            return "aborted";
          }

          if (out.kind === "success") {
            const data = out.data;
            // ─── فاز commit: تنها جایی که state/ref تغییر می‌کند ───
            if (op === "applyFilters") {
              const incoming = data.sections || [];
              filterRef.current = filters;
              loadedKeysRef.current = new Set(incoming.map((s) => s.key));
              syncRefs({
                sections: incoming,
                hasMore: Boolean(data.hasMore),
                nextOffset: data.nextOffset ?? 0,
              });
              setSections(incoming);
              setIndex(data.index || []);
              setHasMore(Boolean(data.hasMore));
              setNextOffset(data.nextOffset ?? 0);
              setTotalCount(data.totalCount ?? 0);
              setFilterToken((t) => t + 1); // → ارزیابیِ لنگرِ اسکرول
            } else {
              const incoming = (data.sections || []).filter(
                (s) => !loadedKeysRef.current.has(s.key)
              );
              incoming.forEach((s) => loadedKeysRef.current.add(s.key));
              const merged = [...sectionsRef.current, ...incoming];
              syncRefs({
                sections: merged,
                hasMore: Boolean(data.hasMore),
                nextOffset: data.nextOffset ?? nextOffsetRef.current,
              });
              setSections(merged);
              setHasMore(Boolean(data.hasMore));
              setNextOffset(data.nextOffset ?? nextOffsetRef.current);
            }
            setStatus(null);
            return "success";
          }

          if (out.kind === "terminal") {
            // ۴xxِ غیرقابلِ‌بازیابی — بی‌نهایت تکرار نمی‌شود
            console.error(`${op} failed permanently:`, out.reason);
            setStatus({ op, phase: "terminal" });
            return "terminal";
          }

          // قابلِ بازیابی → backoff نمایی + jitter، با احترام به Retry-After
          attempt += 1;
          console.warn(`${op} attempt ${attempt} failed (${out.reason}); retrying`);
          setStatus({ op, phase: "retrying" });
          const ok = await waitBeforeRetry(
            backoffDelay(attempt, out.retryAfterMs),
            signal
          );
          if (!ok) return "aborted";
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        // درخواستِ کهنه نباید وضعیتِ بارگذاریِ درخواستِ جدیدتر را پاک کند
        if (reqId === reqIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [buildUrl]
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const t = setTimeout(
      () =>
        run("applyFilters", {
          filters: readPendingFilters(),
          version: filterVersionRef.current,
        }),
      400
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, minPrice, maxPrice, run]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) run("loadMore");
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [run, hasMore, sections.length]);

  const jumpTo = useCallback(
    async (key) => {
      let guard = 0;
      while (
        !sectionsRef.current.some((s) => s.key === key) &&
        hasMoreRef.current &&
        guard < 50
      ) {
        // با شکست/کنارگذاشتن/رد شدن متوقف شو
        const result = await run("loadMore");
        if (result !== "success") break;
        guard++;
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`serie-section-${key}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [run]
  );

  // هندلرهای فیلتر — همگی ابتدا نسخه را بی‌اعتبار می‌کنند
  const handleSearchChange = (value) => {
    invalidateFilters();
    setSearchTerm(value);
  };

  const handlePriceChange = ({ min, max }) => {
    invalidateFilters();
    setMinPrice(min);
    setMaxPrice(max);
  };

  const resetFilters = () => {
    invalidateFilters();
    setSearchTerm("");
    setMinPrice(0);
    setMaxPrice(0);
  };

  // دامنه‌ی اسلایدرِ قیمت از روی قیمتِ تومانِ محصولاتِ بارگذاری‌شده (کامپوننتِ
  // مشترک آن را گرد و فقط رو به بالا نگه می‌دارد تا با فیلترشدنِ نتایج جمع نشود).
  const priceBounds = useMemo(() => {
    let maxSeen = 0;
    for (const section of sections) {
      for (const p of section.products || []) {
        const v = getListingPriceToman(p);
        if (v > maxSeen) maxSeen = v;
      }
    }
    return { min: 0, max: maxSeen };
  }, [sections]);

  // تعداد فیلترهای فعالِ سایدبار — فقط برای بجِ دکمه‌ی موبایلِ MobileFilterDrawer.
  const activeCount =
    (Number(minPrice) > 0 ? 1 : 0) + (Number(maxPrice) > 0 ? 1 : 0);

  // پس از اعمالِ فیلتر، اگر لیست کوتاه شد، نمای صفحه را به ناحیه‌ی فیلتر لنگر می‌اندازد.
  const anchorRef = useRef(null);
  useFilterScrollAnchor(anchorRef, filterToken);

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const isEmpty = !loading && sections.length === 0;

  // ─── شمارنده‌ی صادق (همان منطقِ BrandGroupedView) ───
  // فیلترِ قیمت در سرور پس از شمارش و در JS اعمال می‌شود، پس totalCount با آن
  // هم‌خوان نیست؛ در آن حالت فقط تعدادِ بارگذاری‌شده نمایش داده می‌شود.
  const loadedCount = sections.reduce(
    (n, s) => n + (s.products?.length || 0),
    0
  );
  const priceFilterActive = Number(minPrice) > 0 || Number(maxPrice) > 0;
  const countLabel = priceFilterActive
    ? loadedCount.toLocaleString("fa-IR")
    : loadedCount < totalCount
      ? `${loadedCount.toLocaleString("fa-IR")} از ${totalCount.toLocaleString("fa-IR")}`
      : totalCount.toLocaleString("fa-IR");

  // اطلاع‌رسانیِ منفعل — بدونِ دکمه. تلاشِ مجدد خودکار انجام می‌شود.
  const statusNote = (phase) => (
    <p
      role="status"
      aria-live="polite"
      className="my-4 text-center text-xs font-bold text-gray-400"
    >
      {phase === "retrying"
        ? "بارگذاری ناموفق بود؛ تلاش مجدد خودکار…"
        : "بارگذاری این بخش ممکن نشد."}
    </p>
  );

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

      {belowHero}

      {/* ───────────────── Main ───────────────── */}
      <div
        ref={anchorRef}
        className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8"
      >
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
                        href={withQueryParams(
                          `/${sportSlug}/${brandSlug}/${entry.slug}`,
                          { targetAudience },
                        )}
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

            {/* فیلتر قیمت — کامپوننتِ مشترکِ اسلایدرِ دوسَره + اینپوت‌های هزارگان‌دار */}
            <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm">
              <PriceRangeFilter
                className="p-5"
                bounds={priceBounds}
                value={{ min: minPrice, max: maxPrice }}
                onChange={handlePriceChange}
              />
            </div>
          </div>
          </MobileFilterDrawer>
        </aside>

        {/* Sections */}
        <main className="w-full lg:w-3/4">
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-5 rounded-[var(--radius)] border border-gray-100 shadow-sm">
            <div className="w-full md:w-2/3">
              <SearchBar value={searchTerm} onChange={handleSearchChange} />
            </div>
            <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
              <FiShoppingBag className="text-[var(--color-primary)]" />
              <span className="font-bold">تعداد کالا:</span>
              <span className="text-[var(--color-text)] font-bold">
                {countLabel}
              </span>
            </div>
          </div>

          {status?.op === "applyFilters" && statusNote(status.phase)}

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
                          href={withQueryParams(
                            `/${sportSlug}/${brandSlug}/${section.serie.slug}`,
                            { targetAudience },
                          )}
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

              {status?.op === "loadMore" && statusNote(status.phase)}

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
