"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  FiSearch,
  FiShoppingCart,
  FiUser,
  FiX,
  FiChevronLeft,
} from "react-icons/fi";
import { HiOutlineViewGrid } from "react-icons/hi";
import Image from "next/image";
import Link from "next/link";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
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
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-all rounded-lg group"
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
        {product.mainImage ? (
          <img
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <FiSearch size={14} />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-white text-sm font-bold truncate group-hover:text-[#aa4725] transition-colors">
          {product.name}
        </span>
        {product.category?.title && (
          <span className="text-gray-400 text-xs truncate">
            {product.category.title}
          </span>
        )}
      </div>
    </Link>
  );
}

// ---- Mega Menu ----

function CategoryMenu({ navData, onClose }) {
  const [activeSportId, setActiveSportId] = useState(navData[0]?._id || null);

  // پیدا کردن ورزش فعال
  const activeSport =
    navData.find((s) => s._id === activeSportId) || navData[0];

  // State برای مدیریت دسته‌بندی فعال (جهت نمایش برندهای ستون سوم)
  const [activeCategoryId, setActiveCategoryId] = useState(
    activeSport?.categories?.[0]?._id || null,
  );

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

  // تابع کمکی برای استایل دکمه‌های لیست در هر سه ستون (سایز متن و پدینگ بزرگتر شد)
  const listButtonStyle = (isActive) => `
    group w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-[15px] font-medium
    ${
      isActive
        ? "bg-[#ffffff1a] text-[#aa4725]"
        : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[#aa4725]"
    }
  `;

  return (
    <div
      dir="rtl"
      className="absolute top-full right-0 mt-2 w-[950px] bg-[#20232ae6] border border-white/10 shadow-2xl rounded-[var(--radius)] overflow-hidden z-[100] text-right"
      onMouseLeave={onClose}
    >
      <div className="flex h-[480px]">
        {" "}
        {/* ارتفاع کمی بیشتر برای جای دادن متن‌های درشت‌تر */}
        {/* ستون اول: ورزش‌ها */}
        <div className="w-[30%] border-l border-white/[0.06] p-3 overflow-y-auto bg-white/[0.01]">
          <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
            رشته‌های ورزشی
          </p>
          <ul className="space-y-1">
            {navData.map((sport) => (
              <li key={sport._id}>
                <button
                  onClick={() =>
                    (window.location.href = `/sports/${sport.slug}`)
                  }
                  onMouseEnter={() => {
                    setActiveSportId(sport._id);
                    setActiveCategoryId(sport.categories?.[0]?._id); // ریست کردن کتگوری با تغییر ورزش
                  }}
                  className={listButtonStyle(activeSportId === sport._id)}
                >
                  {sport.icon && (
                    <div
                      style={iconMaskStyle(sport.icon)}
                      className="w-5 h-5 shrink-0"
                    />
                  )}
                  <span className="flex-grow text-right">{sport.title}</span>
                  <FiChevronLeft
                    size={16}
                    className={
                      activeSportId === sport._id ? "opacity-100" : "opacity-20"
                    }
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* ستون دوم: دسته‌بندی‌ها */}
        <div className="w-[35%] border-l border-white/[0.06] p-3 overflow-y-auto">
          <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
            دسته‌بندی‌ها
          </p>
          {activeSport?.categories?.length > 0 ? (
            <ul className="space-y-1">
              {activeSport.categories.map((cat) => (
                <li key={cat._id}>
                  <button
                    onMouseEnter={() => setActiveCategoryId(cat._id)}
                    onClick={() =>
                      (window.location.href = `/categories/${cat.slug}`)
                    }
                    className={listButtonStyle(activeCategoryId === cat._id)}
                  >
                    {cat.icon && (
                      <div
                        style={iconMaskStyle(cat.icon)}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="flex-grow text-right font-bold">
                      {cat.title}
                    </span>
                    <FiChevronLeft
                      size={16}
                      className={
                        activeCategoryId === cat._id
                          ? "opacity-100"
                          : "opacity-20"
                      }
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-600 text-[13px] p-4 text-center">
              موردی یافت نشد
            </div>
          )}
        </div>
        {/* ستون سوم: برندها */}
        <div className="flex-1 p-3 overflow-y-auto bg-white/[0.01]">
          <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
            برندهای مرتبط
          </p>
          {activeCategory?.brands?.length > 0 ? (
            <ul className="space-y-1">
              {activeCategory.brands.map((brand) => (
                <li key={brand._id}>
                  <a
                    href={`/brands/${brand.slug}`}
                    className={listButtonStyle(false)}
                  >
                    {brand.icon && (
                      <div
                        style={iconMaskStyle(brand.icon)}
                        className="w-5 h-5 shrink-0 opacity-70 group-hover:opacity-100"
                      />
                    )}
                    <span className="flex-grow text-right font-medium">
                      {brand.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-600 text-[13px] p-4 text-center">
              برندی یافت نشد
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main Navbar ----
export default function Navbar({ user }) {
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

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

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
        const res = await fetch(
          `/api/compare/search?q=${encodeURIComponent(value)}`,
        );
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
        onMouseLeave={() => setIsCategoryOpen(false)}
        className="fixed top-0 right-0 left-0 z-50 bg-[#20232ae6] border-b border-white/10 h-[75px]"
      >
        {/* ===== DESKTOP ===== */}
        <div className="hidden lg:block container mx-auto px-4 h-full">
          <div className="relative flex items-center justify-between h-full gap-6">
            <div className="flex items-center gap-5 flex-shrink-0">
              <div className="scale-75 origin-right">
                <Link href="/">
                  <Image
                    src="/logo/logo.svg"
                    alt="logo"
                    width={100}
                    height={100}
                  />
                </Link>
              </div>

              <div className="relative">
                <button
                  onMouseEnter={() => setIsCategoryOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#aa4725] text-white rounded-[var(--radius)] whitespace-nowrap text-sm hover:bg-[#aa4725]/90 transition-all"
                >
                  <HiOutlineViewGrid size={18} />
                  <span>دسته‌بندی محصولات</span>
                </button>

                {isCategoryOpen && navData.length > 0 && (
                  <CategoryMenu
                    navData={navData}
                    onClose={() => setIsCategoryOpen(false)}
                  />
                )}
              </div>

              {NAVIGATION_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="text-white hover:text-[#aa4725] transition-colors font-medium text-sm whitespace-nowrap"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Search */}
            <div className="flex-grow max-w-xl" ref={searchRef}>
              <div className="relative">
                <Input
                  className="rounded-[var(--radius)] bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  type="search"
                  placeholder="جستجو در محصولات..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() =>
                    searchQuery.length >= 2 && setShowSearchDropdown(true)
                  }
                  icon={<FiSearch size={18} className="text-white" />}
                />

                {showSearchDropdown && (
                  <div className="absolute top-full right-0 left-0 mt-2 bg-[#20232ae6] border border-white/10 rounded-[var(--radius)] shadow-2xl z-[200]">
                    {isSearching ? (
                      <p className="text-center text-gray-400 text-sm py-6">
                        در حال جستجو...
                      </p>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {searchResults.map((p) => (
                          <SearchResultItem
                            key={p._id}
                            product={p}
                            onClick={closeSearch}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 text-sm py-6">
                        محصولی یافت نشد
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* User + Cart */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {user ? (
                <Link href="/p-user">
                  <Button
                    className="flex items-center gap-1.5 rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    <FiUser size={15} />
                    <span>{firstName}</span>
                  </Button>
                </Link>
              ) : (
                <Link href="/login-register">
                  <Button
                    className="rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all"
                    variant="outline"
                    size="sm"
                  >
                    ورود | ثبت‌نام
                  </Button>
                </Link>
              )}

              <div
                id="cart-nav-icon"
                className="relative cursor-pointer"
                onClick={() => setOpenCart(true)}
              >
                <IconButton
                  className="bg-transparent border-white hover:bg-white text-white hover:text-black transition-all"
                  variant="outline"
                >
                  <FiShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#aa4725] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                      {cartCount}
                    </span>
                  )}
                </IconButton>
              </div>
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
                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 text-sm rounded-[var(--radius)] px-4 py-2.5 outline-none focus:border-[#aa4725]/60"
                />
                {showSearchDropdown && (
                  <div className="absolute top-full right-0 left-0 mt-2 bg-[#20232ae6] border border-white/10 rounded-[var(--radius)] shadow-2xl z-[200] max-h-[60vh] overflow-y-auto">
                    {isSearching ? (
                      <p className="text-center text-gray-400 text-sm py-5">
                        در حال جستجو...
                      </p>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-0.5">
                        {searchResults.map((p) => (
                          <SearchResultItem
                            key={p._id}
                            product={p}
                            onClick={closeSearch}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 text-sm py-5">
                        محصولی یافت نشد
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={closeSearch}
                className="text-white p-1 flex-shrink-0"
              >
                <FiX size={22} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              {/* سمت راست: دسته‌بندی (همبرگری) و لوگو */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="text-white p-1"
                >
                  {isCategoryOpen ? (
                    <FiX size={24} />
                  ) : (
                    <HiOutlineViewGrid size={24} />
                  )}
                </button>
                <Link href="/" className="flex-shrink-0">
                  <Image
                    src="/logo/logo.svg"
                    alt="logo"
                    width={45}
                    height={45}
                  />
                </Link>
              </div>

              {/* سمت چپ: جمعه بازار، سرچ و سبد خرید */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  href="/second-hands"
                  className="px-2.5 py-1 border border-[#aa4725] text-[#aa4725] rounded-[var(--radius)] text-[10px] font-bold bg-[#aa4725]/5 hover:bg-[#aa4725] hover:text-white transition-all whitespace-nowrap"
                >
                  جمعه بازار
                </Link>

                <button
                  onClick={() => setMobileSearchOpen(true)}
                  className="text-white"
                >
                  <FiSearch size={21} />
                </button>

                <div
                  className="relative cursor-pointer"
                  onClick={() => setOpenCart(true)}
                >
                  <FiShoppingCart size={21} className="text-white" />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#aa4725] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isCategoryOpen && (
            <>
              {/* Overlay تیره پشت منو */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
                onClick={() => setIsCategoryOpen(false)}
              />

              {/* محتوای منو که از راست باز می‌شود */}
              <div className="fixed top-0 right-0 h-full w-[280px] bg-[#1a1c22] z-[120] shadow-2xl transition-transform duration-300 overflow-y-auto">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#20232a]">
                  <span className="text-white font-bold">فهرست محصولات</span>
                  <button
                    onClick={() => setIsCategoryOpen(false)}
                    className="text-white"
                  >
                    <FiX size={24} />
                  </button>
                </div>

                <div className="py-2">
                  {/* بخش پروفایل سریع در منو */}
                  <div className="px-5 py-4 border-b border-white/5">
                    {user ? (
                      <Link
                        href="/p-user"
                        onClick={() => setIsCategoryOpen(false)}
                        className="flex items-center gap-3 text-white text-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#aa4725] flex items-center justify-center">
                          <FiUser />
                        </div>
                        <span>{firstName} خوش آمدی</span>
                      </Link>
                    ) : (
                      <Link
                        href="/login-register"
                        onClick={() => setIsCategoryOpen(false)}
                        className="text-[#aa4725] text-sm font-bold"
                      >
                        ورود یا ثبت‌نام
                      </Link>
                    )}
                  </div>

                  {/* لیست دسته‌بندی‌های آکاردئونی */}
                  {navData.map((sport) => (
                    <details
                      key={sport._id}
                      className="group border-b border-white/[0.03]"
                    >
                      <summary className="list-none flex items-center justify-between px-5 py-4 text-white cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          {sport.icon && (
                            <img
                              src={sport.icon}
                              alt=""
                              className="w-5 h-5 invert opacity-80"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {sport.title}
                          </span>
                        </div>
                        <FiChevronLeft className="group-open:-rotate-90 transition-transform text-gray-500" />
                      </summary>

                      <div className="bg-black/20 pb-2">
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
                              className="block px-12 py-2 text-gray-300 text-sm hover:text-white"
                              onClick={() => setIsCategoryOpen(false)}
                            >
                              {cat.title}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}

                  {/* لینک‌های ثابت */}
                  <div className="mt-4 px-5 space-y-4">
                    <Link
                      href="/second-hands"
                      className="block text-[var(--color-primary)] font-bold text-sm"
                      onClick={() => setIsCategoryOpen(false)}
                    >
                       جمعه بازار (کارکرده)
                    </Link>
                    <Link
                      href="/about-us"
                      className="block text-gray-400 text-sm"
                      onClick={() => setIsCategoryOpen(false)}
                    >
                      درباره تنادور
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>

      {!isHomePage && <div className="h-[75px]" />}
      <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />
    </>
  );
}
