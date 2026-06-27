"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProductList from "@/components/templates/products/ProductList";
import FilterSidebar from "@/components/templates/products/FilterSidebar";
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
  // بُعدِ جنسیت سمت سرور اعمال می‌شود (queryBySlugs)؛ این prop فقط برای
  // مقداردهیِ اولیه‌ی کنترل‌های سایدبار است. صفحه‌ی رویداد آن را پاس نمی‌دهد.
  activeGender = null,
  enableGenderFilter = false, // فقط صفحات PLP (دسته/برند) آن را فعال می‌کنند
  // Optional slots — used by the themed Event page to reuse this exact layout.
  // All default to null/undefined so the Sport page renders byte-identically.
  titleOverride = null, // override the computed hero <h1>
  headerExtra = null, // node rendered under the title divider (e.g. countdown)
  belowHero = null, // node rendered right below the hero (e.g. description block)
  cardOverlay = null, // forwarded to ProductList → each ProductCard (event flair)
  campaignBadge = null, // forwarded to ProductList → each ProductCard badge stack
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  // تغییر جنسیت → همگام‌سازیِ ?gender= در URL با navigationِ نرم (بدون رفرشِ کاملِ
  // صفحه). فیلتر جنسیت سمت سرور (queryBySlugs) اعمال می‌شود، پس با تغییر آن سرور
  // مجموعه‌ی محصولات را دوباره و درست برمی‌گرداند. کلیکِ دوباره روی همان گزینه آن را
  // خاموش می‌کند.
  const handleGenderChange = (g) => {
    if (typeof window === "undefined") return;
    const next = activeGender === g ? null : g;
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("gender", next);
    else params.delete("gender");
    const qs = params.toString();
    router.push(
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      { scroll: false },
    );
  };

  const [localFilters, setLocalFilters] = useState({
    brands: [],
    categories: [],
    series: [], // ✨ اضافه شد: آمادگی برای فیلتر کردن کلاینت‌ساید بر اساس سری
    minPrice: 0,
    maxPrice: 50000000,
  });

  // ─────────────────────────────────────────────
  // فیلتر بر اساس ویژگی‌های پویای دسته‌بندی (query-param driven)
  // ویژگی‌ها از روی filters.category.attributes تعریف می‌شوند و فقط روی
  // صفحه‌ی دسته (که category دارد) نمایش داده می‌شوند. صفحه‌ی اصلی ورزش و صفحه‌ی
  // رویداد که category پاس نمی‌دهند، هیچ فیلتر ویژگی نشان نمی‌دهند.
  // ─────────────────────────────────────────────
  const attributeMeta = useMemo(
    () => buildAttributeMeta(filters?.category?.attributes, initialProducts),
    [filters?.category, initialProducts],
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
    for (const product of initialProducts) {
      const le = product.limitedEdition;
      if (le && typeof le === "object" && le._id && le.slug) {
        map.set(le._id.toString(), le);
      }
    }
    return Array.from(map.values());
  }, [initialProducts]);

  // ─────────────────────────────────────────────
  // Product Filtering
  // ─────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
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

      const matchesSerie =
        !localFilters.series ||
        localFilters.series.length === 0 ||
        localFilters.series.includes(
          product.serie?._id?.toString() || product.serie?.toString(),
        );

      const matchesPrice =
        product.basePrice >= localFilters.minPrice &&
        product.basePrice <= localFilters.maxPrice;

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
  }, [searchTerm, localFilters, initialProducts, attrFilters, attributeMeta]);

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
          sportSlug={filters?.sport?.slug}
        />
      )}

      {/* ───────────────── Main Content ───────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="sticky top-24">
            <FilterSidebar
              initialProducts={initialProducts}
              filters={localFilters}
              setFilters={setLocalFilters}
              hideSportFilter={true}
              attributeMeta={attributeMeta}
              attrFilters={attrFilters}
              setAttrFilters={applyAttrFilters}
              activeGender={activeGender}
              onGenderChange={enableGenderFilter ? handleGenderChange : null}
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
                    maxPrice: 50000000,
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