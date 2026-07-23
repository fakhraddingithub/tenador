"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import ProductList from "@/components/templates/products/ProductList";
import useFilterScrollAnchor from "@/hooks/useFilterScrollAnchor";
import useDeferredProducts from "@/hooks/useDeferredProducts";
import FilterSidebar from "@/components/templates/products/FilterSidebar";
import { getListingPriceToman } from "@/components/features/filters/PriceRangeFilter";
import SearchBar from "@/components/templates/products/SearchBar";
import SeriesSlider from "@/components/templates/sports/SeriesSlider";
import LimitedEditionsStrip from "@/components/templates/sports/LimitedEditionsStrip";
import SportHero from "@/components/templates/sports/SportHero";
import { FiShoppingBag } from "react-icons/fi";
import {
  buildAttributeMeta,
  parseAttrFiltersFromParams,
  writeAttrFiltersToParams,
  productMatchesAttrFilters,
} from "@/lib/attributeFilters";

export default function SportPageClient({
  products: initialProducts = [],
  pageInfo = {},
  filters = {},
  rate,
  series = [],
  // ایندکس سبک همه‌ی سری‌ها ({_id, parentSerie, brand, level, order, ...}) برای
  // فیلتر «سری» ریشه‌محور؛ اگر پاس داده نشود ([]) رفتار قبلی (سری مستقیم) حفظ می‌شود.
  seriesIndex = [],
  totalResults,
  listingFilter = {},
  // Optional slots — used by the themed Event page to reuse this exact layout.
  // All default to null/undefined so the Sport page renders byte-identically.
  titleOverride = null, // override the computed hero <h1>
  headerExtra = null, // node rendered under the title divider (e.g. countdown)
  belowHero = null, // node rendered right below the hero (e.g. description block)
  cardOverlay = null, // forwarded to ProductList → each ProductCard (event flair)
  campaignBadge = null, // forwarded to ProductList → each ProductCard badge stack
}) {
  const { products, isLoadingMore } = useDeferredProducts(
    initialProducts,
    totalResults,
    listingFilter,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const [localFilters, setLocalFilters] = useState({
    brands: [],
    categories: [],
    series: [], // ✨ اضافه شد: آمادگی برای فیلتر کردن کلاینت‌ساید بر اساس سری
    minPrice: 0,
    maxPrice: 0, // 0 = بدون سقف
  });

  // ─────────────────────────────────────────────
  // فیلتر بر اساس ویژگی‌های پویای دسته‌بندی (query-param driven)
  // ویژگی‌ها از روی filters.category.attributes تعریف می‌شوند و فقط روی
  // صفحه‌ی دسته (که category دارد) نمایش داده می‌شوند. صفحه‌ی اصلی ورزش و صفحه‌ی
  // رویداد که category پاس نمی‌دهند، هیچ فیلتر ویژگی نشان نمی‌دهند.
  // ─────────────────────────────────────────────
  const attributeMeta = useMemo(
    () => buildAttributeMeta(filters?.category?.attributes, products),
    [filters?.category, products],
  );

  const [attrFilters, setAttrFilters] = useState({});

  // مقداردهی اولیه از روی URL (کلاینت‌ساید) تا لینکِ به‌اشتراک‌گذاشته‌شده همان
  // نمای فیلترشده را بازتولید کند. window.location به‌جای useSearchParams تا این
  // کامپوننت اشتراکی (که صفحه‌ی رویداد هم از آن استفاده می‌کند) به Suspense نیاز
  // پیدا نکند.
  useEffect(() => {
    if (typeof window === "undefined" || attributeMeta.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    // خواندن وضعیت اولیه از URL یک «همگام‌سازی از سیستم بیرونی» (history) است؛
    // یک‌بار هنگام آماده‌شدن متادیتای ویژگی‌ها اجرا می‌شود.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttrFilters(parseAttrFiltersFromParams(sp, attributeMeta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributeMeta.length]);

  // اعمال تغییر فیلتر ویژگی + همگام‌سازی URL بدون رفرش کامل صفحه.
  // history.replaceState استفاده می‌شود تا داده‌ی سرور دوباره fetch نشود و
  // تجربه‌ی فیلتر آنی بماند (داده‌ها از قبل در حافظه هستند).
  const applyAttrFilters = (next) => {
    setAttrFilters(next);
    if (typeof window === "undefined") return;
    const params = writeAttrFiltersToParams(
      new URLSearchParams(window.location.search),
      next,
      attributeMeta,
    );
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  };

  // ─────────────────────────────────────────────
  // Dynamic Title Builder
  // ─────────────────────────────────────────────
  const dynamicTitle = useMemo(() => {
    const sportTitle =
      filters?.sport?.title ||
      filters?.sport?.name ||
      pageInfo?.title ||
      pageInfo?.name ||
      "";

    const categoryTitle =
      filters?.category?.title || filters?.category?.name || "";

    const brandTitle = filters?.brand?.title || filters?.brand?.name || "";

    const serieTitle = filters?.serie?.title || filters?.serie?.name || ""; // ✨ اضافه شد

    const limitedEditionTitle =
      filters?.limitedEdition?.title || filters?.limitedEdition?.name || "";

    if (serieTitle || limitedEditionTitle) {
      // مقدارهایی که وجود دارند را با یک فاصله به هم می‌چسبانیم
      const parts = [
        categoryTitle,
        brandTitle,
        serieTitle,
        limitedEditionTitle,
      ].filter(Boolean);
      return parts.join(" ");
    }

    // فقط اسپورت
    // تنیس
    if (!categoryTitle && !brandTitle) {
      return `فروشگاه تخصصی تجهیزات ${sportTitle}`;
    }

    // کتگوری + اسپورت
    // راکت تنیس
    if (categoryTitle && !brandTitle) {
      return `${categoryTitle}`;
    }

    // کتگوری + اسپورت + برند
    // راکت تنیس ویلسون
    return `${categoryTitle} ${brandTitle}`;
  }, [filters, pageInfo]);

  // ─────────────────────────────────────────────
  // لیمیتد ادیشن‌های موجود بین محصولات این صفحه (برای نوار لیمیتد ادیشن در صفحه سری)
  // ─────────────────────────────────────────────
  const pageLimitedEditions = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      const le = product.limitedEdition;
      if (le && typeof le === "object" && le._id && le.slug) {
        map.set(le._id.toString(), le);
      }
    }
    return Array.from(map.values());
  }, [products]);

  // ─────────────────────────────────────────────
  // فیلتر «سری» سلسله‌مراتبی: هر سری از روی parentSerie تا ریشه (level 0) بالا
  // می‌رود. chainOf زنجیره‌ی [خودش، والد، …، ریشه] را می‌دهد؛ انتخابِ هر عضو
  // زنجیره (ریشه یا زیرسری) کلِ زیرمجموعه‌ی همان عضو را شامل می‌شود. سری‌ای که
  // در ایندکس نباشد زنجیره‌اش فقط خودش است (= همان رفتار قبلی).
  // ─────────────────────────────────────────────
  const serieRootResolver = useMemo(() => {
    const byId = new Map(seriesIndex.map((s) => [String(s._id), s]));
    const chainCache = new Map();
    const chainOf = (id) => {
      const key = String(id);
      if (chainCache.has(key)) return chainCache.get(key);
      const chain = [key];
      const seen = new Set([key]);
      let cur = byId.get(key);
      while (cur?.parentSerie && byId.has(String(cur.parentSerie))) {
        const parentId = String(cur.parentSerie);
        if (seen.has(parentId)) break; // محافظ در برابر حلقه در داده
        seen.add(parentId);
        chain.push(parentId);
        cur = byId.get(parentId);
      }
      chainCache.set(key, chain);
      return chain;
    };
    const rootOf = (id) => {
      const chain = chainOf(id);
      return chain[chain.length - 1];
    };
    return { byId, chainOf, rootOf };
  }, [seriesIndex]);

  const serieBrandId = (doc) =>
    doc?.brand ? String(doc.brand._id || doc.brand) : null;

  // گزینه‌های فیلتر سری: همه‌ی سری‌های روی زنجیره‌ی اجدادِ محصولاتِ همین صفحه،
  // به‌صورت سلسله‌مراتبی (ریشه‌ها + زیرسری‌ها با _depth برای تورفتگی در سایدبار).
  // اگر برندی انتخاب شده باشد فقط گروه‌های ریشه‌ی همان برند(ها) می‌مانند.
  const seriesFilterOptions = useMemo(() => {
    // همه‌ی سری‌های حاضر: خودِ سریِ هر محصول + تمام اجدادش تا ریشه
    const present = new Map();
    for (const product of products) {
      const sid =
        product.serie?._id?.toString() ||
        (product.serie ? product.serie.toString() : null);
      if (!sid) continue;
      for (const id of serieRootResolver.chainOf(sid)) {
        if (present.has(id)) continue;
        // اگر سری در ایندکس نبود (ایندکس خالی/ناقص)، همان آبجکتِ populate شده‌ی
        // محصول به‌عنوان گزینه استفاده می‌شود — دقیقاً رفتار قبلی.
        const doc =
          serieRootResolver.byId.get(id) ||
          (id === sid && typeof product.serie === "object"
            ? product.serie
            : null);
        if (doc) present.set(id, doc);
      }
    }

    // محدودسازی برند بر اساس برندِ ریشه‌ی گروه تا گروه‌ها یکپارچه بمانند
    let entries = Array.from(present.entries());
    if (localFilters.brands.length > 0) {
      entries = entries.filter(([id, doc]) => {
        const rootDoc = present.get(serieRootResolver.rootOf(id)) || doc;
        const brandId = serieBrandId(rootDoc);
        return !brandId || localFilters.brands.includes(brandId);
      });
    }

    // ساخت درخت و پیمایش DFS: هر ریشه، بعد زیرسری‌هایش (مرتب بر اساس order)
    const kept = new Set(entries.map(([id]) => id));
    const childrenOf = new Map();
    const roots = [];
    for (const [id, doc] of entries) {
      const parentId =
        doc?.parentSerie && kept.has(String(doc.parentSerie))
          ? String(doc.parentSerie)
          : null;
      if (parentId) {
        if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
        childrenOf.get(parentId).push({ id, doc });
      } else {
        roots.push({ id, doc });
      }
    }
    const byOrder = (a, b) =>
      (a.doc.order ?? Number.MAX_SAFE_INTEGER) -
      (b.doc.order ?? Number.MAX_SAFE_INTEGER);
    const options = [];
    const walk = ({ id, doc }, depth) => {
      options.push({ ...doc, _depth: depth });
      (childrenOf.get(id) || [])
        .sort(byOrder)
        .forEach((child) => walk(child, depth + 1));
    };
    roots.sort(byOrder).forEach((root) => walk(root, 0));
    return options;
  }, [products, serieRootResolver, localFilters.brands]);

  // با تغییرِ انتخابِ برند، سری‌های انتخاب‌شده‌ای که به برند(های) جدید تعلق
  // ندارند حذف می‌شوند تا فیلترِ نامرئی باقی نماند.
  const applyLocalFilters = (next) => {
    if (next.series?.length && next.brands?.length) {
      const prunedSeries = next.series.filter((id) => {
        // برندِ گروه از ریشه گرفته می‌شود — هم‌راستا با محدودسازیِ گزینه‌ها
        const brandId = serieBrandId(
          serieRootResolver.byId.get(serieRootResolver.rootOf(id)) ||
            serieRootResolver.byId.get(id),
        );
        return !brandId || next.brands.includes(brandId);
      });
      if (prunedSeries.length !== next.series.length) {
        next = { ...next, series: prunedSeries };
      }
    }
    setLocalFilters(next);
  };

  // ─────────────────────────────────────────────
  // Product Filtering
  // ─────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesBrand =
        localFilters.brands.length === 0 ||
        localFilters.brands.includes(
          product.brand?._id?.toString() || product.brand?.toString(),
        );

      const matchesCategory =
        localFilters.categories.length === 0 ||
        localFilters.categories.includes(
          product.category?._id?.toString() || product.category?.toString(),
        );

      const productSerieId =
        product.serie?._id?.toString() ||
        (product.serie ? product.serie.toString() : null);
      // تطبیق سلسله‌مراتبی: محصول وقتی می‌ماند که سریِ خودش یا یکی از اجدادش
      // انتخاب شده باشد (انتخابِ والد = کل زیرمجموعه، انتخابِ زیرسری = خودش)
      const matchesSerie =
        !localFilters.series ||
        localFilters.series.length === 0 ||
        (!!productSerieId &&
          serieRootResolver
            .chainOf(productSerieId)
            .some((id) => localFilters.series.includes(id)));

      // بر اساس قیمتِ نمایشیِ تومان (نه basePrice که یورو است)؛ maxPrice=0 یعنی بدون سقف
      const priceToman = getListingPriceToman(product);
      const matchesPrice =
        priceToman >= (localFilters.minPrice || 0) &&
        (!localFilters.maxPrice || priceToman <= localFilters.maxPrice);

      const matchesAttributes = productMatchesAttrFilters(
        product,
        attrFilters,
        attributeMeta,
      );

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        matchesSerie &&
        matchesPrice &&
        matchesAttributes
      );
    });
  }, [searchTerm, localFilters, products, attrFilters, attributeMeta, serieRootResolver]);

  // با تغییرِ فیلتر و کوتاه‌شدنِ لیست، نمای صفحه را به ناحیه‌ی فیلتر لنگر می‌اندازد
  // (جلوگیری از افتادن روی فوتر). signal = تعدادِ نتایج.
  const anchorRef = useRef(null);
  useFilterScrollAnchor(anchorRef, filteredProducts.length);

  return (
    <div className="bg-[var(--page-surface,#fcfcfc)] min-h-screen" dir="rtl">
      {/* ───────────────── Hero ───────────────── */}
      <SportHero
        image={pageInfo.headImage || pageInfo.image}
        title={titleOverride || dynamicTitle}
        alt={dynamicTitle}
        headerExtra={headerExtra}
      />

      {/* Optional slot (event description) — Sport page passes nothing */}
      {belowHero}

      {/* ───────────────── Series Slider (سری‌های جدید) ───────────────── */}
      {series.filter((serie) => serie.isNewSerie && !serie.isLimitedEdition)
        .length > 0 &&
        !filters?.category &&
        !filters?.brand &&
        !filters?.serie &&
        !filters?.limitedEdition && (
          <SeriesSlider
            series={series.filter(
              (serie) => serie.isNewSerie && !serie.isLimitedEdition,
            )}
            sportSlug={pageInfo.slug}
            sportTitle={pageInfo.title}
          />
        )}

      {/* ───────── لیمیتد ادیشن‌های موجود در این سری (مثل Roland Garros) ───────── */}
      {filters?.serie && !filters?.limitedEdition && (
        <LimitedEditionsStrip
          limitedEditions={pageLimitedEditions}
          brandSlug={filters?.brand?.slug}
        />
      )}

      {/* ───────────────── Main Content ───────────────── */}
      <div
        ref={anchorRef}
        className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8"
      >
        {/* Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="sticky top-24">
            <FilterSidebar
              initialProducts={products}
              filters={localFilters}
              setFilters={applyLocalFilters}
              hideSportFilter={true}
              seriesOptions={seriesFilterOptions}
              attributeMeta={attributeMeta}
              attrFilters={attrFilters}
              setAttrFilters={applyAttrFilters}
            />
          </div>
        </aside>

        {/* Products */}
        <main className="w-full lg:w-3/4">
          {/* Top Bar */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-5 rounded-[var(--radius)] border border-gray-100 shadow-sm">
            <div className="w-full md:w-2/3">
              <SearchBar value={searchTerm} onChange={setSearchTerm} />
            </div>

            <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
              <FiShoppingBag className="text-[var(--color-primary)]" />

              <span className="font-bold">تعداد کالا:</span>

              <span className="text-[var(--color-text)] font-bold">
                {filteredProducts.length}
              </span>
              {isLoadingMore && <span className="text-xs">در حال تکمیل…</span>}
            </div>
          </div>

          {/* Product List */}
          {filteredProducts.length > 0 ? (
            <ProductList
              products={filteredProducts}
              rate={rate}
              cardOverlay={cardOverlay}
              campaignBadge={campaignBadge}
              onAddToCart={(p) => console.log("Added", p)}
              onToggleWishlist={(p) => console.log("Wishlist", p)}
            />
          ) : (
            <div className="text-center py-24 bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-100">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShoppingBag size={40} className="text-gray-300" />
              </div>

              <p className="text-gray-400 font-bold text-xl">
                هیچ کالایی با این فیلترها مطابقت ندارد!
              </p>

              <button
                onClick={() => {
                  setLocalFilters({
                    brands: [],
                    categories: [],
                    series: [],
                    minPrice: 0,
                    maxPrice: 0,
                  });
                  applyAttrFilters({});
                }}
                className="mt-4 text-[var(--color-primary)] font-bold underline"
              >
                پاک کردن تمام فیلترها
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Limited Edition Series Slider */}
      {series.filter((serie) => serie.isLimitedEdition).length > 0 &&
        !filters?.category &&
        !filters?.brand &&
        !filters?.serie &&
        !filters?.limitedEdition && (
          <SeriesSlider
            series={series.filter((serie) => serie.isLimitedEdition)}
            sportSlug={pageInfo.slug}
            sportTitle={`لیمیتد ادیشن ${pageInfo.title}`}
          />
        )}
    </div>
  );
}
