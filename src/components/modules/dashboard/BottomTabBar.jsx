'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { User, ShoppingBag, Heart, CreditCard, MapPin, Ticket, Wallet, MoreHorizontal } from 'lucide-react'

// تب‌بارِ پایینِ داشبورد کاربر — فقط موبایل (جایگزینِ سایدبارِ کشویی)
// دسکتاپ همچنان از سایدبار استفاده می‌کند؛ این کامپوننت با lg:hidden مخفی می‌شود.
const tabs = [
  { id: 'profile',   label: 'پروفایل',    icon: User,        href: '/p-user/profile' },
  { id: 'orders',    label: 'سفارش‌ها',    icon: ShoppingBag, href: '/p-user/orders' },
  { id: 'wallet',    label: 'کیف پول',    icon: Wallet,      href: '/p-user/wallet' },
  { id: 'payments',  label: 'پرداخت‌ها',   icon: CreditCard,  href: '/p-user/payments' },
  { id: 'tickets',   label: 'پشتیبانی',   icon: Ticket,      href: '/p-user/tickets' },
]

const moreTabs = [
  { id: 'wishlist',  label: 'علاقه‌مندی',  icon: Heart,       href: '/p-user/wishlist' },
  { id: 'addresses', label: 'آدرس‌ها',     icon: MapPin,      href: '/p-user/addresses' },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreTabs.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))

  return (
    <nav
      dir="rtl"
      aria-label="منوی داشبورد"
      onKeyDown={(event) => { if (event.key === 'Escape') setMoreOpen(false) }}
      className="lg:hidden fixed bottom-0 right-0 left-0 z-40 bg-white border-t border-[hsl(var(--border))] shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      {moreOpen && (
        <>
          <button type="button" aria-label="بستن منوی بیشتر" onClick={() => setMoreOpen(false)} className="fixed inset-0 -z-10 bg-black/20" />
          <div id="dashboard-more-links" className="absolute bottom-full left-2 right-2 mb-2 rounded-xl border bg-white p-2 shadow-lg">
            {moreTabs.map((tab) => (
              <Link key={tab.id} href={tab.href} onClick={() => setMoreOpen(false)} aria-current={pathname === tab.href ? 'page' : undefined} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
                <tab.icon size={20} aria-hidden="true" />
                {tab.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="grid grid-cols-6 bg-white">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              onClick={() => setMoreOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--color-primary)]" />
              )}
              <tab.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
        <button type="button" aria-expanded={moreOpen} aria-controls={moreOpen ? 'dashboard-more-links' : undefined} onClick={() => setMoreOpen(!moreOpen)} className={`flex min-h-11 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold ${moreActive || moreOpen ? 'text-[var(--color-primary)]' : 'text-slate-500'}`}>
          <MoreHorizontal size={20} aria-hidden="true" />
          <span>بیشتر</span>
        </button>
      </div>
    </nav>
  )
}
