'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

import Sidebar from '@/components/modules/dashboard/Sidebar'
import BottomTabBar from '@/components/modules/dashboard/BottomTabBar'

/**
 * بخشِ کلاینتیِ داشبورد کاربر — سایدبار (state) و ترنزیشنِ صفحه (usePathname).
 *
 * فقط برای این جدا شده که layout بتواند سرور-کامپوننت بماند و <SiteNavbar /> را
 * روی سرور رندر کند؛ وگرنه نوبار مجبور بود navData را با fetch از /api/navbar
 * بگیرد (یک invocation اضافه به‌ازای هر بازدید).
 */
export default function DashboardBody({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <div className="flex">
        {/* منوی کناری */}
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

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
    </>
  )
}
