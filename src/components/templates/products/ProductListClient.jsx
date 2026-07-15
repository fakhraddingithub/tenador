'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import ProductList from "./ProductList";
import FilterSidebar from "./FilterSidebar"; // این کامپوننت را در ادامه می‌سازیم
import SearchBar from "./SearchBar";
import useFilterScrollAnchor from "@/hooks/useFilterScrollAnchor";
import useDeferredProducts from "@/hooks/useDeferredProducts";
import { getListingPriceToman } from "@/components/features/filters/PriceRangeFilter";
import {
  buildAttributeMeta,
  parseAttrFiltersFromParams,
  writeAttrFiltersToParams,
  productMatchesAttrFilters,
} from "@/lib/attributeFilters";

export default function ProductListClient({ products: initialProducts, totalResults, rate, filterableAttributes = [] }) {
  const { products, isLoadingMore } = useDeferredProducts(
    initialProducts,
    totalResults,
    {},
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    brands: [],      // حتماً آرایه خالی باشد
    categories: [],  // حتماً آرایه خالی باشد
    sports: [],      // حتماً آرایه خالی باشد
    series: [],      // حتماً آرایه خالی باشد
    minPrice: 0,
    maxPrice: 0, // 0 = بدون سقف
  });

  // ─────────────────────────────────────────────
  // فیلتر بر اساس ویژگی‌های «قابل فیلتر» (در هر دسته‌بندی) — دکمه‌های انتخابی.
  // متادیتا و گزینه‌ها از روی همان محصولاتِ لودشده ساخته می‌شوند (همان هلپر
  // مشترکِ صفحه‌ی دسته)؛ ویژگیِ «رنگ» خودش گریدِ ۱۶ سواچ می‌شود.
  // ─────────────────────────────────────────────
  const attrMeta = useMemo(
    () => buildAttributeMeta(filterableAttributes, products),
    [filterableAttributes, products],
  );

  // فیلترهای اعمال‌شده — شکلِ مشترک: { [name]: [value, ...] }
  const [attrFilters, setAttrFilters] = useState({});

  // ── مقداردهی اولیه از روی URL (کلاینت‌ساید) تا لینکِ به‌اشتراک‌گذاشته همان
  //    نمای فیلترشده را بازتولید کند. ──
  useEffect(() => {
    if (typeof window === "undefined" || attrMeta.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttrFilters(parseAttrFiltersFromParams(sp, attrMeta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrMeta.length]);

  // اعمال تغییر فیلتر + همگام‌سازی URL بدون رفرش کامل (داده از قبل در حافظه است).
  const applyAttrFilters = (next) => {
    setAttrFilters(next);
    if (typeof window === "undefined") return;
    const params = writeAttrFiltersToParams(
      new URLSearchParams(window.location.search),
      next,
      attrMeta,
    );
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );

    // history.replaceState رویدادی منتشر نمی‌کند؛ به هدر اطلاع می‌دهیم تا خطِ
    // «فیلترهای فعال» را دوباره از URL بخواند.
    window.dispatchEvent(new Event("products:filters-change"));
  };

  // منطق فیلترینگ فوق حرفه‌ای
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // سرچ متنی
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());

      // فیلتر برند
      const matchesBrand = filters.brands.length === 0 ||
                           filters.brands.includes(product.brand?._id?.toString() || product.brand?.toString());

      // فیلتر ورزش
      const matchesSport = filters.sports.length === 0 ||
                           filters.sports.includes(product.sport?._id?.toString() || product.sport?.toString());

      // فیلتر کاتگوری
      const matchesCategory = filters.categories.length === 0 ||
                              filters.categories.includes(product.category?._id?.toString() || product.category?.toString());

      // فیلتر سری
      const matchesSerie = !filters.series || filters.series.length === 0 ||
                           filters.series.includes(product.serie?._id?.toString() || product.serie?.toString());

      // فیلتر قیمت — بر اساس قیمتِ نمایشیِ تومان (نه basePrice که یورو است)؛ maxPrice=0 یعنی بدون سقف
      const priceToman = getListingPriceToman(product);
      const matchesPrice = priceToman >= (filters.minPrice || 0) &&
                           (!filters.maxPrice || priceToman <= filters.maxPrice);

      // فیلتر ویژگی‌ها (همان منطق مشترکِ صفحه‌ی دسته: substring + AND)
      const matchesAttributes = productMatchesAttrFilters(product, attrFilters, attrMeta);

      return matchesSearch && matchesBrand && matchesSport && matchesCategory && matchesSerie && matchesPrice && matchesAttributes;
    });
  }, [searchTerm, filters, products, attrFilters, attrMeta]);

  // با تغییرِ فیلتر و کوتاه‌شدنِ لیست، نمای صفحه را به ناحیه‌ی فیلتر لنگر می‌اندازد
  // (جلوگیری از افتادن روی فوتر). signal = تعدادِ نتایج.
  const anchorRef = useRef(null);
  useFilterScrollAnchor(anchorRef, filteredProducts.length);

  return (
    <div
      ref={anchorRef}
      className="max-w-[1440px] mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8"
      dir="rtl"
    >

      {/* Sidebar: فیلترهای پیشرفته */}
      <aside className="w-full lg:w-1/4">
        <FilterSidebar
          initialProducts={products}
          filters={filters}
          setFilters={setFilters}
          attributeMeta={attrMeta}
          attrFilters={attrFilters}
          setAttrFilters={applyAttrFilters}
        />
      </aside>

      {/* Main Content: سرچ و لیست محصولات */}
      <main className="w-full lg:w-3/4">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[6px] border border-gray-100 shadow-sm">
          <div className="w-full md:w-1/2">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          <div className="text-sm font-bold text-gray-500">
             نمایش <span className="text-[#aa4725]">{filteredProducts.length}</span> محصول
             {isLoadingMore && <span className="mr-1 text-gray-400">(در حال تکمیل فهرست…)</span>}
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <ProductList
            products={filteredProducts}
            rate={rate}
            onAddToCart={(p) => console.log("Added", p)}
            onToggleWishlist={(p) => console.log("Wishlist", p)}
          />
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-[6px] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold">محصولی با این مشخصات پیدا نشد :(</p>
          </div>
        )}
      </main>
    </div>
  );
}
