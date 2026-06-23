'use client';

import { useState, useMemo, useEffect } from 'react';
import { FiSearch, FiShoppingBag, FiTag } from 'react-icons/fi';
import UsedProductCard from './UsedProductCard';
import UsedFilterSidebar from './UsedFilterSidebar';
import UsedQuickViewModal from './Usedquickviewmodal';
import PushOptInBanner from '@/components/features/push/PushOptInBanner';
import {
  buildAttributeMeta,
  parseAttrFiltersFromParams,
  writeAttrFiltersToParams,
  productMatchesAttrFilters,
} from '@/lib/attributeFilters';

const DEFAULT_FILTERS = {
  brands:      [],
  categories:  [],
  maxPrice:    50_000_000,
  scoreRange:  null,
  onlyInStock: false,
};

export default function UsedProductsPageClient({ products: initialProducts, headerImage, filterableAttributes = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters]       = useState(DEFAULT_FILTERS);

  // ── فیلترِ ویژگی/رنگِ دکمه‌ای (همان منطقِ مشترکِ فروشگاه) — مقادیر روی
  //    baseProduct ذخیره می‌شوند، پس متادیتا و تطبیق هم بر اساس baseProduct است. ──
  const attrMeta = useMemo(
    () => buildAttributeMeta(filterableAttributes, initialProducts.map(p => p.baseProduct || {})),
    [filterableAttributes, initialProducts],
  );
  const [attrFilters, setAttrFilters] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined' || attrMeta.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttrFilters(parseAttrFiltersFromParams(sp, attrMeta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrMeta.length]);

  const applyAttrFilters = (next) => {
    setAttrFilters(next);
    if (typeof window === 'undefined') return;
    const params = writeAttrFiltersToParams(new URLSearchParams(window.location.search), next, attrMeta);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  // ── QuickView ──
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen]         = useState(false);

  // ── Wishlist ──
  const [wishlist, setWishlist] = useState([]);

  const maxPrice = useMemo(
    () => Math.max(...initialProducts.map(p => p.price || 0), 50_000_000),
    [initialProducts]
  );

  const filteredProducts = useMemo(() => {
    return initialProducts.filter(product => {
      const name  = product.name || '';
      const brand = product.baseProduct?.brand;
      const cat   = product.baseProduct?.category;

      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBrand =
        filters.brands.length === 0 ||
        filters.brands.includes(brand?._id?.toString() || brand?.toString());

      const matchesCategory =
        filters.categories.length === 0 ||
        filters.categories.includes(cat?._id?.toString() || cat?.toString());

      const matchesPrice = product.price <= filters.maxPrice;

      const matchesScore =
        !filters.scoreRange ||
        (product.overallScore >= filters.scoreRange.min &&
         product.overallScore <= filters.scoreRange.max);

      const matchesAttributes = productMatchesAttrFilters(product.baseProduct || {}, attrFilters, attrMeta);

      return matchesSearch && matchesBrand && matchesCategory && matchesPrice && matchesScore && matchesAttributes;
    });
  }, [searchTerm, filters, initialProducts, attrFilters, attrMeta]);

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, maxPrice });

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeQuickView = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const toggleWishlist = (product) => {
    setWishlist(prev =>
      prev.includes(product._id)
        ? prev.filter(id => id !== product._id)
        : [...prev, product._id]
    );
  };

  return (
    <div className="bg-[#fcfcfc] min-h-screen" dir="rtl">

      {/* ─── بنرِ اجازهٔ نوتیفیکیشنِ محصولات دست‌دوم جدید ─── */}
      <PushOptInBanner />

      {/* ─── Hero ─── */}
      <div className="relative h-[120px] md:h-[220px] w-full overflow-hidden">
        <img
          src={headerImage || "/images/used-products-hero.jpg"}
          alt="بازار دست‌دوم"
          className="w-full h-full object-cover scale-105"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <span className="text-[var(--color-secondary)] font-bold mb-2 tracking-[0.2em] text-sm uppercase flex items-center gap-2">
            <FiTag size={14} /> بازار
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-xl">
            دست‌دوم
          </h1>
          <div className="w-16 h-1 bg-[var(--color-primary)] rounded-full mb-3" />
          <p className="text-gray-200 max-w-xl text-sm md:text-base font-medium leading-relaxed opacity-90">
            تجهیزات ورزشی کارکرده با کارت سلامت معتبر — با اطمینان بخر
          </p>
        </div>
      </div>

      {/* ─── بدنه اصلی ─── */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 flex flex-col lg:flex-row gap-8">

        {/* Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="sticky top-24">
            <UsedFilterSidebar
              products={initialProducts}
              filters={filters}
              setFilters={setFilters}
              attrMeta={attrMeta}
              attrFilters={attrFilters}
              setAttrFilters={applyAttrFilters}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="w-full lg:w-3/4">

          {/* نوار ابزار */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-[var(--radius)] border border-gray-100 shadow-sm">
            <div className="relative w-full md:w-2/3">
              <FiSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="جستجو در محصولات دست‌دوم..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-[var(--radius)] pr-11 pl-4 py-3 text-sm outline-none focus:ring-2 ring-[var(--color-primary)]/20 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
              <FiShoppingBag className="text-[var(--color-primary)]" />
              <span className="font-bold">تعداد کالا:</span>
              <span className="text-[var(--color-text)] font-bold">{filteredProducts.length}</span>
            </div>
          </div>

          {/* گرید */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <UsedProductCard
                  key={product._id}
                  product={product}
                  isWishlisted={wishlist.includes(product._id)}
                  onQuickView={() => openQuickView(product)}
                  onToggleWishlist={() => toggleWishlist(product)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-[var(--radius)] border-2 border-dashed border-gray-100">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShoppingBag size={40} className="text-gray-300" />
              </div>
              <p className="text-gray-400 font-bold text-xl">هیچ کالایی با این فیلترها مطابقت ندارد!</p>
              <button
                onClick={resetFilters}
                className="mt-4 text-[var(--color-primary)] font-bold underline text-sm"
              >
                پاک کردن تمام فیلترها
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ─── QuickView Modal ─── */}
      <UsedQuickViewModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={closeQuickView}
        isWishlisted={selectedProduct ? wishlist.includes(selectedProduct._id) : false}
        onToggleWishlist={() => selectedProduct && toggleWishlist(selectedProduct)}
      />
    </div>
  );
}