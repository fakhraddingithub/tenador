'use client'

/**
 * PaymentTimeline — خطِ زمانیِ سادهٔ چرخهٔ عمرِ پرداخت
 *
 * مراحل بر اساسِ زمان‌های موجود در داده ساخته می‌شوند (بدون داده‌ی ساختگی):
 *  ثبت پرداخت → بررسی → تأیید/رد → اعمال به سفارش
 * برای پرداختِ آنلاین مسیرِ متناسبِ خودش را نشان می‌دهد.
 */

import { Check, Clock, X, Dot } from 'lucide-react'
import { formatDateTime } from './constants'

/** state: 'done' | 'current' | 'rejected' | 'upcoming' */
function buildSteps(payment) {
  const created = payment.createdAt
  const reviewedAt = payment.bankReceipt?.reviewedAt
  const status = payment.status

  if (payment.method === 'ONLINE') {
    const paidAt = payment.onlinePayment?.paidAt
    if (status === 'FAILED') {
      return [
        { label: 'شروع پرداخت', date: created, state: 'done' },
        { label: 'پرداخت ناموفق', date: paidAt, state: 'rejected' },
      ]
    }
    return [
      { label: 'شروع پرداخت', date: created, state: 'done' },
      {
        label: 'پرداخت موفق',
        date: paidAt,
        state: status === 'PAID' ? 'done' : 'current',
      },
      {
        label: 'اعمال به سفارش',
        date: status === 'PAID' ? paidAt : null,
        state: status === 'PAID' ? 'done' : 'upcoming',
      },
    ]
  }

  // BANK_RECEIPT
  const submitted = { label: 'ثبت رسید', date: created, state: 'done' }

  if (status === 'REJECTED') {
    return [
      submitted,
      { label: 'بررسی رسید', date: reviewedAt, state: 'done' },
      { label: 'رد شد', date: reviewedAt, state: 'rejected' },
    ]
  }

  if (status === 'PAID') {
    return [
      submitted,
      { label: 'بررسی رسید', date: reviewedAt, state: 'done' },
      { label: 'تأیید شد', date: reviewedAt, state: 'done' },
      { label: 'اعمال به سفارش', date: reviewedAt, state: 'done' },
    ]
  }

  // PENDING (یا سایر)
  return [
    submitted,
    { label: 'در حال بررسی', date: null, state: 'current' },
    { label: 'تأیید / رد', date: null, state: 'upcoming' },
    { label: 'اعمال به سفارش', date: null, state: 'upcoming' },
  ]
}

const STATE_STYLE = {
  done: {
    ring: 'bg-green-500 text-white',
    line: 'bg-green-500/40',
    label: 'text-[#1a1a1a] dark:text-slate-100',
    Icon: Check,
  },
  current: {
    ring: 'bg-amber-500 text-white animate-pulse',
    line: 'bg-gray-200 dark:bg-slate-700',
    label: 'text-amber-600 dark:text-amber-400 font-semibold',
    Icon: Clock,
  },
  rejected: {
    ring: 'bg-red-500 text-white',
    line: 'bg-gray-200 dark:bg-slate-700',
    label: 'text-red-600 dark:text-red-400 font-semibold',
    Icon: X,
  },
  upcoming: {
    ring: 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500',
    line: 'bg-gray-200 dark:bg-slate-700',
    label: 'text-gray-400 dark:text-slate-500',
    Icon: Dot,
  },
}

export default function PaymentTimeline({ payment }) {
  const steps = buildSteps(payment)
  if (!steps.length) return null

  return (
    <div className="border border-gray-100 dark:border-slate-800 rounded-[6px] overflow-hidden">
      <div className="bg-gray-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-gray-100 dark:border-slate-800">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-300 uppercase tracking-wider">روند پرداخت</p>
      </div>
      <ol className="p-4 pr-5">
        {steps.map((step, idx) => {
          const style = STATE_STYLE[step.state] ?? STATE_STYLE.upcoming
          const StepIcon = style.Icon
          const isLast = idx === steps.length - 1
          return (
            <li key={idx} className="relative flex gap-3 pb-5 last:pb-0">
              {/* خطِ اتصال */}
              {!isLast && (
                <span className={`absolute right-[13px] top-7 bottom-0 w-0.5 ${style.line}`} />
              )}
              {/* نشانگر */}
              <span className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${style.ring}`}>
                <StepIcon size={14} />
              </span>
              {/* متن */}
              <div className="pt-0.5 min-w-0">
                <p className={`text-sm ${style.label}`}>{step.label}</p>
                {step.date && (
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{formatDateTime(step.date)}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
