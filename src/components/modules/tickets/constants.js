/**
 * src/components/modules/tickets/constants.js
 *
 * پیکربندی دپارتمان‌ها، اولویت‌ها و وضعیت‌های بخشِ «تیکت‌های پشتیبانی»
 * در داشبورد کاربر + توابع کمکی مشترک. برچسب‌های متنی از base/utils/ticketMeta
 * (منبع واحد حقیقت) می‌آیند؛ اینجا فقط آیکون و رنگِ سیستمِ طراحیِ کاربر اضافه می‌شود.
 */

import {
  Clock,
  CheckCircle2,
  MessageCircleQuestion,
  Lock,
  ShoppingBag,
  Headset,
  PackageSearch,
  MessagesSquare,
  Wrench,
  Undo2,
  Wallet,
  Minus,
  Equal,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS_USER,
} from 'base/utils/ticketMeta'

/* ─── وضعیتِ تیکت (Ticket.status) — از دیدِ کاربر ────────────────────── */
export const TICKET_STATUS = {
  open: {
    label: STATUS_LABELS_USER.open, // در انتظار پاسخ
    icon: Clock,
    badge: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',
  },
  answered: {
    label: STATUS_LABELS_USER.answered, // پاسخ داده شده
    icon: CheckCircle2,
    badge: 'bg-green-50 text-green-600 border-green-200',
    dot: 'bg-green-500',
  },
  pending_user: {
    label: STATUS_LABELS_USER.pending_user, // در انتظار پاسخ شما
    icon: MessageCircleQuestion,
    badge: 'bg-blue-50 text-blue-600 border-blue-200',
    dot: 'bg-blue-500',
  },
  closed: {
    label: STATUS_LABELS_USER.closed, // بسته شده
    icon: Lock,
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    dot: 'bg-gray-400',
  },
}

export const TICKET_STATUS_FALLBACK = TICKET_STATUS.open

/* ─── دپارتمان (Ticket.department) ───────────────────────────────────── */
export const TICKET_DEPARTMENT = {
  sales: { label: DEPARTMENT_LABELS.sales, icon: ShoppingBag },
  support: { label: DEPARTMENT_LABELS.support, icon: Headset },
  followup: { label: DEPARTMENT_LABELS.followup, icon: PackageSearch },
  consultation: { label: DEPARTMENT_LABELS.consultation, icon: MessagesSquare },
  technical: { label: DEPARTMENT_LABELS.technical, icon: Wrench },
  returns: { label: DEPARTMENT_LABELS.returns, icon: Undo2 },
  billing: { label: DEPARTMENT_LABELS.billing, icon: Wallet },
}

export const TICKET_DEPARTMENT_FALLBACK = { label: 'پشتیبانی', icon: Headset }

/* ─── اولویت (Ticket.priority) ───────────────────────────────────────── */
export const TICKET_PRIORITY = {
  low: {
    label: PRIORITY_LABELS.low,
    icon: Minus,
    badge: 'bg-gray-50 text-gray-500 border-gray-200',
  },
  medium: {
    label: PRIORITY_LABELS.medium,
    icon: Equal,
    badge: 'bg-sky-50 text-sky-600 border-sky-200',
  },
  high: {
    label: PRIORITY_LABELS.high,
    icon: ChevronUp,
    badge: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  urgent: {
    label: PRIORITY_LABELS.urgent,
    icon: AlertTriangle,
    badge: 'bg-red-50 text-red-600 border-red-200',
  },
}

export const TICKET_PRIORITY_FALLBACK = TICKET_PRIORITY.medium

/* ─── گزینه‌های فیلترِ وضعیت در لیستِ «تیکت‌های من» ──────────────────── */
export const FILTER_OPTIONS = [
  { key: 'ALL', label: 'همه' },
  { key: 'open', label: STATUS_LABELS_USER.open },
  { key: 'answered', label: STATUS_LABELS_USER.answered },
  { key: 'pending_user', label: STATUS_LABELS_USER.pending_user },
  { key: 'closed', label: STATUS_LABELS_USER.closed },
]

/* ─── Helpers ────────────────────────────────────────────────────────── */

export function formatPrice(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value ?? 0))
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند تا جستجو با هر دو صفحه‌کلید کار کند */
export function normalizeDigits(input) {
  if (input == null) return ''
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  const ar = '٠١٢٣٤٥٦٧٨٩'
  return String(input).replace(/[۰-۹٠-٩]/g, (d) => {
    const i = fa.indexOf(d)
    if (i > -1) return String(i)
    const j = ar.indexOf(d)
    if (j > -1) return String(j)
    return d
  })
}

/** نام نمایشیِ فرستنده (کاربر یا ادمین) */
export function senderName(sender) {
  if (!sender) return ''
  return [sender.name, sender.lastName].filter(Boolean).join(' ')
}

/** PDFهای خصوصی ImageKit از طریق پراکسیِ امضاشده سرو می‌شوند */
export function attachmentHref(attachment) {
  if (attachment?.type === 'pdf') {
    return `/api/files/pdf?url=${encodeURIComponent(attachment.url)}`
  }
  return attachment?.url || '#'
}

/** رشته‌ی قابل‌جستجو برای یک تیکت (موضوع، دپارتمان، کد سفارش و ...) */
export function buildSearchHaystack(ticket) {
  const parts = [
    ticket?.subject,
    TICKET_DEPARTMENT[ticket?.department]?.label,
    TICKET_STATUS[ticket?.status]?.label,
    ticket?.relatedOrder?.trackingCode,
    String(ticket?._id ?? '').slice(-8),
  ]
  return normalizeDigits(parts.filter(Boolean).join(' ')).toLowerCase()
}
