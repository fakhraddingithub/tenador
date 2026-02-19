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
      {/* Navbar Fixed Height: 75px & Background: #20232ae6 */}
      <nav className="fixed top-0 right-0 left-0 z-50 bg-[#20232ae6] backdrop-blur-md border-b border-white/10 h-[75px] transition-all duration-300">
        <div className="hidden lg:block container mx-auto px-4 h-full">
          <div className="relative flex items-center justify-between h-full">
            
            <div className="flex items-center gap-6">
              {/* Logo - Always Small */}
              <div className="scale-75">
                <Link href="/">
                  <Image src="/logo/logo.svg" alt="logo" width={100} height={100} />
                </Link>
              </div>

              {/* Navigation & Categories */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <button
                    onMouseEnter={() => setIsCategoryOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#aa4725] text-white rounded-[var(--radius)] whitespace-nowrap text-sm hover:bg-[#aa4725]/90 transition-all"
                  >
                    <HiOutlineViewGrid size={20} />
                    <span>دسته‌بندی محصولات</span>
                  </button>

                  {/* Dropdown with Background: #20232ae6 */}
                  {isCategoryOpen && (
                    <div 
                      className="absolute top-full right-0 mt-2 w-[600px] bg-[#20232ae6] backdrop-blur-xl border border-white/10 shadow-2xl rounded-[var(--radius)] overflow-hidden z-[100]"
                      onMouseLeave={() => { setIsCategoryOpen(false); setHoveredSport(null); }}
                    >
                      <div className="flex h-[400px]">
                        {/* Right Column */}
                        <div className="w-1/2 border-l border-white/5 p-4">
                          <h3 className="text-sm font-semibold text-gray-400 mb-3 pr-2 text-right">رشته‌های ورزشی</h3>
                          <ul className="space-y-1">
                            {SPORTS_CATEGORIES.map((sport) => (
                              <li key={sport.id} onMouseEnter={() => setHoveredSport(sport.slug)}>
                                <a href={`/category/${sport.slug}`} className={`block text-right rounded-md px-4 py-2 transition-all ${hoveredSport === sport.slug ? 'bg-[#ffffff1a] text-[#aa4725]' : 'text-white hover:bg-[#ffffff1a]'}`}>
                                  {sport.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Left Column */}
                        <div className="w-1/2 p-4 bg-white/5">
                          {hoveredSport ? (
                            <ul className="space-y-1">
                              <h3 className="text-sm font-semibold text-gray-400 mb-3 pr-2 text-right">برندهای برتر</h3>
                              {BRANDS[hoveredSport]?.map((brand, index) => (
                                <li key={index}>
                                  <a href={`/brand/${brand}`} className="block text-right rounded-md px-4 py-2 text-white hover:text-[#aa4725] hover:bg-[#ffffff1a] transition-all">{brand}</a>
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

                {/* Nav Links: Color White */}
                <div className="flex items-center gap-4">
                  {NAVIGATION_ITEMS.map((item) => (
                    <a key={item.id} href={item.href} className="text-white hover:text-[#aa4725] transition-colors font-medium text-sm whitespace-nowrap">
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-grow px-8 max-w-xl">
              <Input
                className='rounded-[var(--radius)] bg-white/10 border-white/20 text-white placeholder:text-gray-400'
                type="search"
                placeholder="جستجو در محصولات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<FiSearch size={20} className="text-white" />}
              />
            </div>

            {/* Dashboard & Cart Buttons */}
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Link href={"/p-user"}>
                  <Button 
                    className="flex items-center gap-1 rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all" 
                    variant="outline" 
                    size="sm"
                  >
                    <FiUser className="ml-1" />
                    <span>داشبورد</span>
                  </Button>
                </Link>
              ) : (
                <Link href={"/login-register"}>
                  <Button 
                    className="rounded-[var(--radius)] text-white border-white hover:bg-white hover:text-black transition-all" 
                    variant="outline" 
                    size="sm"
                  >
                     ورود | ثبت‌نام
                  </Button>
                </Link>
              )}

              <div className="relative cursor-pointer" onClick={() => setOpenCart(true)}>
                <IconButton 
                   className="bg-transparent border-white hover:bg-white text-white hover:text-black transition-all"
                   variant="outline"
                >
                  <FiShoppingCart size={22} />
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
                <Image src="/logo/logo.svg" alt="logo" width={60} height={60} />
              </Link>
              <div className="flex-grow">
                <Input type="search" placeholder="جستجو..." className="py-2 text-xs bg-white/10 border-white/20 text-white" icon={<FiSearch size={16} />} />
              </div>
              <div className="relative" onClick={() => setOpenCart(true)}>
                <FiShoppingCart size={22} className="text-white" />
                {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-[#aa4725] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
              </div>
           </div>
        </div>
      </nav>

      {/* Spacer - Fixed Height */}
      {!isHomePage && <div className="h-[75px]"></div>}
      
      <CartDrawer isOpen={openCart} onClose={() => setOpenCart(false)} />
    </>
  );
}