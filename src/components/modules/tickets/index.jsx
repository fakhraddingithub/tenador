'use client'

/**
 * TicketsModule — بخشِ «تیکت‌های پشتیبانی» در داشبوردِ کاربر
 *
 * تاریخچه‌ی همه‌ی تیکت‌های کاربر (باز و بسته) با جستجو و فیلترِ وضعیت.
 * کلیک روی هر تیکت → صفحه‌ی گفتگوی همان تیکت (/p-user/tickets/[id])
 * دکمه‌ی «تیکت جدید» → فرم ثبت تیکت (/p-user/tickets/new)
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'react-toastify'
import {
  Ticket,
  Plus,
  Search,
  X,
  ChevronLeft,
  Inbox,
  UserCheck,
} from 'lucide-react'
import {
  TICKET_STATUS,
  TICKET_STATUS_FALLBACK,
  TICKET_DEPARTMENT,
  TICKET_DEPARTMENT_FALLBACK,
  TICKET_PRIORITY,
  TICKET_PRIORITY_FALLBACK,
  FILTER_OPTIONS,
  formatDateTime,
  normalizeDigits,
  buildSearchHaystack,
} from './constants'

/* ─── کارتِ تیکت ─────────────────────────────────────────────────────── */
function TicketCard({ ticket }) {
  const statusCfg = TICKET_STATUS[ticket.status] ?? TICKET_STATUS_FALLBACK
  const StatusIcon = statusCfg.icon
  const deptCfg =
    TICKET_DEPARTMENT[ticket.department] ?? TICKET_DEPARTMENT_FALLBACK
  const DeptIcon = deptCfg.icon
  const priorityCfg =
    TICKET_PRIORITY[ticket.priority] ?? TICKET_PRIORITY_FALLBACK

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
    >
      <Link
        href={`/p-user/tickets/${ticket._id}`}
        className="block w-full text-right bg-white border border-gray-100 rounded-[6px] overflow-hidden shadow-sm hover:shadow-md hover:border-[#aa4725]/30 transition-all duration-200"
      >
        {/* سرِ کارت */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-[6px] bg-[#aa4725]/10 flex items-center justify-center flex-shrink-0">
              <DeptIcon className="text-[#aa4725]" size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1a1a] truncate">
                {ticket.subject}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {deptCfg.label} · {formatDateTime(ticket.lastMessageAt)}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${statusCfg.badge}`}
          >
            <StatusIcon size={11} />
            {statusCfg.label}
          </span>
        </div>

        {/* پابرگ: اولویت + سفارش مرتبط + جزئیات */}
        <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${priorityCfg.badge}`}
            >
              اولویت: {priorityCfg.label}
            </span>
            {ticket.relatedOrder?.trackingCode && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full font-mono truncate"
                dir="ltr"
              >
                {ticket.relatedOrder.trackingCode}
              </span>
            )}
            {ticket.assignedAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
                <UserCheck size={11} />
                در حال بررسی
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#aa4725] flex-shrink-0">
            مشاهده گفتگو
            <ChevronLeft size={13} />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

/* ─── اسکلتِ بارگذاری ─────────────────────────────────────────────────── */
function TicketSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-[6px] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[6px] bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-2.5 w-28 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
      </div>
      <div className="border-t border-gray-50 px-4 py-2.5 flex items-center gap-2">
        <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
      </div>
    </div>
  )
}

/* ─── حالتِ خالی ──────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-[6px] border border-dashed border-gray-200 bg-white p-12 text-center"
    >
      <Icon
        className="mx-auto mb-4 text-gray-200"
        size={44}
        strokeWidth={1.5}
      />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {action}
    </motion.div>
  )
}

/* ─── ماژول اصلی ─────────────────────────────────────────────────────── */
const TicketsModule = () => {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/tickets', { credentials: 'include' })
        if (!res.ok) throw new Error('bad status')
        const data = await res.json()
        if (alive) setTickets(data.tickets ?? [])
      } catch {
        if (alive) {
          setError(true)
          toast.error('خطا در بارگذاری تیکت‌ها')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // شمارشِ هر وضعیت برای برچسبِ فیلترها
  const counts = { ALL: tickets.length }
  for (const t of tickets) counts[t.status] = (counts[t.status] || 0) + 1

  const q = normalizeDigits(query.trim()).toLowerCase()
  const filtered = tickets.filter((t) => {
    if (activeFilter !== 'ALL' && t.status !== activeFilter) return false
    if (q && !buildSearchHaystack(t).includes(q)) return false
    return true
  })

  const hasAny = tickets.length > 0

  const newTicketButton = (
    <Link
      href="/p-user/tickets/new"
      className="inline-flex items-center gap-1.5 bg-[#aa4725] text-white text-sm font-semibold px-4 py-2 rounded-[6px] shadow-sm hover:bg-[#8f3b1f] transition-colors"
    >
      <Plus size={16} />
      تیکت جدید
    </Link>
  )

  /* ── حالتِ بارگذاری ── */
  if (loading) {
    return (
      <div className="space-y-5" dir="rtl">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-11 w-full bg-gray-100 rounded-[6px] animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <TicketSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
      dir="rtl"
    >
      {/* هدر */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[#1a1a1a] tracking-tight">
          <Ticket className="text-[#aa4725]" size={20} />
          تیکت‌های پشتیبانی
          {hasAny && (
            <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {tickets.length}
            </span>
          )}
        </h1>
        {newTicketButton}
      </div>

      {error && !hasAny ? (
        <EmptyState
          icon={Inbox}
          title="خطا در دریافت تیکت‌ها"
          hint="لطفاً چند لحظه بعد دوباره تلاش کنید"
          action={
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-xs font-semibold text-[#aa4725] hover:underline"
            >
              تلاش مجدد
            </button>
          }
        />
      ) : !hasAny ? (
        <EmptyState
          icon={Ticket}
          title="هنوز تیکتی ثبت نکرده‌اید"
          hint="سؤال یا مشکلی دارید؟ تیم پشتیبانی Tenador آماده‌ی پاسخ‌گویی است"
          action={<div className="mt-4 flex justify-center">{newTicketButton}</div>}
        />
      ) : (
        <>
          {/* جستجو */}
          <div className="relative">
            <Search
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو بر اساس موضوع، دپارتمان یا شماره سفارش..."
              className="w-full h-11 pr-10 pl-10 rounded-[6px] border border-gray-200 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/15 transition"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="پاک کردن جستجو"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* فیلترها */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((f) => {
              const n = counts[f.key] ?? 0
              if (f.key !== 'ALL' && n === 0) return null
              const isActive = activeFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150 ${
                    isActive
                      ? 'bg-[#aa4725] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-px rounded-full ${
                      isActive ? 'bg-white/25' : 'bg-black/5'
                    }`}
                  >
                    {n}
                  </span>
                </button>
              )
            })}
          </div>

          {/* لیست / حالت‌های خالیِ فیلتر و جستجو */}
          {filtered.length === 0 ? (
            query.trim() ? (
              <EmptyState
                icon={Search}
                title="نتیجه‌ای یافت نشد"
                hint={`هیچ تیکتی با «${query.trim()}» مطابقت ندارد`}
                action={
                  <button
                    onClick={() => setQuery('')}
                    className="mt-3 text-xs font-semibold text-[#aa4725] hover:underline"
                  >
                    پاک کردن جستجو
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="تیکتی با این وضعیت یافت نشد"
                action={
                  <button
                    onClick={() => setActiveFilter('ALL')}
                    className="mt-3 text-xs font-semibold text-[#aa4725] hover:underline"
                  >
                    نمایش همهٔ تیکت‌ها
                  </button>
                }
              />
            )
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((t) => (
                  <TicketCard key={t._id} ticket={t} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}

export default TicketsModule
