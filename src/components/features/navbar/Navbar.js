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
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineViewGrid } from "react-icons/hi";
import Image from "next/image";
import Link from "next/link";
import Input from "@/components/ui/Input";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
import CartDrawer from "@/components/features/cartDrawer/CartDrawer";
import UserNotificationBell from "@/components/features/notifications/UserNotificationBell";
import { useUser } from "@/components/features/auth/UserContext";
import { getCartTotalQuantity } from "@/lib/cart";
import MegamenuInteractiveColumns from "@/components/features/navbar/MegamenuInteractiveColumns";

const NAVIGATION_ITEMS = [
  { id: 1, label: "جمعه بازار", href: "/second-hand" },
];

// آیکون برند/دسته را به صورت ماسک با رنگ متن (سفید) نمایش می‌دهد
const iconMaskStyle = (url) => ({
  backgroundColor: "currentColor",
  maskImage: `url(${url})`,
  WebkitMaskImage: `url(${url})`,
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskSize: "contain",
  WebkitMaskSize: "contain",
});

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

  // تابع کمکی برای استایل دکمه‌های لیست در ستون اول (ورزش‌ها)
  const listButtonStyle = (isActive) => `
    group w-full flex items-center gap-3 px-4 py-2.5 rounded-[6px] transition-all text-[15px] font-medium
    ${
      isActive
        ? "bg-[#ffffff1a] text-[#aa4725]"
        : "text-gray-300 hover:bg-[#ffffff1a] hover:text-[#aa4725]"
    }
  `;

  return (
    <div
      dir="rtl"
      className="absolute top-full right-0 mt-2 w-[950px] bg-[#20232ae6] border border-white/10 shadow-2xl rounded-[6px] overflow-hidden z-[100] text-right"
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
                  onMouseEnter={() => setActiveSportId(sport._id)}
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
        {/* ستون‌های دوم/سوم/چهارم: درختِ دسته‌ها + نوار جنسیت + برندها
            (کامپوننتِ کلاینتِ ایزوله — state تعاملیِ جنسیت آنجا نگه‌داری می‌شود) */}
        <MegamenuInteractiveColumns sport={activeSport} onClose={onClose} />
      </div>
    </div>
  );
}

// ---- Mobile Two-Pane Master-Detail Category Drawer ----
// چیدمانِ موبایل‌نیتیوِ دو-پنلی (الگوی دیجی‌کالا/آمازون):
//   سقف (۱۰۰٪): تب‌های ورزش + نوارِ فیلترِ ویژگیِ دسته‌ی فعال (پویا)
//   بدنه: پنل A (راست، ۴۰٪) لیستِ دسته‌ها (مَستر) | پنل B (چپ، ۶۰٪) برندها (دیتیل)
// هر دو پنل اسکرولِ مستقل دارند؛ ارتفاعِ بدنه به فضای باقی‌مانده‌ی زیرِ سقف مقید است.
function MobileCategoryDrawer({ navData, onClose }) {
  // ورزشِ فعال (تب‌های سقف) — پیش‌فرض اولین ورزش
  const [activeSportId, setActiveSportId] = useState(navData[0]?._id || null);
  // مقدارِ فعالِ فیلتر (مخصوصِ دسته‌ی فعال)؛ کلیکِ دوباره خاموش می‌کند
  const [activeFilterValue, setActiveFilterValue] = useState(null);
  // دسته‌ی فعال (مَسترِ پنل A) که محتوای پنل B را هدایت می‌کند
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const toggleFilterValue = (v) =>
    setActiveFilterValue((prev) => (prev === v ? null : v));

  // سوییچِ ورزش → ریستِ دسته‌ی فعال تا Auto-Mount اولین دسته‌ی ورزشِ جدید را انتخاب کند
  const selectSport = (id) => {
    setActiveSportId(id);
    setActiveCategoryId(null);
  };

  const activeSport =
    navData.find((s) => s._id === activeSportId) || navData[0] || null;

  // ── درختِ دسته‌ها: فقط دسته‌های والد در مَستر (پنل A) ──
  const categories = activeSport?.categories || [];
  const catIdSet = new Set(categories.map((c) => c._id));
  const rootCategories = categories.filter(
    (c) => !c.parent || !catIdSet.has(c.parent),
  );

  // Auto-Mount: اگر دسته‌ی فعال معتبر نباشد، اولین دسته انتخاب می‌شود تا پنل B هرگز خالی نماند
  const effectiveCatId = rootCategories.some((c) => c._id === activeCategoryId)
    ? activeCategoryId
    : rootCategories[0]?._id || null;
  const activeCategory =
    rootCategories.find((c) => c._id === effectiveCatId) || null;

  // ── فیلترِ ویژگیِ دسته‌ی فعال (پویا) — همان داده‌ی مگامنوی دسکتاپ از navbarService ──
  const megaMenuFilter = activeCategory?.megaMenuFilter || null;
  // مقدار فقط وقتی اعمال می‌شود که جزوِ مقادیرِ همین دسته باشد (با تعویضِ دسته نادیده می‌شود)
  const appliedValue =
    megaMenuFilter && (megaMenuFilter.values || []).includes(activeFilterValue)
      ? activeFilterValue
      : null;

  // موتورِ وراثتِ URL — اگر مقداری فعال باشد ?[attrName]=<value> افزوده می‌شود
  const withFilter = (href) =>
    appliedValue
      ? `${href}?${encodeURIComponent(megaMenuFilter.name)}=${encodeURIComponent(appliedValue)}`
      : href;

  // ── برندهای پنل B: عضویت از دسته‌ی فعال (از روی محصول)، فیلترشده با مقدارِ فعال ──
  const categoryBrands = activeCategory?.brands || [];
  const visibleBrands = appliedValue
    ? categoryBrands.filter((b) =>
        (b.filterValues || []).includes(appliedValue),
      )
    : categoryBrands;

  return (
    <>
      {/* Overlay تیره پشت منو (Framer — دست‌نخورده) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
        onClick={onClose}
      />

      {/* پنل کشویی از سمت راست (Framer slide-in — دست‌نخورده) */}
      <motion.div
        dir="rtl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-[#1a1c22] z-[120] shadow-2xl flex flex-col"
      >
        {/* ───────── سقف: عنوان + بستن ───────── */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#20232a] flex-shrink-0">
          <span className="text-white font-bold text-sm truncate">
            دسته‌بندی محصولات
          </span>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="text-white flex-shrink-0"
          >
            <FiX size={22} />
          </button>
        </div>

        {/* ───────── سقف: تب‌های ورزش (اسکرولِ افقی) ───────── */}
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-white/10 flex-shrink-0">
          {navData.map((sport) => {
            const isActive = sport._id === activeSportId;
            return (
              <button
                key={sport._id}
                onClick={() => selectSport(sport._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-[#aa4725] text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {sport.icon && (
                  <img
                    src={sport.icon}
                    alt=""
                    className="w-4 h-4 invert opacity-90"
                  />
                )}
                {sport.title}
              </button>
            );
          })}
        </div>

        {/* ───────── سقف: نوارِ فیلترِ ویژگیِ دسته‌ی فعال (پویا — فقط اگر دسته فیلتر داشته باشد) ───────── */}
        {megaMenuFilter && megaMenuFilter.values.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 flex-shrink-0 overflow-x-auto">
            <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap flex-shrink-0">
              {megaMenuFilter.label}:
            </span>
            {megaMenuFilter.values.map((value) => {
              const isActive = appliedValue === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleFilterValue(value)}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                    isActive
                      ? "bg-[#aa4725] text-white"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-[#aa4725]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        )}

        {/* ───────── بدنه: دو پنلِ ۴۰/۶۰ با اسکرولِ مستقل (ارتفاعِ مقید به فضای زیرِ سقف) ───────── */}
        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
          {/* PANE A — مَستر/دسته‌ها (در RTL سمت راست) — ۴۰٪ */}
          <div className="w-[40%] flex-shrink-0 overflow-y-auto border-l border-white/10">
            {rootCategories.length > 0 ? (
              rootCategories.map((cat) => {
                const isActive = cat._id === effectiveCatId;
                return (
                  <button
                    key={cat._id}
                    onClick={() => setActiveCategoryId(cat._id)}
                    className={`w-full text-right px-3 py-3 flex items-center gap-2 border-b border-white/[0.04] transition-colors ${
                      isActive
                        ? "bg-white/5 text-white font-medium border-r-2 border-r-[#aa4725]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.03] border-r-2 border-r-transparent"
                    }`}
                  >
                    {cat.icon && (
                      <img
                        src={cat.icon}
                        alt=""
                        className="w-4 h-4 invert opacity-80 flex-shrink-0"
                      />
                    )}
                    <span className="text-xs leading-tight truncate">
                      {cat.title}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-gray-500 text-[12px] p-4 text-center">
                موردی یافت نشد
              </p>
            )}
          </div>

          {/* PANE B — دیتیل/برندها (در RTL سمت چپ) — ۶۰٪ */}
          <div className="w-[60%] flex-1 overflow-y-auto p-2 bg-black/20">
            {/* لینکِ مشاهده‌ی صفحه‌ی دسته‌ی فعال */}
            {activeCategory && (
              <Link
                href={withFilter(`/${activeSport.slug}/${activeCategory.slug}`)}
                onClick={onClose}
                className="block px-2 py-2 mb-1 text-[11px] font-bold text-[#aa4725] truncate"
              >
                مشاهده‌ی همه‌ی {activeCategory.title}
              </Link>
            )}

            {visibleBrands.length > 0 ? (
              visibleBrands.map((brand) => (
                <div key={brand._id} className="mb-2">
                  {/* برند = در کانتکستِ دسته → /[sport]/[category]/[brand] (الگوی ۵) */}
                  <Link
                    href={withFilter(
                      `/${activeSport.slug}/${activeCategory.slug}/${brand.slug}`,
                    )}
                    onClick={onClose}
                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-white/5 transition-colors min-w-0"
                  >
                    {brand.icon && (
                      <div
                        style={iconMaskStyle(brand.icon)}
                        className="w-4 h-4 text-white opacity-80 flex-shrink-0"
                      />
                    )}
                    <span className="text-xs font-bold text-white truncate">
                      {brand.title}
                    </span>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-[12px] p-4 text-center">
                برندی یافت نشد
              </p>
            )}
          </div>
        </div>

        {/* ───────── فوتر: جمعه بازار ───────── */}
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          <Link
            href="/second-hand"
            onClick={onClose}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[6px] bg-gradient-to-l from-[#aa4725]/15 to-[#aa4725]/5 border border-[#aa4725]/30 hover:border-[#aa4725]/70 transition-all"
          >
            <span className="text-[#aa4725] text-xs font-bold">جمعه بازار</span>
            <FiShoppingCart size={15} className="text-[#aa4725]" />
          </Link>
        </div>
      </motion.div>
    </>
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

 // تعداد آیتم‌ها همیشه از منبع واحد (getCart نرمال‌شده) خوانده می‌شود
 // تا بج دقیقاً با محتوای سبد یکسان بماند.
const updateCartCount = () => {
  setCartCount(getCartTotalQuantity());
};

// ۱. اجرای اولیه و گوش دادن به تغییرات سبد خرید
useEffect(() => {
  updateCartCount(); // خواندن مقدار اولیه هنگام لود صفحه

  // گوش دادن به رویدادهای سفارشی تغییر سبد در همان صفحه
  window.addEventListener("cart-changed", updateCartCount);
  window.addEventListener("cartchange", updateCartCount);

  // گوش دادن به رویداد استاندارد storage برای تغییرات در تب‌های دیگر
  window.addEventListener("storage", updateCartCount);

  return () => {
    window.removeEventListener("cart-changed", updateCartCount);
    window.removeEventListener("cartchange", updateCartCount);
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

              {user && <UserNotificationBell />}

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

                {user && <UserNotificationBell />}

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

          {/* منوی کشویی چندسطحی موبایل (با باز/بسته شدن دوباره، به سطح ۱ ریست می‌شود) */}
          <AnimatePresence>
            {isCategoryOpen && (
              <MobileCategoryDrawer
                key="mobile-cat-drawer"
                navData={navData}
                onClose={() => setIsCategoryOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </nav>

      {!isHomePage && <div className="h-[75px]" />}
      <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />
    </>
  );
}
