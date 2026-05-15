'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  User, ShoppingBag, Heart, CreditCard, 
  MapPin, Wallet, Ticket, LogOut 
} from 'lucide-react'

const menuItems = [
  { id: 'profile', label: 'پروفایل کاربری', icon: User, href: '/p-user/profile' },
  { id: 'orders', label: 'سفارش‌های من', icon: ShoppingBag, href: '/p-user/orders' },
  { id: 'cart', label: 'سبد خرید', icon: ShoppingBag, href: '/p-user/cart' },
  { id: 'wishlist', label: 'لیست علاقه‌مندی‌ها', icon: Heart, href: '/p-user/wishlist' },
  { id: 'payments', label: 'تاریخچه پرداخت‌ها', icon: CreditCard, href: '/p-user/payments' },
  { id: 'addresses', label: 'آدرس‌های من', icon: MapPin, href: '/p-user/addresses' },
  { id: 'wallet', label: 'کیف پول', icon: Wallet, href: '/p-user/wallet' },
  { id: 'tickets', label: 'تیکت‌های پشتیبانی', icon: Ticket, href: '/p-user/tickets' },
]

export default function Sidebar({ isOpen, setIsOpen }) {
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/'
    } catch {
      console.error('خطا در خروج')
    }
  }

  return (
    <aside className={`
      fixed inset-y-0 right-0 z-40 w-72 border-l pt-16 lg:pt-0 border-[hsl(var(--border))] bg-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      <div className="flex h-full flex-col p-4 justify-between">
        <nav className="space-y-1.5 pt-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  relative flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius)] text-sm font-medium transition-all duration-200 group
                  ${isActive 
                    ? 'text-[var(--color-primary)] font-bold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                {/* پس‌زمینه متحرک با استفاده از ۸٪ غلظت رنگ اصلی برای زیبایی UX */}
                {isActive && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-[hsl(var(--primary)/0.08)] rounded-[var(--radius)] -z-10 border-r-4 border-[var(--color-primary)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <item.icon 
                  size={18} 
                  className={isActive ? 'text-[var(--color-primary)]' : 'text-slate-400 group-hover:text-slate-600'} 
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button 
          onClick={handleLogout}
          className="mb-6 flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius)] text-sm font-medium text-rose-600 hover:bg-rose-50/60 transition-colors"
        >
          <LogOut size={18} />
          خروج از حساب کاربری
        </button>
      </div>
    </aside>
  )
}