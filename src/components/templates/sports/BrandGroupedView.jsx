"use client";

/**
 * src/components/templates/sports/BrandGroupedView.jsx
 *
 * نمای صفحه‌ی برند: محصولات بر اساس «سری ریشه» (Level 0) گروه‌بندی می‌شوند و
 * محصولاتِ زیرسری‌ها زیر همان بخشِ سری ریشه می‌آیند (مثلاً Blade V10 و Blade V5
 * زیر بخش Blade). بخش‌ها و محصولاتشان به‌صورت تدریجی (infinite scroll) و
 * بخش‌به‌بخش از سرور بارگذاری می‌شوند تا بارِ اولیه سبک بماند.
 *
 * - SEO: اولین batch سمت سرور (SSR) رندر می‌شود.
 * - فیلتر/جستجو سمت سرور اعمال می‌شود؛ با تغییر فیلتر، از ابتدا واکشی می‌شود.
 * - جلوگیری از درخواست/رندر تکراری با نگهداری کلیدِ بخش‌های بارگذاری‌شده و
 *   شناسه‌ی درخواست (برای رد کردنِ پاسخ‌های کهنه).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import SearchBar from "@/components/templates/products/SearchBar";
import AttributeFilterCard from "@/components/templates/products/AttributeFilterCard";
import MobileFilterDrawer from "@/components/features/filters/MobileFilterDrawer";
import PriceRangeFilter, {
  getListingPriceToman,
} from "@/components/features/filters/PriceRangeFilter";
import useFilterScrollAnchor from "@/hooks/useFilterScrollAnchor";
import ProductGridSkeleton from "@/components/templates/sports/ProductCardSkeleton";
import { FiShoppingBag, FiFilter, FiRotateCcw } from "react-icons/fi";
import { withQueryParams } from "@/lib/navbarAudience";
import {
  attemptFetch,
  backoffDelay,
  waitBeforeRetry,
} from "@/lib/groupedFetchRetry";
import {
  buildBrandGroupedViewCacheKey,
  readBrandGroupedViewCache,
  writeBrandGroupedViewCache,
} from "@/lib/brandGroupedViewCache";
import {
  BRAND_SECTIONS_PER_BATCH,
  mergeGroupedSections,
} from "base/utils/groupedProductPagination";

const EMPTY_ATTR_FILTERS = Object.freeze([]);

export default function BrandGroupedView({
  pageInfo = {},
  filters = {},
  rate,
  brandId,
  sportId = null,
  categoryId = null,
  attrFilters = EMPTY_ATTR_FILTERS,
  filterMeta = null,
  initialData = {},
  title = "",
  belowHero = null,
  targetAudience = null,
}) {
  const cacheKey = buildBrandGroupedViewCacheKey({
    brandId,
    sportId,
    categoryId,
    attrFilters,
    targetAudience,
  });
  // در hydration اولیه cache خالی است و دقیقاً initialData سرور رندر می‌شود.
  // در بازگشت با navigation داخلی، lazy initializer وضعیت کامل قبلی را می‌گیرد.
  const [cachedSnapshot] = useState(() => readBrandGroupedViewCache(cacheKey));
  const startingData = cachedSnapshot || initialData;
  const startingFilters = cachedSnapshot?.filters || {
    search: "",
    minPrice: 0,
    maxPrice: 0,
  };

  // مقدارِ فعالِ کارتِ فیلترِ سایدبار = مقدارِ فیلترِ هم‌نام با ویژگیِ مگامنو
  const activeFilterValue =
    (filterMeta &&
      attrFilters.find((f) => f.name === filterMeta.name)?.values?.[0]) ||
    null;
  // ─── عنوان صفحه ───
  const categoryTitle = filters?.category?.title || filters?.category?.name || "";
  const brandTitle =
    filters?.brand?.title || filters?.brand?.name || pageInfo?.title || pageInfo?.name || "";
  const sportSlug = filters?.sport?.slug || "";
  const brandSlug = pageInfo?.slug || filters?.brand?.slug || "";
  const headTitle = [categoryTitle, brandTitle].filter(Boolean).join(" ") || brandTitle;

  // ─── State ───
  const [sections, setSections] = useState(startingData.sections || []);
  const [index, setIndex] = useState(startingData.index || []);
  const [nextOffset, setNextOffset] = useState(startingData.nextOffset ?? 0);
  const [nextProductOffset, setNextProductOffset] = useState(
    startingData.nextProductOffset ?? 0,
  );
  const [hasMore, setHasMore] = useState(Boolean(startingData.hasMore));
  const [totalCount, setTotalCount] = useState(startingData.totalCount ?? 0);
  const [loading, setLoading] = useState(false);
  // وضعیتِ اطلاع‌رسانیِ منفعل — بدونِ هیچ دکمه‌ی اقدام.
  // null | { op: "loadMore"|"applyFilters", phase: "retrying"|"terminal" }
  const [status, setStatus] = useState(null);
  // توکنی که فقط با «اعمالِ فیلتر» (ریستِ نتایج) بالا می‌رود، نه با loadMore؛
  // برای لنگرانداختنِ اسکرول به ناحیه‌ی فیلتر هنگام کوتاه‌شدنِ لیست استفاده می‌شود.
  const [filterToken, setFilterToken] = useState(0);

  // فیلترها — قیمت‌ها عددی به تومان؛ 0 یعنی بدون کف/سقف (همان قراردادِ API)
  const [searchTerm, setSearchTerm] = useState(startingFilters.search);
  const [minPrice, setMinPrice] = useState(startingFilters.minPrice);
  const [maxPrice, setMaxPrice] = useState(startingFilters.maxPrice);

  // Quick view
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ─── Refs (برای خواندن آخرین مقادیر داخل callback ها) ───
  const loadingRef = useRef(false);
  const reqIdRef = useRef(0);
  const sectionsRef = useRef(sections);
  const indexRef = useRef(index);
  const hasMoreRef = useRef(hasMore);
  const nextOffsetRef = useRef(nextOffset);
  const nextProductOffsetRef = useRef(nextProductOffset);
  const totalCountRef = useRef(totalCount);
  const filterRef = useRef(startingFilters);
  const sentinelRef = useRef(null);
  const mountedRef = useRef(false);
  // کنار زدنِ درخواستِ در جریان، لغوِ انتظارِ backoff، و پاک‌سازیِ unmount
  const abortRef = useRef(null);
  // نسخه‌ی فیلترهای قابلِ‌مشاهده — با هر تغییرِ ورودیِ فیلتر بالا می‌رود تا
  // تلاش‌های مجددِ مربوط به مقادیرِ قدیمی بلافاصله بی‌اعتبار شوند.
  const filterVersionRef = useRef(0);

  const syncRefs = (next) => {
    if (next.sections !== undefined) sectionsRef.current = next.sections;
    if (next.index !== undefined) indexRef.current = next.index;
    if (next.hasMore !== undefined) hasMoreRef.current = next.hasMore;
    if (next.nextOffset !== undefined) nextOffsetRef.current = next.nextOffset;
    if (next.nextProductOffset !== undefined) {
      nextProductOffsetRef.current = next.nextProductOffset;
    }
    if (next.totalCount !== undefined) totalCountRef.current = next.totalCount;
  };

  const cacheSnapshot = useCallback(
    (next = {}) => {
      writeBrandGroupedViewCache(cacheKey, {
        sections: next.sections ?? sectionsRef.current,
        index: next.index ?? indexRef.current,
        hasMore: next.hasMore ?? hasMoreRef.current,
        nextOffset: next.nextOffset ?? nextOffsetRef.current,
        nextProductOffset:
          next.nextProductOffset ?? nextProductOffsetRef.current,
        totalCount: next.totalCount ?? totalCountRef.current,
        filters: next.filters ?? filterRef.current,
      });
    },
    [cacheKey]
  );

  // مقادیرِ فیلترِ «در حالِ نمایش» را در لحظه‌ی فراخوانی می‌خواند.
  // هم debounce و هم دکمه‌ی تلاشِ دوباره از همین یک تابع استفاده می‌کنند، پس
  // «تلاشِ دوباره‌ی فیلتر» همیشه یعنی «همین مقادیری که کاربر الان می‌بیند».
  // عمداً هیچ snapshot ای از درخواستِ شکست‌خورده نگه داشته نمی‌شود؛ در غیر این
  // صورت تلاشِ دوباره مقادیری را می‌فرستاد که کاربر از آن عبور کرده است.
  const readPendingFilters = () => ({
    search: searchTerm.trim(),
    minPrice: Number(minPrice) || 0,
    maxPrice: Number(maxPrice) || 0,
  });

  // ─── ساختِ URL واکشی ───
  // خالص (pure): فیلترها آرگومان‌اند و از ref خوانده نمی‌شوند، تا یک درخواستِ
  // ناموفقِ فیلتر نتواند offsetِ قدیمی را با فیلترِ جدید ترکیب کند.
  const buildUrl = useCallback(
    (offset, productOffset, { withIndex = false, filters }) => {
      const f = filters;
      const params = new URLSearchParams();
      params.set("brandId", brandId);
      if (sportId) params.set("sportId", sportId);
      if (categoryId) params.set("categoryId", categoryId);
      if (Array.isArray(attrFilters) && attrFilters.length > 0) {
        params.set("attrFilters", JSON.stringify(attrFilters));
      }
      params.set("offset", String(offset));
      params.set("productOffset", String(productOffset));
      params.set("limit", String(BRAND_SECTIONS_PER_BATCH));
      if (f.minPrice > 0) params.set("minPrice", String(f.minPrice));
      if (f.maxPrice > 0) params.set("maxPrice", String(f.maxPrice));
      if (f.search) params.set("search", f.search);
      if (withIndex) params.set("withIndex", "1");
      if (targetAudience) params.set("targetAudience", targetAudience);
      return `/api/brands/grouped?${params.toString()}`;
    },
    [brandId, sportId, categoryId, attrFilters, targetAudience]
  );

  // هر تغییرِ فیلترِ قابلِ‌مشاهده: نسخه را بالا ببر و هر درخواست/انتظارِ backoffِ
  // در جریان را همان‌جا لغو کن. این کار در خودِ هندلرها انجام می‌شود (نه فقط در
  // افکتِ debounce) تا تلاشِ مجددِ مقدارِ قدیمی حتی در پنجره‌ی ۴۰۰ms هم زنده نماند.
  const invalidateFilters = useCallback(() => {
    filterVersionRef.current += 1;
    abortRef.current?.abort();
    setStatus(null);
  }, []);

  // ─── تنها مسیرِ واکشی: هم batch بعدی، هم اعمالِ فیلتر ───
  // خروجی: "success" | "terminal" | "aborted" | "skipped".
  //
  // حلقه‌ی تلاشِ مجدد داخلِ خودِ run است (نه با setTimeoutِ بیرونی) تا:
  //  • jumpTo بتواند با await واقعاً منتظرِ عبور از تلاش‌های مجدد بماند،
  //  • loadingRef در تمامِ مدت true بماند و observer درخواستِ موازی نسازد،
  //  • لغو کردن با یک abort همه‌چیز (fetch و انتظارِ backoff) را با هم بردارد.
  //
  // قاعده‌ی commit: هیچ ref ای که در سازگاریِ نتایج نقش دارد (filterRef,
  // sectionsRef و cursorها) پیش از پاسخِ موفق تغییر نمی‌کنند.
  const run = useCallback(
    async (op, opts = {}) => {
      // observer نباید درخواستِ موازی بسازد
      if (op === "loadMore" && (loadingRef.current || !hasMoreRef.current)) {
        return "skipped";
      }

      abortRef.current?.abort(); // درخواستِ در جریان کنار زده می‌شود
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      // بعد از abort بالا می‌رود تا درخواستِ کنارگذاشته‌شده reqId کهنه ببیند
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
              ? buildUrl(0, 0, { withIndex: true, filters })
              : buildUrl(
                  nextOffsetRef.current,
                  nextProductOffsetRef.current,
                  { filters },
                );

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
              const incomingIndex = data.index || [];
              const incomingHasMore = Boolean(data.hasMore);
              const incomingOffset = data.nextOffset ?? 0;
              const incomingProductOffset = data.nextProductOffset ?? 0;
              const incomingTotalCount = data.totalCount ?? 0;
              filterRef.current = filters;
              syncRefs({
                sections: incoming,
                index: incomingIndex,
                hasMore: incomingHasMore,
                nextOffset: incomingOffset,
                nextProductOffset: incomingProductOffset,
                totalCount: incomingTotalCount,
              });
              setSections(incoming);
              setIndex(incomingIndex);
              setHasMore(incomingHasMore);
              setNextOffset(incomingOffset);
              setNextProductOffset(incomingProductOffset);
              setTotalCount(incomingTotalCount);
              cacheSnapshot({
                sections: incoming,
                index: incomingIndex,
                hasMore: incomingHasMore,
                nextOffset: incomingOffset,
                nextProductOffset: incomingProductOffset,
                totalCount: incomingTotalCount,
                filters,
              });
              setFilterToken((t) => t + 1); // → ارزیابیِ لنگرِ اسکرول
            } else {
              const merged = mergeGroupedSections(
                sectionsRef.current,
                data.sections || [],
              );
              const incomingHasMore = Boolean(data.hasMore);
              const incomingOffset = data.nextOffset ?? nextOffsetRef.current;
              const incomingProductOffset =
                data.nextProductOffset ?? nextProductOffsetRef.current;
              syncRefs({
                sections: merged,
                hasMore: incomingHasMore,
                nextOffset: incomingOffset,
                nextProductOffset: incomingProductOffset,
              });
              setSections(merged);
              setHasMore(incomingHasMore);
              setNextOffset(incomingOffset);
              setNextProductOffset(incomingProductOffset);
              cacheSnapshot({
                sections: merged,
                hasMore: incomingHasMore,
                nextOffset: incomingOffset,
                nextProductOffset: incomingProductOffset,
              });
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
    [buildUrl, cacheSnapshot]
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  // حتی اولین batchِ SSR را نیز ثبت کن تا ترک و بازگشتِ سریع صفحه، همان state را
  // بازیابی کند. هر loadMore موفق snapshot کامل‌تر را جایگزین می‌کند.
  useEffect(() => {
    cacheSnapshot();
  }, [cacheSnapshot]);

  // ─── debounce فیلترها (جستجو + قیمت) ───
  useEffect(() => {
    // اولین رندر: SSR قبلاً داده‌ی بدون‌فیلتر را داده، دوباره واکشی نکن
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

  // ─── IntersectionObserver برای infinite scroll ───
  // وابسته به sections.length و hasMore: پس از هر batch، observer دوباره ساخته
  // می‌شود تا اگر sentinel هنوز در دید است (محتوا کوتاه‌تر از viewport)، batch
  // بعدی هم بارگذاری شود. loadingRef از درخواست‌های هم‌زمان جلوگیری می‌کند.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) run("loadMore");
      },
      { rootMargin: "600px 0px" } // کمی زودتر از رسیدن به انتها بارگذاری شود
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [run, hasMore, sections.length, nextOffset, nextProductOffset]);

  // ─── پرشِ سریع به یک بخش (در صورت لزوم تا رسیدن به آن batch می‌گیرد) ───
  const jumpTo = useCallback(
    async (key) => {
      let guard = 0;
      while (
        !sectionsRef.current.some((s) => s.key === key) &&
        hasMoreRef.current &&
        guard < 50
      ) {
        // با شکست/کنارگذاشتن/رد شدن متوقف شو؛ پیش از این loadMore همیشه
        // undefined برمی‌گرداند و یک خطای پایدار، هر ۵۰ دورِ حلقه را می‌سوزاند.
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
  // (جستجو در نوارِ بالا قرار دارد و جزو سایدبار نیست.)
  const activeCount =
    (Number(minPrice) > 0 ? 1 : 0) + (Number(maxPrice) > 0 ? 1 : 0);

  // پس از اعمالِ فیلتر (ریستِ نتایج)، اگر لیست کوتاه شد، نمای صفحه را به ناحیه‌ی
  // فیلتر لنگر می‌اندازد. به filterToken وابسته است تا با loadMore (افزایشِ نتایج)
  // فعال نشود و پیمایشِ بی‌نهایت را به‌هم نزند.
  const anchorRef = useRef(null);
  useFilterScrollAnchor(anchorRef, filterToken);

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // With a price filter, a 20-product cursor page may have no visible result
  // while later cursor pages do. Keep the sentinel alive until the server says
  // there is no remaining data; only then show the definitive empty state.
  const isEmpty = !loading && sections.length === 0 && !hasMore;

  // ─── شمارنده‌ی صادق ───
  // totalCount کلِ محصولاتِ برند است، ولی بدنه فقط بخش‌های بارگذاری‌شده را نشان
  // می‌دهد → عددِ خام «۵۳» کنارِ ۱۰ کارت. ضمناً فیلترِ قیمت در سرور بعد از
  // شمارش و در JS اعمال می‌شود، پس totalCount با آن اصلاً هم‌خوان نیست؛ در آن
  // حالت فقط تعدادِ بارگذاری‌شده نشان داده می‌شود تا عدد هرگز غلط نباشد.
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
          alt={headTitle}
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-4 drop-shadow-xl">
            {headTitle}
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
            {/* هدر فیلتر */}
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

            {/* فیلتر ویژگیِ مگامنو — مقدار اولیه از URL، تغییر با navigationِ نرم */}
            <AttributeFilterCard
              meta={filterMeta}
              activeValue={activeFilterValue}
            />

            {/* نویگیشن سری‌ها (پرش به بخش) */}
            {index.length > 0 && (
              <div className="bg-white rounded-[6px] border border-gray-100 shadow-sm overflow-hidden">
                <h4 className="p-5 text-sm font-bold text-[#1a1a1a]">سری‌ها</h4>
                <div className="px-5 pb-5 flex flex-col gap-3 max-h-52 overflow-y-auto custom-scrollbar">
                  {index.map((entry) =>
                    entry.slug && sportSlug && brandSlug ? (
                      <Link
                        key={entry.key}
                        href={withQueryParams(
                          "/" + sportSlug + "/" + brandSlug + "/" + entry.slug,
                          { targetAudience },
                        )}
                        className="w-full flex items-center justify-between group cursor-pointer text-right"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-5 h-5 shrink-0 rounded-[4px] border-2 border-gray-200 flex items-center justify-center transition-all group-hover:border-[#aa4725]" />
                          <span className="min-w-0 truncate text-xs font-bold text-gray-500 transition-colors group-hover:text-gray-800">
                            {entry.title}
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        key={entry.key}
                        onClick={() => jumpTo(entry.key)}
                        className="w-full flex items-center justify-between group cursor-pointer text-right"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-5 h-5 shrink-0 rounded-[4px] border-2 border-gray-200 flex items-center justify-center transition-all group-hover:border-[#aa4725]" />
                          <span className="min-w-0 truncate text-xs font-bold text-gray-500 transition-colors group-hover:text-gray-800">
                            {entry.title}
                          </span>
                        </div>
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
          {/* Top Bar */}
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

          {/* خالی */}
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
                  {/* هدر بخشِ سری — لوگوی برند سمت چپ، نام سری مرکز‌چین با خط زیرین رنگ اصلی */}
                  <div className="relative mb-7 flex h-[112px] md:h-[118px] items-center justify-center rounded-[var(--radius)] bg-white border border-gray-100 shadow-sm px-16 md:px-20 py-3">
                    {pageInfo?.logo && (
                      <img
                        src={pageInfo.logo}
                        alt={brandTitle}
                        className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 h-12 md:h-16 max-h-[64px] w-auto object-contain opacity-90"
                      />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
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
                      <p className="h-5 md:h-6 max-w-2xl overflow-hidden text-center text-xs md:text-sm leading-5 md:leading-6 text-gray-500">
                        {section.serie?.shortDescription || "\u00a0"}
                      </p>
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

              {/* Sentinel + وضعیت بارگذاری */}
              <div ref={sentinelRef} className="h-px w-full" />

              {/* اسکلتونِ بارگذاری — دو ردیفِ کارت با ابعادِ دقیقِ کارت واقعی و
                  درخششِ روان؛ جایگزینِ متنِ «در حال بارگذاری». */}
              {loading && <ProductGridSkeleton count={8} />}

              {status?.op === "loadMore" && statusNote(status.phase)}

              {!hasMore && !loading && sections.length > 0 && (
                <p className="text-center text-xs text-gray-300 font-bold py-6">
                  همه‌ی سری‌ها نمایش داده شد
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
