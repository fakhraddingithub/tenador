'use client'

/**
 * TicketChat — صفحه‌ی گفتگوی یک تیکت در داشبورد کاربر
 *
 * تاریخچه‌ی کامل پیام‌ها (کاربر/پشتیبانی با استایل متمایز)، کامپوزر متن + پیوست،
 * بستن تیکت با تأیید SweetAlert2 و بازکردنِ مجددِ ساده. تیکت بسته فقط‌خواندنی
 * است ولی همیشه قابل مشاهده می‌ماند. به‌روزرسانی با polling سبک + بعد از ارسال.
 */

import { motion } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import {
  ArrowRight,
  Send,
  Loader2,
  Lock,
  Unlock,
  Headset,
  User as UserIcon,
  Package,
  CreditCard,
  FileText,
  Inbox,
} from 'lucide-react'
import {
  TICKET_STATUS,
  TICKET_STATUS_FALLBACK,
  TICKET_DEPARTMENT,
  TICKET_DEPARTMENT_FALLBACK,
  TICKET_PRIORITY,
  TICKET_PRIORITY_FALLBACK,
  formatDateTime,
  formatDate,
  formatPrice,
  senderName,
  attachmentHref,
} from './constants'
import AttachmentUploader from './AttachmentUploader'

const POLL_INTERVAL = 15000

/* ─── پیوست‌های یک پیام ──────────────────────────────────────────────── */
function MessageAttachments({ attachments, mine }) {
  if (!attachments?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) =>
        att.type === 'pdf' ? (
          <a
            key={i}
            href={attachmentHref(att)}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-[6px] border transition ${
              mine
                ? 'bg-white/15 border-white/25 text-white hover:bg-white/25'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={13} />
            <span className="max-w-[140px] truncate" dir="ltr">
              {att.filename || 'فایل PDF'}
            </span>
          </a>
        ) : (
          <a
            key={i}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-24 h-24 rounded-[6px] overflow-hidden border border-black/10 hover:opacity-90 transition"
          >
            <img
              src={att.url}
              alt={att.filename || 'پیوست'}
              className="w-full h-full object-cover"
            />
          </a>
        ),
      )}
    </div>
  )
}

/* ─── حباب پیام ──────────────────────────────────────────────────────── */
function MessageBubble({ message }) {
  const mine = message.senderRole === 'user'
  const supportName = senderName(message.sender) || 'پشتیبانی Tenador'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? '' : 'text-right'}`}>
        {/* نام فرستنده */}
        <div
          className={`flex items-center gap-1.5 mb-1 text-[11px] font-semibold ${
            mine ? 'text-gray-400' : 'text-[#aa4725] justify-end'
          }`}
        >
          {mine ? (
            <>
              <UserIcon size={11} />
              شما
            </>
          ) : (
            <>
              {supportName}
              <Headset size={11} />
            </>
          )}
        </div>

        {/* بدنه پیام */}
        <div
          className={`px-3.5 py-2.5 rounded-[10px] text-sm leading-6 whitespace-pre-line break-words ${
            mine
              ? 'bg-[#aa4725] text-white rounded-tr-[3px]'
              : 'bg-white border border-gray-100 text-[#1a1a1a] shadow-sm rounded-tl-[3px]'
          }`}
        >
          {message.body}
          <MessageAttachments attachments={message.attachments} mine={mine} />
        </div>

        {/* زمان */}
        <p
          className={`mt-1 text-[10px] text-gray-400 ${mine ? '' : 'text-left'}`}
        >
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── ماژول اصلی ─────────────────────────────────────────────────────── */
const TicketChat = ({ ticketId }) => {
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState([])
  const [attachmentsResetKey, setAttachmentsResetKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const bottomRef = useRef(null)
  const firstLoadRef = useRef(true)

  const load = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('bad status')
        const data = await res.json()
        setTicket(data.ticket)
        setMessages(data.messages ?? [])
        setError(false)
      } catch {
        if (!silent) setError(true)
      } finally {
        setLoading(false)
      }
    },
    [ticketId],
  )

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  // اسکرول به انتهای گفتگو بعد از اولین بارگذاری و پیام جدید
  useEffect(() => {
    if (!messages.length) return
    bottomRef.current?.scrollIntoView({
      behavior: firstLoadRef.current ? 'auto' : 'smooth',
      block: 'end',
    })
    firstLoadRef.current = false
  }, [messages.length])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!body.trim() && attachments.length === 0) {
      return toast.error('متن پیام یا حداقل یک پیوست الزامی است')
    }
    setSending(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: body.trim(), attachments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'خطا در ارسال پیام')

      setBody('')
      setAttachments([])
      setAttachmentsResetKey((k) => k + 1)
      await load(true)
    } catch (err) {
      toast.error(err.message || 'خطا در ارسال پیام')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async () => {
    const result = await Swal.fire({
      title: 'بستن تیکت',
      text: 'آیا از بستن این تیکت مطمئن هستید؟ پس از بستن امکان ارسال پیام وجود ندارد، اما می‌توانید دوباره آن را باز کنید.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'بله، بسته شود',
      cancelButtonText: 'انصراف',
    })
    if (!result.isConfirmed) return

    setStatusBusy(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'close' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'خطا در بستن تیکت')
      toast.success('تیکت بسته شد')
      await load(true)
    } catch (err) {
      toast.error(err.message || 'خطا در بستن تیکت')
    } finally {
      setStatusBusy(false)
    }
  }

  const handleReopen = async () => {
    setStatusBusy(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reopen' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'خطا در بازکردن تیکت')
      toast.success('تیکت دوباره باز شد')
      await load(true)
    } catch (err) {
      toast.error(err.message || 'خطا در بازکردن تیکت')
    } finally {
      setStatusBusy(false)
    }
  }

  /* ── بارگذاری ── */
  if (loading) {
    return (
      <div className="space-y-5" dir="rtl">
        <div className="h-7 w-56 bg-gray-100 rounded animate-pulse" />
        <div className="h-20 w-full bg-gray-100 rounded-[6px] animate-pulse" />
        <div className="space-y-3">
          <div className="h-16 w-2/3 bg-gray-100 rounded-[10px] animate-pulse" />
          <div className="h-16 w-2/3 bg-gray-100 rounded-[10px] animate-pulse mr-auto" />
        </div>
      </div>
    )
  }

  /* ── خطا / یافت نشد ── */
  if (error || !ticket) {
    return (
      <div className="space-y-5" dir="rtl">
        <Link
          href="/p-user/tickets"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#aa4725] transition-colors"
        >
          <ArrowRight size={14} />
          بازگشت به تیکت‌ها
        </Link>
        <div className="rounded-[6px] border border-dashed border-gray-200 bg-white p-12 text-center">
          <Inbox className="mx-auto mb-4 text-gray-200" size={44} strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-500">تیکت یافت نشد</p>
          <p className="text-xs text-gray-400 mt-1">
            ممکن است آدرس اشتباه باشد یا تیکت متعلق به شما نباشد
          </p>
        </div>
      </div>
    )
  }

  const statusCfg = TICKET_STATUS[ticket.status] ?? TICKET_STATUS_FALLBACK
  const StatusIcon = statusCfg.icon
  const deptCfg = TICKET_DEPARTMENT[ticket.department] ?? TICKET_DEPARTMENT_FALLBACK
  const priorityCfg = TICKET_PRIORITY[ticket.priority] ?? TICKET_PRIORITY_FALLBACK
  const isClosed = ticket.status === 'closed'
  const assignedName = senderName(ticket.assignedAdmin) || 'پشتیبانی Tenador'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
      dir="rtl"
    >
      {/* هدر */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/p-user/tickets"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#aa4725] transition-colors mb-1.5"
          >
            <ArrowRight size={14} />
            بازگشت به تیکت‌ها
          </Link>
          <h1 className="text-lg font-bold text-[#1a1a1a] tracking-tight truncate">
            {ticket.subject}
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 mt-6 ${statusCfg.badge}`}
        >
          <StatusIcon size={11} />
          {statusCfg.label}
        </span>
      </div>

      {/* اطلاعات تیکت */}
      <div className="bg-white border border-gray-100 rounded-[6px] shadow-sm px-4 py-3 flex items-center gap-2 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
          <deptCfg.icon size={11} />
          {deptCfg.label}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-full border ${priorityCfg.badge}`}
        >
          اولویت: {priorityCfg.label}
        </span>
        <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
          <Headset size={11} />
          کارشناس: {assignedName}
        </span>
        {ticket.relatedOrder && (
          <Link
            href="/p-user/orders"
            className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full hover:border-[#aa4725]/40 hover:text-[#aa4725] transition"
          >
            <Package size={11} />
            سفارش:{' '}
            <span className="font-mono" dir="ltr">
              {ticket.relatedOrder.trackingCode}
            </span>
          </Link>
        )}
        {ticket.relatedPayment && (
          <Link
            href="/p-user/payments"
            className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full hover:border-[#aa4725]/40 hover:text-[#aa4725] transition"
          >
            <CreditCard size={11} />
            پرداخت: {formatPrice(ticket.relatedPayment.amount)} تومان
          </Link>
        )}
        <span className="text-gray-400 mr-auto">
          ثبت: {formatDate(ticket.createdAt)}
        </span>
      </div>

      {/* پیام‌ها */}
      <div className="bg-[#f8fafc] border border-gray-100 rounded-[6px] p-4 space-y-4 min-h-[240px]">
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* کامپوزر / وضعیت بسته */}
      {isClosed ? (
        <div className="bg-white border border-gray-100 rounded-[6px] shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Lock size={15} className="text-gray-400" />
            این تیکت بسته شده است و امکان ارسال پیام وجود ندارد.
          </p>
          <button
            onClick={handleReopen}
            disabled={statusBusy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#aa4725] border border-[#aa4725]/30 px-4 py-2 rounded-[6px] hover:bg-[#aa4725]/5 disabled:opacity-50 transition"
          >
            {statusBusy ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <Unlock size={13} />
            )}
            بازکردن مجدد تیکت
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="bg-white border border-gray-100 rounded-[6px] shadow-sm p-4 space-y-3"
        >
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="پیام خود را بنویسید..."
            className="w-full px-3.5 py-3 rounded-[6px] border border-gray-200 bg-white text-sm text-[#1a1a1a] placeholder:text-gray-400 outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/15 transition resize-y"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <AttachmentUploader
              key={attachmentsResetKey}
              onChange={setAttachments}
              disabled={sending}
              compact
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={statusBusy || sending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-4 py-2 rounded-[6px] hover:border-red-300 hover:text-red-500 disabled:opacity-50 transition"
              >
                <Lock size={13} />
                بستن تیکت
              </button>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-1.5 bg-[#aa4725] text-white text-xs font-semibold px-5 py-2 rounded-[6px] shadow-sm hover:bg-[#8f3b1f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={13} />
                ) : (
                  <Send size={13} className="-scale-x-100" />
                )}
                ارسال پیام
              </button>
            </div>
          </div>
        </form>
      )}
    </motion.div>
  )
}

export default TicketChat
