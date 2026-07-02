'use client'
import "@/app/globals.css"
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

import SiteNavbar from '@/components/features/navbar/SiteNavbar'
import Sidebar from '@/components/modules/dashboard/Sidebar'
import CartCleanup from '@/components/features/cart/CartCleanup'
import ScrollToTop from '@/components/common/ScrollToTop'
import NavigationLoader from '@/components/common/NavigationLoader'

export default function RootLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>
        <NavigationLoader />
        <ScrollToTop />
        <CartCleanup />

        <div className="min-h-screen bg-[#f8fafc] text-slate-800 rtl font-sans">

          {/* منوی بالایی — نوبار اصلی سایت (جایگزین نوبار قدیمی داشبورد) */}
          <SiteNavbar />

          <div className="flex">
            {/* منوی کناری */}
            <Sidebar
              isOpen={isSidebarOpen}
              setIsOpen={setIsSidebarOpen}
            />

            {/* محتوای اصلی صفحات */}
            <main className="flex-1 min-w-0 py-4 lg:p-8">
              <div className="max-w-5xl mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>

          {/* بک‌دراپ موبایل */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-xs lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* دستگیره‌ی کشویی موبایل — تنها راهِ باز/بستنِ سایدبار در موبایل
              (روی دسکتاپ سایدبار static است و این دکمه با lg:hidden مخفی می‌شود) */}
          <motion.button
            type="button"
            aria-label={isSidebarOpen ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((v) => !v)}
            initial={false}
            animate={{ right: isSidebarOpen ? '18rem' : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-[88px] z-40 lg:hidden flex items-center justify-center h-16 w-7 rounded-l-[6px] rounded-r-none bg-white text-slate-700 shadow-lg shadow-black/15 ring-1 ring-black/5 active:scale-95 transition-transform"
          >
            <ChevronLeft
              size={18}
              className="transition-transform duration-300"
              style={{ transform: isSidebarOpen ? 'rotate(180deg)' : 'none' }}
            />
          </motion.button>
        </div>
      </body>
    </html>
  )
}
