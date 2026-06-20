'use client';

import { useState, useMemo, useEffect } from "react";
import ProductList from "./ProductList";
import FilterSidebar from "./FilterSidebar"; // این کامپوننت را در ادامه می‌سازیم
import SearchBar from "./SearchBar";
import {
  buildAttributeMeta,
  parseAttrFiltersFromParams,
  writeAttrFiltersToParams,
  productMatchesAttrFilters,
} from "@/lib/attributeFilters";

export default function ProductListClient({ products: initialProducts, rate, filterableAttributes = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    brands: [],      // حتماً آرایه خالی باشد
    categories: [],  // حتماً آرایه خالی باشد
    sports: [],      // حتماً آرایه خالی باشد
    minPrice: 0,
    maxPrice: 50000000,
  });

  // ─────────────────────────────────────────────
  // فیلتر بر اساس ویژگی‌های «قابل فیلتر» (در هر دسته‌بندی) — دکمه‌های انتخابی.
  // متادیتا و گزینه‌ها از روی همان محصولاتِ لودشده ساخته می‌شوند (همان هلپر
  // مشترکِ صفحه‌ی دسته)؛ ویژگیِ «رنگ» خودش گریدِ ۱۶ سواچ می‌شود.
  // ─────────────────────────────────────────────
  const attrMeta = useMemo(
    () => buildAttributeMeta(filterableAttributes, initialProducts),
    [filterableAttributes, initialProducts],
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
    return initialProducts.filter((product) => {
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

      // فیلتر قیمت
      const matchesPrice = product.basePrice >= filters.minPrice && product.basePrice <= filters.maxPrice;

      // فیلتر ویژگی‌ها (همان منطق مشترکِ صفحه‌ی دسته: substring + AND)
      const matchesAttributes = productMatchesAttrFilters(product, attrFilters, attrMeta);

      return matchesSearch && matchesBrand && matchesSport && matchesCategory && matchesPrice && matchesAttributes;
    });
  }, [searchTerm, filters, initialProducts, attrFilters, attrMeta]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8" dir="rtl">

      {/* Sidebar: فیلترهای پیشرفته */}
      <aside className="w-full lg:w-1/4">
        <FilterSidebar
          initialProducts={initialProducts}
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
