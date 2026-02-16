'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation'
import { FiSearch, FiShoppingCart, FiUser } from 'react-icons/fi';
import { HiOutlineViewGrid } from 'react-icons/hi';
import Input from '@/components/ui/Input';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import { SPORTS_CATEGORIES, BRANDS, NAVIGATION_ITEMS } from '@/lib/constants';
import Image from 'next/image';
import Link from 'next/link';
import CartDrawer from '@/components/features/cartDrawer/CartDrawer';

export default function Navbar({ user }) {
  const [isLoggedIn, setIsLoggedIn] = useState(user);
  const [cartCount, setCartCount] = useState(3);
  const [openCart, setOpenCart] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [hoveredSport, setHoveredSport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    const items = stored ? JSON.parse(stored) : []
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    setCartCount(totalItems)
  }, [openCart])

  const pathname = usePathname()
  const isHomePage = pathname === '/'

  return (
    <>
      <nav className={`fixed top-0 right-0 left-0 z-50 bg-gradient-to-b from-[#fff] to-[#aa4725]/30 backdrop-blur-md border-b border-[#aa4725]/80 transition-all duration-500 ease-in-out ${
        isScrolled ? 'h-[75px]' : 'h-[145px]'
      }`}>
        <div className="hidden lg:block container mx-auto px-4 h-full">
          <div className="relative flex items-center justify-between h-full">
            
            {/* بخش راست: لوگو + دسته‌بندی و منوها (که بین دو حالت جابجا می‌شوند) */}
            <div className="flex items-center gap-6">
              {/* لوگو */}
              <div className={`transition-all duration-500 ${isScrolled ? 'scale-75' : 'scale-100 pb-10'}`}>
                <Link href="/">
                  <Image src="/logo/logo.svg" alt="logo" width={100} height={100} />
                </Link>
              </div>

              {/* کانتینر دسته‌بندی و لینک‌ها - بدون گذاشتن جای خالی */}
              <div className={`flex items-center gap-4 transition-all duration-500 ease-in-out ${
                isScrolled 
                ? 'opacity-100 translate-y-0 relative' 
                : 'opacity-100 translate-y-[45px] absolute right-4' 
              }`}>
                {/* دکمه دسته‌بندی محصولات */}
                <div className="relative group">
                  <button
                    onMouseEnter={() => setIsCategoryOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#aa4725] text-white rounded-[var(--radius)] whitespace-nowrap text-sm hover:bg-[#aa4725]/90 transition-all"
                  >
                    <HiOutlineViewGrid size={20} />
                    <span>دسته‌بندی محصولات</span>
                  </button>

                  {/* دراپ‌داون کامل دسته‌بندی */}
                  {isCategoryOpen && (
                    <div 
                      className="absolute top-full right-0 mt-2 w-[600px] bg-white border border-black/10 shadow-2xl rounded-[var(--radius)] overflow-hidden z-[100]"
                      onMouseLeave={() => { setIsCategoryOpen(false); setHoveredSport(null); }}
                    >
                      <div className="flex h-[400px]">
                        {/* ستون راست: رشته‌ها */}
                        <div className="w-1/2 border-l border-gray-100 p-4">
                          <h3 className="text-sm font-semibold text-gray-400 mb-3 pr-2 text-right">رشته‌های ورزشی</h3>
                          <ul className="space-y-1">
                            {SPORTS_CATEGORIES.map((sport) => (
                              <li key={sport.id} onMouseEnter={() => setHoveredSport(sport.slug)}>
                                <a href={`/category/${sport.slug}`} className={`block text-right rounded-md px-4 py-2 transition-all ${hoveredSport === sport.slug ? 'bg-[#aa4725] text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
                                  {sport.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* ستون چپ: برندها */}
                        <div className="w-1/2 p-4 bg-gray-50/50">
                          {hoveredSport ? (
                            <ul className="space-y-1">
                              <h3 className="text-sm font-semibold text-gray-400 mb-3 pr-2 text-right">برندهای برتر</h3>
                              {BRANDS[hoveredSport]?.map((brand, index) => (
                                <li key={index}>
                                  <a href={`/brand/${brand}`} className="block text-right rounded-md px-4 py-2 text-gray-700 hover:text-[#aa4725] hover:bg-white transition-all">{brand}</a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">یک رشته ورزشی را انتخاب کنید</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* لینک‌های ناوبری */}
                <div className="flex items-center gap-4">
                  {NAVIGATION_ITEMS.map((item) => (
                    <a key={item.id} href={item.href} className="text-[#0d0d0d] hover:text-[#aa4725] transition-colors font-medium text-sm whitespace-nowrap">
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* بخش وسط: فیلد جستجو */}
            <div className={`flex-grow transition-all duration-500 ease-in-out px-8 ${
              isScrolled ? 'max-w-xl' : 'max-w-2xl -translate-y-4'
            }`}>
              <Input
                className='rounded-[var(--radius)]'
                type="search"
                placeholder="جستجو در محصولات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<FiSearch size={20} />}
              />
            </div>

            {/* بخش چپ: داشبورد و سبد خرید */}
            <div className={`flex items-center gap-3 transition-all duration-500 ${
              isScrolled ? 'translate-y-0' : '-translate-y-4'
            }`}>
              {isLoggedIn ? (
                <Link href={"/p-user"}>
                  <Button className="flex items-center gap-1 rounded-[var(--radius)]" variant="outline" size="sm">
                    <FiUser className="ml-1" />
                    <span>داشبورد</span>
                  </Button>
                </Link>
              ) : (
                <Link href={"/login-register"}>
                  <Button className="rounded-[var(--radius)]" variant="outline" size="sm">
                     ورود | ثبت‌نام
                  </Button>
                </Link>
              )}

              <div className="relative cursor-pointer" onClick={() => setOpenCart(true)}>
                <IconButton variant="default">
                  <FiShoppingCart size={24} className="text-[var(--color-text)]" />
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

        {/* Mobile Navbar */}
        <div className="lg:hidden flex items-center h-full container mx-auto px-4">
           <div className="flex items-center justify-between w-full gap-3">
              <Link href="/">
                <Image src="/logo/logo.svg" alt="logo" width={isScrolled ? 60 : 80} height={60} className="transition-all" />
              </Link>
              <div className="flex-grow">
                <Input type="search" placeholder="جستجو..." className="py-2 text-xs" icon={<FiSearch size={16} />} />
              </div>
              <div className="relative" onClick={() => setOpenCart(true)}>
                <FiShoppingCart size={22} className="text-[#aa4725]" />
                {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-[#aa4725] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
              </div>
           </div>
        </div>
      </nav>

      {/* Spacer */}
      {!isHomePage && <div className={`transition-all duration-500 ${isScrolled ? 'h-[75px]' : 'h-[145px]'}`}></div>}
      
      <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />
    </>
  );
}