/**
 * src/components/modules/payments/constants.js
 *
 * پیکربندی وضعیت‌ها، روش‌ها و توابع کمکیِ مشترکِ بخشِ «پرداخت‌های من».
 * رنگ‌ها و برچسب‌ها دقیقاً هم‌راستا با سیستم طراحیِ سفارش‌ها/پنل ادمین است
 * (بج‌های وضعیت، رنگ اصلی #aa4725).
 */

import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  Receipt,
} from 'lucide-react'

/* ─── وضعیتِ پرداخت (Payment.status) ─────────────────────────────────── */
export const PAYMENT_STATUS = {
  PENDING: {
    label: 'در انتظار بررسی',
    icon: Clock,
    badge: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',
    accent: 'text-amber-600',
  },
  PAID: {
    label: 'تأیید شده',
    icon: CheckCircle2,
    badge: 'bg-green-50 text-green-600 border-green-200',
    dot: 'bg-green-500',
    accent: 'text-green-600',
  },
  REJECTED: {
    label: 'رد شده',
    icon: XCircle,
    badge: 'bg-red-50 text-red-600 border-red-200',
    dot: 'bg-red-500',
    accent: 'text-red-600',
  },
  FAILED: {
    label: 'ناموفق',
    icon: AlertTriangle,
    badge: 'bg-rose-50 text-rose-600 border-rose-200',
    dot: 'bg-rose-500',
    accent: 'text-rose-600',
  },
}

export const PAYMENT_STATUS_FALLBACK = PAYMENT_STATUS.PENDING

/* ─── وضعیتِ پرداختِ سفارش (Order.paymentStatus) — برای بخش «سفارش مرتبط» ── */
export const ORDER_PAYMENT_STATUS = {
  UNPAID: {
    label: 'پرداخت نشده',
    badge: 'bg-red-50 text-red-600 border-red-200',
  },
  PARTIALLY_PAID: {
    label: 'پرداخت جزئی',
    badge: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  PAID: {
    label: 'پرداخت شده',
    badge: 'bg-green-50 text-green-600 border-green-200',
  },
}

/* ─── وضعیتِ آماده‌سازی سفارش (Order.fulfillmentStatus) ──────────────── */
export const FULFILLMENT_STATUS = {
  WAITING: { label: 'در انتظار', accent: 'text-gray-500' },
  NEEDS_PURCHASE: { label: 'در انتظار خرید', accent: 'text-amber-600' },
  PROCESSING: { label: 'در حال پردازش', accent: 'text-blue-600' },
  SENT: { label: 'ارسال شده', accent: 'text-purple-600' },
  DELIVERED: { label: 'تحویل شده', accent: 'text-teal-600' },
  CANCELED: { label: 'لغو شده', accent: 'text-red-500' },
}

/* ─── روشِ پرداخت (Payment.method) ───────────────────────────────────── */
export const PAYMENT_METHOD = {
  ONLINE: { label: 'پرداخت آنلاین', icon: CreditCard },
  BANK_RECEIPT: { label: 'فیش بانکی', icon: Receipt },
}

/* ─── گزینه‌های فیلترِ وضعیت ─────────────────────────────────────────── */
export const FILTER_OPTIONS = [
  { key: 'ALL', label: 'همه' },
  { key: 'PENDING', label: 'در انتظار بررسی' },
  { key: 'PAID', label: 'تأیید شده' },
  { key: 'REJECTED', label: 'رد شده' },
  { key: 'FAILED', label: 'ناموفق' },
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

/** تصاویرِ رسید را (چه آرایه‌ی جدید imageUrls چه تکیِ قدیمی imageUrl) نرمال می‌کند */
export function getReceiptImages(payment) {
  const arr = payment?.bankReceipt?.imageUrls
  if (Array.isArray(arr) && arr.length) return arr.filter(Boolean)
  const single = payment?.bankReceipt?.imageUrl
  return single ? [single] : []
}

/** شماره‌ی مرجع/پیگیریِ نمایشیِ پرداخت */
export function getPaymentReference(payment) {
  if (payment?.onlinePayment?.refId) return payment.onlinePayment.refId
  return `PAY-${String(payment?._id ?? '')
    .slice(-8)
    .toUpperCase()}`
}

/** رشته‌ی قابل‌جستجو برای یک پرداخت (شماره سفارش، مرجع، مبلغ و ...) */
export function buildSearchHaystack(payment) {
  const parts = [
    payment?.order?.trackingCode,
    payment?.onlinePayment?.refId,
    getPaymentReference(payment),
    String(payment?._id ?? ''),
    String(payment?.amount ?? ''),
    formatPrice(payment?.amount),
  ]
  return normalizeDigits(parts.filter(Boolean).join(' ')).toLowerCase()
}
