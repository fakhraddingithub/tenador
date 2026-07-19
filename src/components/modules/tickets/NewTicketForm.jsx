'use client'

/**
 * NewTicketForm — فرم ثبت تیکت جدید در داشبورد کاربر
 *
 * دپارتمان + اولویت + موضوع + متن پیام (الزامی)، پیوست و اتصال به
 * سفارش/پرداختِ خودِ کاربر (اختیاری — از /api/orders و /api/payments که
 * سمتِ سرور به کاربرِ جاری محدودند). بعد از ثبت → صفحه‌ی گفتگوی تیکت.
 */

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-toastify'
import {
  Ticket,
  ArrowRight,
  Loader2,
  Search,
  X,
  Package,
  CreditCard,
  ChevronDown,
} from 'lucide-react'
import {
  TICKET_DEPARTMENT,
  TICKET_PRIORITY,
  formatPrice,
  formatDate,
  normalizeDigits,
} from './constants'
import AttachmentUploader from './AttachmentUploader'

const DEPARTMENT_KEYS = Object.keys(TICKET_DEPARTMENT)
const PRIORITY_KEYS = Object.keys(TICKET_PRIORITY)

/* ─── انتخاب‌گر سفارش/پرداخت (فقط موارد خودِ کاربر) ──────────────────── */
function LinkPicker({
  label,
  icon: Icon,
  items,
  loading,
  selected,
  onSelect,
  renderItem,
  searchOf,
  emptyText,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const q = normalizeDigits(query.trim()).toLowerCase()
  const filtered = q
    ? items.filter((it) => normalizeDigits(searchOf(it)).toLowerCase().includes(q))
    : items

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 bg-[#aa4725]/5 border border-[#aa4725]/20 rounded-[6px] px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0 text-sm text-[#1a1a1a]">
          <Icon className="text-[#aa4725] flex-shrink-0" size={15} />
          <div className="min-w-0 truncate">{renderItem(selected)}</div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label={`حذف ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-white transition flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-[6px] px-3 py-2.5 text-sm text-gray-500 hover:border-[#aa4725]/40 transition bg-white"
      >
        <span className="inline-flex items-center gap-2">
          <Icon size={15} className="text-gray-400" />
          {label}
        </span>
        <ChevronDown
          size={15}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-[6px] shadow-lg overflow-hidden"
        >
          <div className="relative border-b border-gray-100">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو..."
              className="w-full h-10 pr-9 pl-3 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">{emptyText}</p>
            ) : (
              filtered.map((it) => (
                <button
                  key={it._id}
                  type="button"
                  onClick={() => {
                    onSelect(it)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="w-full text-right px-3 py-2.5 text-sm text-[#1a1a1a] hover:bg-[#aa4725]/5 transition border-b border-gray-50 last:border-b-0"
                >
                  {renderItem(it)}
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ─── فرم اصلی ───────────────────────────────────────────────────────── */
const NewTicketForm = () => {
  const router = useRouter()

  const [department, setDepartment] = useState('support')
  const [priority, setPriority] = useState('medium')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState([])
  const [relatedOrder, setRelatedOrder] = useState(null)
  const [relatedPayment, setRelatedPayment] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [payments, setPayments] = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/orders', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (alive) setOrders(data.orders ?? [])
        }
      } catch {
        /* اتصال سفارش اختیاری است — خطا مانع ثبت تیکت نمی‌شود */
      } finally {
        if (alive) setOrdersLoading(false)
      }
    })()
    ;(async () => {
      try {
        const res = await fetch('/api/payments', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (alive) setPayments(data.payments ?? [])
        }
      } catch {
        /* اختیاری */
      } finally {
        if (alive) setPaymentsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim()) return toast.error('موضوع تیکت الزامی است')
    if (!body.trim()) return toast.error('متن پیام الزامی است')

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim(),
          department,
          priority,
          body: body.trim(),
          attachments,
          relatedOrder: relatedOrder?._id || null,
          relatedPayment: relatedPayment?._id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'خطا در ثبت تیکت')

      toast.success('تیکت شما با موفقیت ثبت شد')
      router.push(`/p-user/tickets/${data.ticket._id}`)
    } catch (err) {
      toast.error(err.message || 'خطا در ثبت تیکت')
      setSubmitting(false)
    }
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
          ثبت تیکت جدید
        </h1>
        <Link
          href="/p-user/tickets"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#aa4725] transition-colors"
        >
          <ArrowRight size={14} />
          بازگشت به تیکت‌ها
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-100 rounded-[6px] shadow-sm p-5 space-y-5"
      >
        {/* دپارتمان */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            دپارتمان <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEPARTMENT_KEYS.map((key) => {
              const cfg = TICKET_DEPARTMENT[key]
              const DeptIcon = cfg.icon
              const isActive = department === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDepartment(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-[6px] border text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#aa4725] text-white border-[#aa4725] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#aa4725]/40'
                  }`}
                >
                  <DeptIcon size={14} className={isActive ? '' : 'text-gray-400'} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* اولویت */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            اولویت <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRIORITY_KEYS.map((key) => {
              const cfg = TICKET_PRIORITY[key]
              const isActive = priority === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPriority(key)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-150 ${
                    isActive
                      ? 'bg-[#aa4725] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* موضوع */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            موضوع <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="مثلاً: پیگیری وضعیت ارسال سفارش"
            className="w-full h-11 px-3.5 rounded-[6px] border border-gray-200 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/15 transition"
          />
        </div>

        {/* متن پیام */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            متن پیام <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="شرح کامل درخواست یا مشکل خود را بنویسید..."
            className="w-full px-3.5 py-3 rounded-[6px] border border-gray-200 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/15 transition resize-y"
          />
        </div>

        {/* پیوست */}
        <div>
          <AttachmentUploader onChange={setAttachments} disabled={submitting} />
        </div>

        {/* اتصال به سفارش / پرداخت */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500">
            اتصال به سفارش یا پرداخت{' '}
            <span className="font-normal text-gray-400">(اختیاری)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LinkPicker
              label="انتخاب سفارش"
              icon={Package}
              items={orders}
              loading={ordersLoading}
              selected={relatedOrder}
              onSelect={setRelatedOrder}
              searchOf={(o) => `${o.trackingCode ?? ''} ${o.totalPrice ?? ''}`}
              emptyText="سفارشی یافت نشد"
              renderItem={(o) => (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold" dir="ltr">
                    {o.trackingCode}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDate(o.createdAt)}
                  </span>
                </span>
              )}
            />
            <LinkPicker
              label="انتخاب پرداخت"
              icon={CreditCard}
              items={payments}
              loading={paymentsLoading}
              selected={relatedPayment}
              onSelect={setRelatedPayment}
              searchOf={(p) =>
                `${p.amount ?? ''} ${p.order?.trackingCode ?? ''} ${formatPrice(p.amount)}`
              }
              emptyText="پرداختی یافت نشد"
              renderItem={(p) => (
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold">
                    {formatPrice(p.amount)}{' '}
                    <span className="text-[10px] font-normal text-gray-400">تومان</span>
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDate(p.createdAt)}
                  </span>
                </span>
              )}
            />
          </div>
        </div>

        {/* دکمه ثبت */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-[#aa4725] text-white text-sm font-semibold px-6 py-2.5 rounded-[6px] shadow-sm hover:bg-[#8f3b1f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 className="animate-spin" size={15} />}
            {submitting ? 'در حال ثبت...' : 'ثبت تیکت'}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

export default NewTicketForm
