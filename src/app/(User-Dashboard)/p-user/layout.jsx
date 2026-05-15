'use client'
import "@/app/globals.css"
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

import Navbar from '@/components/modules/dashboard/Navbar'
import Sidebar from '@/components/modules/dashboard/Sidebar'

export default function RootLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <html lang="fa" dir="rtl">
      <body>
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 rtl font-sans">

          {/* منوی بالایی */}
          <Navbar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            userName="احمد علوی"
          />

          <div className="flex pt-16">
            {/* منوی کناری */}
            <Sidebar
              isOpen={isSidebarOpen}
              setIsOpen={setIsSidebarOpen}
            />

            {/* محتوای اصلی صفحات */}
            <main className="flex-1 min-w-0 p-4 lg:p-8">
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
        </div>
      </body>
    </html>
  )
}