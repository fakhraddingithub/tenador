"use client";

import { useState, useMemo } from "react";
import ProductList from "@/components/templates/products/ProductList";
import FilterSidebar from "@/components/templates/products/FilterSidebar";
import SearchBar from "@/components/templates/products/SearchBar";
import SeriesSlider from "@/components/templates/sports/SeriesSlider";
import { FiShoppingBag } from "react-icons/fi";

export default function SportPageClient({
  products: initialProducts = [],
  pageInfo = {},
  filters = {},
  rate,
  series = [],
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const [localFilters, setLocalFilters] = useState({
    brands: [],
    categories: [],
    series: [], // ✨ اضافه شد: آمادگی برای فیلتر کردن کلاینت‌ساید بر اساس سری
    minPrice: 0,
    maxPrice: 50000000,
  });

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

    if (serieTitle) {
      // مقدارهایی که وجود دارند را با یک فاصله به هم می‌چسبانیم
      const parts = [categoryTitle, brandTitle, serieTitle].filter(Boolean);
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

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        matchesSerie &&
        matchesPrice
      );
    });
  }, [searchTerm, localFilters, initialProducts]);

  return (
    <div className="bg-[#fcfcfc] min-h-screen" dir="rtl">
      {/* ───────────────── Hero ───────────────── */}
      <div className="relative h-[100px] md:h-[220px] w-full overflow-hidden">
        <img
          src={pageInfo.headImage || pageInfo.image || "/images/default-sport.jpg"}
          alt={dynamicTitle}
          className="w-full h-full object-cover scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-xl md:text-4xl font-bold text-white mb-4 drop-shadow-xl">
            {dynamicTitle}
          </h1>

          <div className="w-20 h-1 bg-[var(--color-primary)] rounded-full mb-4" />

        </div>
      </div>

      {/* ───────────────── Series Slider (سری‌های جدید) ───────────────── */}
      {series.filter((serie) => serie.isNewSerie && !serie.isLimitedEdition)
        .length > 0 &&
        !filters?.category &&
        !filters?.brand &&
        !filters?.serie && (
          <SeriesSlider
            series={series.filter(
              (serie) => serie.isNewSerie && !serie.isLimitedEdition,
            )}
            sportSlug={pageInfo.slug}
            sportTitle={pageInfo.title}
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
                onClick={() =>
                  setLocalFilters({
                    brands: [],
                    categories: [],
                    series: [],
                    minPrice: 0,
                    maxPrice: 50000000,
                  })
                }
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
        !filters?.serie && ( 
          <SeriesSlider
            series={series.filter((serie) => serie.isLimitedEdition)}
            sportSlug={pageInfo.slug}
            sportTitle={`لیمیتد ادیشن ${pageInfo.title}`}
          />
        )}
    </div>
  );
}