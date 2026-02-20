'use client';

import { useState, useMemo } from "react";
import ProductList from "@/components/templates/products/ProductList";
import FilterSidebar from "@/components/templates/products/FilterSidebar";
import SearchBar from "@/components/templates/products/SearchBar";
import { FiShoppingBag } from "react-icons/fi";

export default function SportPageClient({ products: initialProducts, sportInfo }) {
  // مقدار اولیه فیلترها (بدون فیلتر ورزش)
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    brands: [],
    categories: [],
    minPrice: 0,
    maxPrice: 50000000,
    onlyInStock: false,
  });

  // منطق فیلترینگ (حذف فیلتر ورزش چون اینجا صفحه اختصاصی یک ورزش است)
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBrand = filters.brands.length === 0 || 
                           filters.brands.includes(product.brand?._id?.toString() || product.brand?.toString());
  
      const matchesCategory = filters.categories.length === 0 || 
                              filters.categories.includes(product.category?._id?.toString() || product.category?.toString());
  
      const matchesPrice = product.basePrice >= filters.minPrice && product.basePrice <= filters.maxPrice;
  
      const matchesStock = !filters.onlyInStock || product.stock > 0;
  
      return matchesSearch && matchesBrand && matchesCategory && matchesPrice && matchesStock;
    });
  }, [searchTerm, filters, initialProducts]);

  return (
    <div className="bg-[#fcfcfc] min-h-screen" dir="rtl">
      
      {/* --- هدر اختصاصی ورزش (Sport Hero) --- */}
      <div className="relative h-[100px] md:h-[200px] w-full overflow-hidden">
        {/* تصویر پس‌زمینه با افکت پارالاکس ملایم */}
        <img 
          src={sportInfo.image || "/images/default-sport.jpg"} 
          alt={sportInfo.name}
          className="w-full h-full object-cover scale-105"
        />
        {/* لایه گرادینت برای خوانایی متن */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        
        {/* محتوای هدر */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <span className="text-[var(--color-secondary)] font-bold mb-2 tracking-[0.2em] text-sm md:text-base uppercase">
            تجهیزات تخصصی رشته
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-xl">
            {sportInfo.title}
          </h1>
          <div className="w-20 h-1 bg-[var(--color-primary)] rounded-full mb-4"></div>
          <p className="text-gray-200 max-w-2xl text-sm md:text-lg font-medium leading-relaxed opacity-90 line-clamp-2">
            {sportInfo.description}
          </p>
        </div>
      </div>

      {/* --- بخش محصولات و فیلترها --- */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar: فیلترها (باید در کامپوننت FilterSidebar منطق حذف فیلتر ورزش را هم اعمال کنید) */}
        <aside className="w-full lg:w-1/4">
          <div className="sticky top-24">
            <FilterSidebar 
              initialProducts={initialProducts} 
              filters={filters} 
              setFilters={setFilters} 
              hideSportFilter={true} // پاس دادن یک پروپ برای مخفی سازی داینامیک
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="w-full lg:w-3/4">
          {/* نوار ابزار بالای لیست */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-5 rounded-[var(--radius)] border border-gray-100 shadow-sm">
            <div className="w-full md:w-2/3">
              <SearchBar value={searchTerm} onChange={setSearchTerm} />
            </div>
            <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
               <FiShoppingBag className="text-[var(--color-primary)]" />
               <span className="font-bold">تعداد کالا:</span>
               <span className="text-[var(--color-text)] font-bold">{filteredProducts.length}</span>
            </div>
          </div>

          {/* لیست محصولات */}
          {filteredProducts.length > 0 ? (
            <ProductList
              products={filteredProducts}
              onAddToCart={(p) => console.log("Added", p)}
              onToggleWishlist={(p) => console.log("Wishlist", p)}
            />
          ) : (
            <div className="text-center py-24 bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-100">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <FiShoppingBag size={40} className="text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold text-xl">هیچ کالایی با این فیلترها مطابقت ندارد!</p>
              <button 
                onClick={() => setFilters({ brands: [], categories: [], minPrice: 0, maxPrice: 50000000, onlyInStock: false })}
                className="mt-4 text-[var(--color-primary)] font-bold underline"
              >
                پاک کردن تمام فیلترها
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}