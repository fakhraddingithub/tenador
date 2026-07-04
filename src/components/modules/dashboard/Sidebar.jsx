'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User, ShoppingBag, Heart, CreditCard,
  MapPin, Wallet, Ticket, LogOut, GraduationCap,
} from 'lucide-react'

const menuItems = [
  { id: 'profile',   label: 'پروفایل کاربری',      icon: User,       href: '/p-user/profile' },
  { id: 'orders',    label: 'سفارش‌های من',          icon: ShoppingBag, href: '/p-user/orders' },
  { id: 'wishlist',  label: 'لیست علاقه‌مندی‌ها',   icon: Heart,       href: '/p-user/wishlist' },
  { id: 'payments',  label: 'تاریخچه پرداخت‌ها',    icon: CreditCard,  href: '/p-user/payments' },
  { id: 'addresses', label: 'آدرس‌های من',           icon: MapPin,      href: '/p-user/addresses' },
  { id: 'wallet',    label: 'کیف پول',               icon: Wallet,      href: '/p-user/wallet' },
  { id: 'tickets',   label: 'تیکت‌های پشتیبانی',    icon: Ticket,      href: '/p-user/tickets' },
]

export default function Sidebar({ isOpen, setIsOpen }) {
  const pathname = usePathname()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user) setUser(d.user) })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      try { localStorage.removeItem('authUser') } catch {}
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
      <div className="flex h-full flex-col">

        {/* ── User Profile Section ─────────────────────────────────── */}
        <div className="p-4 border-b border-slate-100">
          {user ? (
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-900 text-[var(--color-primary)] flex items-center justify-center font-bold text-base flex-shrink-0">
                  {user.name?.charAt(0) || 'ک'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.phone || user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* ── Coach Dashboard Link (coaches only) ─────────────────── */}
        {user?.isCoach && (
          <div className="px-4 pt-3 pb-1">
            <Link
              href="/p-user/coach"
              onClick={() => setIsOpen(false)}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] text-sm font-bold transition-all duration-200 group
                ${pathname === '/p-user/coach'
                  ? 'text-[var(--color-primary)]'
                  : 'text-slate-600 hover:bg-amber-50/60 hover:text-amber-700'}
              `}
            >
              {pathname === '/p-user/coach' && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 bg-[hsl(var(--primary)/0.08)] rounded-[var(--radius)] -z-10 border-r-4 border-[var(--color-primary)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <GraduationCap
                size={18}
                className={pathname === '/p-user/coach' ? 'text-[var(--color-primary)]' : 'text-amber-500 group-hover:text-amber-600'}
              />
              داشبورد مربی
              <span className="mr-auto text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                مربی
              </span>
            </Link>
            <div className="mt-2 border-t border-slate-100" />
          </div>
        )}

        {/* ── Navigation Items ─────────────────────────────────────── */}
        <nav className="flex-1 space-y-1 px-4 pt-2 overflow-y-auto">
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
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-[hsl(var(--primary)/0.08)] rounded-[var(--radius)] -z-10 border-r-4 border-[var(--color-primary)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
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

        {/* ── Logout ───────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="m-4 mb-6 flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius)] text-sm font-medium text-rose-600 hover:bg-rose-50/60 transition-colors"
        >
          <LogOut size={18} />
          خروج از حساب کاربری
        </button>
      </div>
    </aside>
  )
}
