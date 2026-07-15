'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, ShoppingBag, CreditCard, MapPin, Ticket } from 'lucide-react'

// تب‌بارِ پایینِ داشبورد کاربر — فقط موبایل (جایگزینِ سایدبارِ کشویی)
// دسکتاپ همچنان از سایدبار استفاده می‌کند؛ این کامپوننت با lg:hidden مخفی می‌شود.
const tabs = [
  { id: 'profile',   label: 'پروفایل',    icon: User,        href: '/p-user/profile' },
  { id: 'orders',    label: 'سفارش‌ها',    icon: ShoppingBag, href: '/p-user/orders' },
  { id: 'payments',  label: 'پرداخت‌ها',   icon: CreditCard,  href: '/p-user/payments' },
  { id: 'addresses', label: 'آدرس‌ها',     icon: MapPin,      href: '/p-user/addresses' },
  { id: 'tickets',   label: 'پشتیبانی',   icon: Ticket,      href: '/p-user/tickets' },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      dir="rtl"
      aria-label="منوی داشبورد"
      className="lg:hidden fixed bottom-0 right-0 left-0 z-40 bg-white border-t border-[hsl(var(--border))] shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-slate-400 hover:text-slate-600'
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
      </div>
    </nav>
  )
}
