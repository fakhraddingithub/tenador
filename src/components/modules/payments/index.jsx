'use client'

/**
 * PaymentsModule — بخشِ «پرداخت‌های من» در داشبوردِ کاربر
 *
 * نمایشِ همه‌ی پرداخت‌های ثبت‌شده‌ی کاربر با جستجو، فیلترِ وضعیت، جزئیاتِ کامل
 * (مودال)، نمایشگرِ رسید و حالت‌های خالی/بارگذاری. تماماً هم‌راستا با سیستمِ
 * طراحیِ روشنِ پروژه.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import {
  CreditCard,
  Receipt,
  Search,
  X,
  ChevronLeft,
  Wallet,
  Inbox,
} from 'lucide-react'
import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_FALLBACK,
  PAYMENT_METHOD,
  FILTER_OPTIONS,
  formatPrice,
  formatDateTime,
  getReceiptImages,
  getPaymentReference,
  buildSearchHaystack,
  normalizeDigits,
} from './constants'
import PaymentDetailModal from './PaymentDetailModal'
import ReceiptLightbox from './ReceiptLightbox'

/* ─── کارتِ پرداخت ───────────────────────────────────────────────────── */
function PaymentCard({ payment, onOpen }) {
  const statusCfg = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS_FALLBACK
  const StatusIcon = statusCfg.icon
  const methodCfg = PAYMENT_METHOD[payment.method] ?? {
    label: payment.method,
    icon: CreditCard,
  }
  const MethodIcon = methodCfg.icon
  const images = getReceiptImages(payment)
  const reference = getPaymentReference(payment)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onClick={() => onOpen(payment)}
      className="w-full text-right bg-white border border-gray-100 rounded-[6px] overflow-hidden shadow-sm hover:shadow-md hover:border-[#aa4725]/30 transition-all duration-200"
    >
      {/* سرِ کارت */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-[6px] bg-[#aa4725]/10 flex items-center justify-center flex-shrink-0">
            <MethodIcon className="text-[#aa4725]" size={17} />
          </div>
          <div className="min-w-0">
            <p
              className="font-mono text-sm font-bold text-[#1a1a1a] tracking-tight truncate"
              dir="ltr"
            >
              {reference}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(payment.createdAt)}
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

      {/* بدنه: مبلغ + سفارش */}
      <div className="px-4 pb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-400">مبلغ</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-[#aa4725] tracking-tight">
              {formatPrice(payment.amount)}
            </span>
            <span className="text-[11px] font-bold text-[#aa4725]/60">
              تومان
            </span>
          </div>
        </div>
        {payment.order && (
          <div className="text-left min-w-0">
            <p className="text-[11px] text-gray-400">سفارش</p>
            <p
              className="font-mono text-xs font-semibold text-gray-600 truncate"
              dir="ltr"
            >
              {payment.order.trackingCode}
            </p>
          </div>
        )}
      </div>

      {/* پابرگ: روش + رسید + جزئیات */}
      <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
            <MethodIcon size={11} />
            {methodCfg.label}
          </span>
          {images.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
              <Receipt size={11} />
              {images.length} رسید
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#aa4725]">
          جزئیات
          <ChevronLeft size={13} />
        </span>
      </div>
    </motion.button>
  )
}

/* ─── اسکلتِ بارگذاری ─────────────────────────────────────────────────── */
function PaymentSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-[6px] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[6px] bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-2.5 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
      </div>
      <div className="px-4 pb-3 flex items-end justify-between">
        <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="border-t border-gray-50 px-4 py-2.5">
        <div className="h-5 w-28 bg-gray-100 rounded-full animate-pulse" />
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
const PaymentsModule = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState(null)
  const [lightbox, setLightbox] = useState(null) // { images, index }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/payments', { credentials: 'include' })
        if (!res.ok) throw new Error('bad status')
        const data = await res.json()
        if (alive) setPayments(data.payments ?? [])
      } catch {
        if (alive) {
          setError(true)
          toast.error('خطا در بارگذاری پرداخت‌ها')
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
  const counts = { ALL: payments.length }
  for (const p of payments) counts[p.status] = (counts[p.status] || 0) + 1

  const q = normalizeDigits(query.trim()).toLowerCase()
  const filtered = payments.filter((p) => {
    if (activeFilter !== 'ALL' && p.status !== activeFilter) return false
    if (q && !buildSearchHaystack(p).includes(q)) return false
    return true
  })

  const hasAny = payments.length > 0

  /* ── حالتِ بارگذاری ── */
  if (loading) {
    return (
      <div className="space-y-5" dir="rtl">
        <div className="h-7 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-11 w-full bg-gray-100 rounded-[6px] animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PaymentSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
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
            <Wallet className="text-[#aa4725]" size={20} />
            پرداخت‌های من
            {hasAny && (
              <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {payments.length}
              </span>
            )}
          </h1>
        </div>

        {error && !hasAny ? (
          <EmptyState
            icon={Inbox}
            title="خطا در دریافت پرداخت‌ها"
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
            icon={Wallet}
            title="هنوز پرداختی ثبت نکرده‌اید"
            hint="پس از ثبت اولین پرداخت، تاریخچهٔ آن اینجا نمایش داده می‌شود"
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
                placeholder="جستجو بر اساس شماره سفارش، مرجع یا مبلغ..."
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
                  hint={`هیچ پرداختی با «${query.trim()}» مطابقت ندارد`}
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
                  title="پرداختی با این وضعیت یافت نشد"
                  action={
                    <button
                      onClick={() => setActiveFilter('ALL')}
                      className="mt-3 text-xs font-semibold text-[#aa4725] hover:underline"
                    >
                      نمایش همهٔ پرداخت‌ها
                    </button>
                  }
                />
              )
            ) : (
              <motion.div layout className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {filtered.map((p) => (
                    <PaymentCard key={p._id} payment={p} onOpen={setDetail} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* مودالِ جزئیات */}
      {detail && (
        <PaymentDetailModal
          payment={detail}
          onClose={() => setDetail(null)}
          onViewReceipt={(images, index) => setLightbox({ images, index })}
        />
      )}

      {/* نمایشگرِ رسید */}
      {lightbox && (
        <ReceiptLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

export default PaymentsModule
