'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Bell, User } from 'lucide-react'

export default function Navbar({ isSidebarOpen, setIsSidebarOpen }) {
  const [userName, setUserName] = useState("کاربر عزیز")

  // دریافت اطلاعات کاربر از API
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile')
        if (res.ok) {
          const data = await res.json()
          // استخراج نام کاربر بر اساس ساختارهای متداول ریپانس (name یا username)
          const name = data?.name || data?.user?.name || data?.username || "کاربر عزیز"
          setUserName(name)
        }
      } catch (error) {
        console.error("خطا در دریافت اطلاعات پروفایل:", error)
      }
    }

    fetchUserProfile()
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[hsl(var(--border))] bg-white/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 lg:px-8">
        
        {/* راست: لوگو و دکمه موبایل */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center transition-transform group-hover:scale-105">
              {/* بارگذاری لوگو اختصاصی سایت */}
              <img 
                src="/logo/logo.svg" 
                alt="لوگوی سایت" 
                className="h-13 w-auto object-contain"
              />
            </div>
          </Link>
        </div>

        {/* چپ: اطلاعات کاربر و نوتیفیکیشن */}
        <div className="flex items-center gap-4">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100">
            <Bell size={18} />
            {/* استفاده از رنگ سکندری سایت برای نقطه اعلان */}
            <span className="absolute top-2.5 left-2.5 h-2 w-2 rounded-full bg-[#ffbf00]" />
          </button>
          
          <div className="h-8 w-px bg-[hsl(var(--border))] hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="hidden flex-col text-right leading-none sm:flex">
              <span className="text-xs text-slate-400 mb-1">خوش آمدید</span>
              <span className="text-sm font-bold text-[var(--color-text)]">{userName}</span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-slate-50 border border-[hsl(var(--border))] text-[hsl(var(--primary))] shadow-inner">
              <User size={20} />
            </div>
          </div>
        </div>

      </div>
    </header>
  )
}