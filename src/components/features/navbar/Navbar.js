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
import { useUser } from "@/components/features/auth/UserContext";

const NAVIGATION_ITEMS = [
  { id: 1, label: "جمعه بازار", href: "/second-hand" },
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

  // تابع کمکی برای استایل دکمه‌های لیست در هر سه ستون
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
        {/* ستون اول: ورزش‌ها */}
        <div className="w-[30%] border-l border-white/[0.06] p-3 overflow-y-auto bg-white/[0.01]">
          <p className="text-[11px] font-bold text-gray-500 mb-4 px-2 uppercase tracking-widest">
            رشته‌های ورزشی
          </p>
          <ul className="space-y-1">
            {navData.map((sport) => (
              <li key={sport._id}>
                <Link
                  href={`/${sport.slug}`}
                  prefetch
                  onClick={onClose}
                  onMouseEnter={() => {
                    setActiveSportId(sport._id);
                    setActiveCategoryId(sport.categories?.[0]?._id);
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
                </Link>
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
                  <Link
                    href={`/${activeSport.slug}/${cat.slug}`}
                    prefetch
                    onClick={onClose}
                    onMouseEnter={() => setActiveCategoryId(cat._id)}
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
                  </Link>
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
                  <Link
                    href={`/${activeSport.slug}/${activeCategory.slug}/${brand.slug}`}
                    prefetch
                    onClick={onClose}
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
                  </Link>
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
export default function Navbar({ navData: initialNavData = [] }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // وضعیت کاربر از جزیره‌ی کلاینت (به‌جای prop سروری) خوانده می‌شود
  const { user } = useUser();

  const [cartCount, setCartCount] = useState(0);
  const [openCart, setOpenCart] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const navData = Array.isArray(initialNavData) ? initialNavData : [];

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const firstName =
    (user?.name || user?.userName)?.split(" ")[0] || "";

 // تابع کمکی برای خواندن تعداد آیتم‌ها از LocalStorage
const updateCartCount = () => {
  const stored = localStorage.getItem("cart");
  const items = stored ? JSON.parse(stored) : [];
  setCartCount(items.reduce((sum, i) => sum + i.quantity, 0));
};

// ۱. اجرای اولیه و گوش دادن به تغییرات سبد خرید
useEffect(() => {
  updateCartCount(); // خواندن مقدار اولیه هنگام لود صفحه

  // گوش دادن به رویداد سفارشی برای تغییرات سبد خرید در همان صفحه
  window.addEventListener("cart-changed", updateCartCount);
  
  // گوش دادن به رویداد استاندار برای زمان‌هایی که در تپ‌های دیگر تغییر ایجاد می‌شود
  window.addEventListener("storage", updateCartCount);

  return () => {
    window.removeEventListener("cart-changed", updateCartCount);
    window.removeEventListener("storage", updateCartCount);
  };
}, []);

// ۲. این یوزافکت را هم برای زمانی که دراور باز/بسته می‌شود حفظ کنید (جهت اطمینان بیشتر)
useEffect(() => {
  updateCartCount();
}, [openCart]);

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
              <div className="origin-right flex-shrink-0">
                <Link href="/">
                  <Image
                    src="/logo/logo.svg"
                    alt="logo"
                    width={160}
                    height={65}
                    className="w-auto h-[55px] object-contain transition-transform duration-300 hover:scale-105"
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
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch
                  className="text-white hover:text-[#aa4725] transition-colors font-medium text-sm whitespace-nowrap"
                >
                  {item.label}
                </Link>
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
                    width={100}
                    height={45}
                    className="w-auto h-[45px] object-contain"
                  />
                </Link>
              </div>

              {/* سمت چپ: یوزر، سرچ و سبد خرید */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* دکمه ورود یا پروفایل کاربر در نوبار (جابجا شده از منو به سمت راست سرچ) */}
                {user ? (
                  <Link
                    href="/p-user"
                    className="rounded-[var(--radius)] text-white border border-white px-3 py-2 flex items-center gap-1.5 justify-center hover:text-[#aa4725] transition-colors text-sm"
                  >
                    <span className="font-medium">{firstName}</span>
                    <FiUser size={21} />
                  </Link>
                ) : (
                  <Link
                    href="/login-register"
                    className="text-white text-[11px] font-bold border border-white/20 px-2.5 py-1 rounded-[6px] hover:bg-white hover:text-black transition-all"
                  >
                    ورود
                  </Link>
                )}

                <button
                  onClick={() => setMobileSearchOpen(true)}
                  className="text-white flex items-center justify-center"
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

                  {/* کارت افقی مدرن جمعه بازار (منتقل شده به انتهای منو) */}
                  <div className="px-4 py-4 border-t border-white/5 mt-2">
                    <Link
                      href="/second-hand"
                      onClick={() => setIsCategoryOpen(false)}
                      className="group relative flex items-center justify-between p-4 bg-gradient-to-l from-[#aa4725]/15 to-[#aa4725]/5 border border-[#aa4725]/30 rounded-[6px] overflow-hidden transition-all duration-300 hover:border-[#aa4725]/70 hover:shadow-[0_4px_15px_rgba(170,71,37,0.15)]"
                    >
                      {/* پس‌زمینه هاور */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#aa4725]/20 to-transparent translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />

                      <div className="relative z-10 flex flex-col gap-1.5">
                        <span className="text-[#aa4725] text-[15px] font-bold tracking-wide">
                          جمعه بازار
                        </span>
                        <span className="text-gray-400 text-[11px] font-medium leading-tight">
                          دست‌دوم‌های با ارزش و اقتصادی
                        </span>
                      </div>

                      <div className="relative z-10 w-9 h-9 rounded-[6px] bg-[#aa4725]/20 flex items-center justify-center text-[#aa4725] group-hover:scale-110 group-hover:bg-[#aa4725] group-hover:text-white transition-all duration-300">
                        <FiShoppingCart size={16} />
                      </div>
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
