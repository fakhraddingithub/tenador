"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  FiSearch,
  FiShoppingCart,
  FiX,
  FiChevronLeft,
  FiBell,
  FiMenu,
} from "react-icons/fi";
import { HiOutlineViewGrid } from "react-icons/hi";
import CartDrawer from "@/components/features/cartDrawer/CartDrawer";

const NAVIGATION_ITEMS = [
  { id: 1, label: "جمعه بازار", href: "/second-hands" },
];

// ---- Search Result Item ----
function SearchResultItem({ product, onClick }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-all rounded-lg group"
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
        {product.mainImage ? (
          <img src={product.mainImage} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <FiSearch size={14} />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-slate-800 text-sm font-bold truncate group-hover:text-[#aa4725] transition-colors">
          {product.name}
        </span>
        {product.category?.title && (
          <span className="text-slate-400 text-xs truncate">{product.category.title}</span>
        )}
      </div>
    </Link>
  );
}

// ---- Mega Menu ----
function CategoryMenu({ navData, onClose }) {
  const [activeSportId, setActiveSportId] = useState(navData[0]?._id || null);
  const activeSport = navData.find((s) => s._id === activeSportId) || navData[0];
  const [activeCategoryId, setActiveCategoryId] = useState(activeSport?.categories?.[0]?._id || null);
  const activeCategory =
    activeSport?.categories?.find((c) => c._id === activeCategoryId) ||
    activeSport?.categories?.[0];

  const iconMaskStyle = (url) => ({
    backgroundColor: "currentColor",
    maskImage: `url(${url})`,
    WebkitMaskImage: `url(${url})`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  });

  const listButtonStyle = (isActive) => `
    group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-[15px] font-medium
    ${isActive
      ? "bg-[#aa4725]/10 text-[#aa4725]"
      : "text-slate-600 hover:bg-slate-100 hover:text-[#aa4725]"
    }
  `;

  return (
    <div
      dir="rtl"
      className="w-[950px] bg-white border border-slate-200 shadow-2xl rounded-[var(--radius)] overflow-hidden z-[100] text-right"
    >
      <div className="flex h-[480px]">
        {/* ستون اول */}
        <div className="w-[30%] border-l border-slate-100 p-3 overflow-y-auto bg-slate-50/50">
          <p className="text-[11px] font-bold text-slate-400 mb-4 px-2 uppercase tracking-widest">
            رشته‌های ورزشی
          </p>
          <ul className="space-y-1">
            {navData.map((sport) => (
              <li key={sport._id}>
                <button
                  onClick={() => (window.location.href = `/${sport.slug}`)}
                  onMouseEnter={() => {
                    setActiveSportId(sport._id);
                    setActiveCategoryId(sport.categories?.[0]?._id);
                  }}
                  className={listButtonStyle(activeSportId === sport._id)}
                >
                  {sport.icon && <div style={iconMaskStyle(sport.icon)} className="w-5 h-5 shrink-0" />}
                  <span className="flex-grow text-right">{sport.title}</span>
                  <FiChevronLeft size={16} className={activeSportId === sport._id ? "opacity-100" : "opacity-20"} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ستون دوم */}
        <div className="w-[35%] border-l border-slate-100 p-3 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 mb-4 px-2 uppercase tracking-widest">
            دسته‌بندی‌ها
          </p>
          {activeSport?.categories?.length > 0 ? (
            <ul className="space-y-1">
              {activeSport.categories.map((cat) => (
                <li key={cat._id}>
                  <button
                    onMouseEnter={() => setActiveCategoryId(cat._id)}
                    onClick={() => (window.location.href = `/${activeSport.slug}/${cat.slug}`)}
                    className={listButtonStyle(activeCategoryId === cat._id)}
                  >
                    {cat.icon && <div style={iconMaskStyle(cat.icon)} className="w-5 h-5 shrink-0" />}
                    <span className="flex-grow text-right font-bold">{cat.title}</span>
                    <FiChevronLeft size={16} className={activeCategoryId === cat._id ? "opacity-100" : "opacity-20"} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-400 text-[13px] p-4 text-center">موردی یافت نشد</div>
          )}
        </div>

        {/* ستون سوم */}
        <div className="flex-1 p-3 overflow-y-auto bg-slate-50/50">
          <p className="text-[11px] font-bold text-slate-400 mb-4 px-2 uppercase tracking-widest">
            برندهای مرتبط
          </p>
          {activeCategory?.brands?.length > 0 ? (
            <ul className="space-y-1">
              {activeCategory.brands.map((brand) => (
                <li key={brand._id}>
                  <a href={`/${activeSport.slug}/${activeCategory.slug}/${brand.slug}`} className={listButtonStyle(false)}>
                    {brand.icon && (
                      <div style={iconMaskStyle(brand.icon)} className="w-5 h-5 shrink-0 opacity-70 group-hover:opacity-100" />
                    )}
                    <span className="flex-grow text-right font-medium">{brand.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-400 text-[13px] p-4 text-center">برندی یافت نشد</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Navbar ----
export default function Navbar({ user, isSidebarOpen, setIsSidebarOpen }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  const [cartCount, setCartCount] = useState(0);
  const [openCart, setOpenCart] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [navData, setNavData] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [notifCount] = useState(3);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const categoryRef = useRef(null);

  const firstName = user?.userName?.split(" ")[0] || "";

  useEffect(() => {
    const stored = localStorage.getItem("cart");
    const items = stored ? JSON.parse(stored) : [];
    setCartCount(items.reduce((sum, i) => sum + i.quantity, 0));
  }, [openCart]);

  useEffect(() => {
    fetch("/api/navbar")
      .then((r) => r.json())
      .then((data) => setNavData(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // بستن منوی دسته‌بندی با کلیک بیرون
  useEffect(() => {
    const handler = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = useCallback((value) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    setShowSearchDropdown(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/compare/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, []);

  const closeSearch = () => {
    setShowSearchDropdown(false);
    setSearchQuery("");
    setSearchResults([]);
    setMobileSearchOpen(false);
  };

  return (
    <>
      <nav
        dir="rtl"
        className="fixed top-0 right-0 left-0 z-50 bg-white border-b border-slate-200 shadow-sm h-[75px]"
      >
        {/* ===== DESKTOP ===== */}
        <div className="hidden lg:block container mx-auto px-4 h-full">
          <div className="relative flex items-center justify-between h-full gap-5">

            {/* ---- راست: لوگو + دسته‌بندی + ناوبری ---- */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <Link href="/" className="flex-shrink-0">
                <Image
                  src="/logo/logo.svg"
                  alt="logo"
                  width={160}
                  height={65}
                  className="w-auto h-[52px] object-contain transition-transform duration-300 hover:scale-105"
                />
              </Link>

              {/* دکمه دسته‌بندی */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setIsCategoryOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#aa4725] text-white rounded-[var(--radius)] whitespace-nowrap text-sm hover:bg-[#aa4725]/90 transition-all"
                >
                  <HiOutlineViewGrid size={18} />
                  <span>دسته‌بندی محصولات</span>
                </button>

                {isCategoryOpen && navData.length > 0 && (
                  <div className="absolute top-full right-0 pt-2">
                    <CategoryMenu navData={navData} onClose={() => setIsCategoryOpen(false)} />
                  </div>
                )}
              </div>

              {NAVIGATION_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="text-slate-600 hover:text-[#aa4725] transition-colors font-medium text-sm whitespace-nowrap"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* ---- وسط: سرچ ---- */}
            <div className="flex-grow max-w-xl" ref={searchRef}>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                  <FiSearch size={17} />
                </span>
                <input
                  type="search"
                  placeholder="جستجو در محصولات..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-800 placeholder:text-slate-400 text-sm rounded-[var(--radius)] pr-10 pl-4 py-2.5 outline-none focus:border-[#aa4725]/40 focus:bg-white focus:ring-2 focus:ring-[#aa4725]/10 transition-all"
                />

                {showSearchDropdown && (
                  <div className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-200 rounded-[var(--radius)] shadow-xl z-[200]">
                    {isSearching ? (
                      <p className="text-center text-slate-400 text-sm py-6">در حال جستجو...</p>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {searchResults.map((p) => (
                          <SearchResultItem key={p._id} product={p} onClick={closeSearch} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 text-sm py-6">محصولی یافت نشد</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ---- چپ: نوتیفیکیشن + کاربر + سبد خرید ---- */}
            <div className="flex items-center gap-3 flex-shrink-0">

              {/* نوتیفیکیشن */}
              <button className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius)] bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                <FiBell size={17} />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -left-1 bg-[#ffbf00] text-black text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {notifCount}
                  </span>
                )}
              </button>

              {/* جداکننده */}
              <div className="w-px h-8 bg-slate-200" />

              {/* کاربر — فقط نام، بدون دکمه ورود/ثبت‌نام */}
              {firstName && (
                <Link href="/p-user">
                  <div className="flex items-center gap-2.5 group cursor-pointer">
                    <div className="hidden flex-col text-right leading-none sm:flex">
                      <span className="text-[11px] text-slate-400 mb-0.5">خوش آمدید</span>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-[#aa4725] transition-colors">
                        {firstName}
                      </span>
                    </div>
                    <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius)] bg-slate-100 border border-slate-200 text-slate-600 group-hover:border-[#aa4725]/40 group-hover:text-[#aa4725] transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  </div>
                </Link>
              )}

              {/* سبد خرید */}
              <button
                onClick={() => setOpenCart(true)}
                className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius)] border border-slate-200 bg-white text-slate-600 hover:bg-[#aa4725] hover:text-white hover:border-[#aa4725] transition-all"
              >
                <FiShoppingCart size={17} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#aa4725] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {cartCount}
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* ===== MOBILE ===== */}
        <div className="lg:hidden flex items-center h-full container mx-auto px-4">
          {mobileSearchOpen ? (
            <div className="flex items-center gap-2 w-full" ref={searchRef}>
              <div className="flex-grow relative">
                <input
                  autoFocus
                  type="search"
                  placeholder="جستجو در محصولات..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 text-slate-800 placeholder:text-slate-400 text-sm rounded-[var(--radius)] px-4 py-2.5 outline-none focus:border-[#aa4725]/40"
                />
                {showSearchDropdown && (
                  <div className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-200 rounded-[var(--radius)] shadow-xl z-[200] max-h-[60vh] overflow-y-auto">
                    {isSearching ? (
                      <p className="text-center text-slate-400 text-sm py-5">در حال جستجو...</p>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {searchResults.map((p) => (
                          <SearchResultItem key={p._id} product={p} onClick={closeSearch} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 text-sm py-5">محصولی یافت نشد</p>
                    )}
                  </div>
                )}
              </div>
              <button onClick={closeSearch} className="text-slate-500 p-1 flex-shrink-0">
                <FiX size={22} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {/* راست: sidebar toggle (اگر وجود داشته باشد) + دکمه دسته‌بندی + لوگو */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {setIsSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-slate-600 p-1"
                  >
                    <FiMenu size={22} />
                  </button>
                )}
                <button
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="text-slate-600 p-1"
                >
                  {isCategoryOpen ? <FiX size={24} /> : <HiOutlineViewGrid size={24} />}
                </button>
                <Link href="/" className="flex-shrink-0">
                  <Image
                    src="/logo/logo.svg"
                    alt="logo"
                    width={100}
                    height={45}
                    className="w-auto h-[42px] object-contain"
                  />
                </Link>
              </div>

              {/* چپ: نوتیفیکیشن + کاربر + سرچ + سبد */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button className="relative text-slate-600">
                  <FiBell size={20} />
                  {notifCount > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 bg-[#ffbf00] text-black text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">
                      {notifCount}
                    </span>
                  )}
                </button>

                {firstName && (
                  <Link
                    href="/p-user"
                    className="flex items-center gap-1.5 rounded-[var(--radius)] text-slate-600 border border-slate-200 px-2.5 py-1.5 hover:text-[#aa4725] hover:border-[#aa4725]/30 transition-colors text-xs"
                  >
                    <span className="font-bold">{firstName}</span>
                  </Link>
                )}

                <button onClick={() => setMobileSearchOpen(true)} className="text-slate-600">
                  <FiSearch size={20} />
                </button>

                <button
                  onClick={() => setOpenCart(true)}
                  className="relative text-slate-600"
                >
                  <FiShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#aa4725] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* منوی دسته‌بندی موبایل — خارج از nav، z-index بالاتر از navbar */}
      {isCategoryOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            onClick={() => setIsCategoryOpen(false)}
          />
          <div
            dir="rtl"
            className="fixed top-0 right-0 h-full w-[280px] bg-white z-[120] shadow-2xl overflow-y-auto"
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="text-slate-800 font-bold">فهرست محصولات</span>
              <button onClick={() => setIsCategoryOpen(false)} className="text-slate-500">
                <FiX size={24} />
              </button>
            </div>

            <div className="py-2">
              {navData.map((sport) => (
                <details key={sport._id} className="group border-b border-slate-100">
                  <summary className="list-none flex items-center justify-between px-5 py-4 text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {sport.icon && (
                        <img src={sport.icon} alt="" className="w-5 h-5 opacity-60" />
                      )}
                      <span className="text-sm font-medium">{sport.title}</span>
                    </div>
                    <FiChevronLeft className="group-open:-rotate-90 transition-transform text-slate-400" />
                  </summary>

                  <div className="bg-slate-50/50 pb-2">
                    <Link
                      href={`/category/${sport.slug}`}
                      className="block px-12 py-2 text-xs text-[#aa4725] font-bold"
                      onClick={() => setIsCategoryOpen(false)}
                    >
                      مشاهده صفحه {sport.title}
                    </Link>
                    {sport.categories?.map((cat) => (
                      <div key={cat._id}>
                        <Link
                          href={`/category/${sport.slug}/${cat.slug}`}
                          className="block px-12 py-2 text-slate-600 text-sm hover:text-[#aa4725]"
                          onClick={() => setIsCategoryOpen(false)}
                        >
                          {cat.title}
                        </Link>
                      </div>
                    ))}
                  </div>
                </details>
              ))}

              {/* کارت جمعه بازار */}
              <div className="px-4 py-4 border-t border-slate-100 mt-2">
                <Link
                  href="/second-hands"
                  onClick={() => setIsCategoryOpen(false)}
                  className="group relative flex items-center justify-between p-4 bg-gradient-to-l from-[#aa4725]/10 to-[#aa4725]/5 border border-[#aa4725]/20 rounded-[6px] overflow-hidden transition-all duration-300 hover:border-[#aa4725]/50 hover:shadow-[0_4px_15px_rgba(170,71,37,0.1)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#aa4725]/10 to-transparent translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                  <div className="relative z-10 flex flex-col gap-1.5">
                    <span className="text-[#aa4725] text-[15px] font-bold tracking-wide">جمعه بازار</span>
                    <span className="text-slate-400 text-[11px] font-medium leading-tight">دست‌دوم‌های با ارزش و اقتصادی</span>
                  </div>
                  <div className="relative z-10 w-9 h-9 rounded-[6px] bg-[#aa4725]/10 flex items-center justify-center text-[#aa4725] group-hover:scale-110 group-hover:bg-[#aa4725] group-hover:text-white transition-all duration-300">
                    <FiShoppingCart size={16} />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {!isHomePage && <div className="h-[75px]" />}

      <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />
    </>
  );
}