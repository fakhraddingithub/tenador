'use client'
import "@/app/globals.css"
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

import SiteNavbar from '@/components/features/navbar/SiteNavbar'
import Sidebar from '@/components/modules/dashboard/Sidebar'
import BottomTabBar from '@/components/modules/dashboard/BottomTabBar'
import CartCleanup from '@/components/features/cart/CartCleanup'
import ScrollToTop from '@/components/common/ScrollToTop'
import NavigationLoader from '@/components/common/NavigationLoader'
import InitialLoadLoader from '@/components/common/InitialLoadLoader'

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
        <InitialLoadLoader />
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

            {/* محتوای اصلی صفحات (در موبایل فضای تب‌بارِ پایین لحاظ شده) */}
            <main className="flex-1 min-w-0 py-4 pb-24 lg:p-8">
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

          {/* تب‌بارِ پایینِ موبایل — جایگزینِ سایدبارِ کشویی (دسکتاپ همچنان سایدبار دارد) */}
          <BottomTabBar />
        </div>
      </body>
    </html>
  )
}
