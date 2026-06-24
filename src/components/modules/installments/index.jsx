'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  FaCreditCard,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaTimesCircle,
  FaChevronDown,
} from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
const faDate = (d) => (d ? new Date(d).toLocaleDateString('fa-IR') : '—')

// وضعیت کلیِ یک طرح اقساط
const PLAN_STATUS = {
  PENDING: { text: 'در انتظار تأیید', color: 'text-amber-600', bg: 'bg-amber-50', icon: FaClock },
  ACTIVE: { text: 'در حال پرداخت', color: 'text-blue-600', bg: 'bg-blue-50', icon: FaCreditCard },
  OVERDUE: { text: 'سررسید گذشته', color: 'text-red-600', bg: 'bg-red-50', icon: FaExclamationTriangle },
  COMPLETED: { text: 'تکمیل شده', color: 'text-green-600', bg: 'bg-green-50', icon: FaCheckCircle },
  DEFAULTED: { text: 'چک برگشتی', color: 'text-red-600', bg: 'bg-red-50', icon: FaTimesCircle },
}

// وضعیت هر چک
const CHECK_STATUS = {
  PENDING: { text: 'در انتظار', color: 'text-amber-600', dot: 'bg-amber-400' },
  OVERDUE: { text: 'سررسید گذشته', color: 'text-red-600', dot: 'bg-red-500' },
  CLEARED: { text: 'پاس شده', color: 'text-green-600', dot: 'bg-green-500' },
  BOUNCED: { text: 'برگشت خورده', color: 'text-red-600', dot: 'bg-red-500' },
}

const InstallmentsModule = () => {
  const [installments, setInstallments] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/installments')
        if (res.ok) {
          const data = await res.json()
          setInstallments(data.installments || [])
        } else toast.error('خطا در بارگذاری اقساط')
      } catch {
        toast.error('خطا در اتصال')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <FaCreditCard className="text-sm opacity-70" />
        اقساط و چک‌ها
      </h1>

      {installments.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-8 text-center text-sm opacity-60">
          <FaCreditCard className="mx-auto mb-3 text-3xl opacity-30" />
          طرح اقساطی ثبت نشده است
        </div>
      ) : (
        <div className="space-y-3">
          {installments.map((inst) => {
            const meta = PLAN_STATUS[inst.derivedStatus] || PLAN_STATUS.PENDING
            const Icon = meta.icon
            const isOpen = openId === inst._id
            const progress =
              inst.numberOfChecks > 0
                ? Math.round((inst.paidChecksCount / inst.numberOfChecks) * 100)
                : 0

            return (
              <motion.div
                key={inst._id}
                layout
                className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => setOpenId(isOpen ? null : inst._id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-right"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                      <Icon className={`text-sm ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        سفارش {inst.order?.trackingCode || `#${String(inst.order?._id).slice(-8)}`}
                      </p>
                      <p className="text-[11px] opacity-60">
                        {inst.numberOfChecks} قسط · پرداخت‌شده {fa(inst.paidChecksCount)} از {fa(inst.numberOfChecks)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-left">
                      <p className={`text-xs font-medium ${meta.color}`}>{meta.text}</p>
                      <p className="text-sm font-semibold text-[hsl(var(--primary))]">
                        {fa(inst.remainingAmount)}
                        <span className="mr-1 text-[10px] font-normal opacity-70">تومان مانده</span>
                      </p>
                    </div>
                    <FaChevronDown
                      className={`text-xs opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Progress bar */}
                <div className="px-4 pb-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Expanded: checks list */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[hsl(var(--border))] bg-gray-50/50"
                    >
                      <div className="p-4 space-y-3">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                          <div className="rounded-lg bg-white p-2 border border-[hsl(var(--border))]">
                            <p className="opacity-60 mb-0.5">پیش‌پرداخت</p>
                            <p className="font-semibold">{fa(inst.downPayment?.amount)}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2 border border-[hsl(var(--border))]">
                            <p className="opacity-60 mb-0.5">مجموع چک‌ها</p>
                            <p className="font-semibold">{fa(inst.paidAmount + inst.remainingAmount - (inst.downPayment?.paid ? inst.downPayment.amount : 0))}</p>
                          </div>
                          <div className="rounded-lg bg-white p-2 border border-[hsl(var(--border))]">
                            <p className="opacity-60 mb-0.5">سررسید بعدی</p>
                            <p className="font-semibold">{faDate(inst.nextDueDate)}</p>
                          </div>
                        </div>

                        {/* Checks */}
                        <div className="space-y-2">
                          {inst.checks.map((c) => {
                            const cs = CHECK_STATUS[c.displayStatus] || CHECK_STATUS.PENDING
                            return (
                              <div
                                key={c._id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 border border-[hsl(var(--border))]"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cs.dot}`} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">قسط {fa(c.number)}</p>
                                    <p className="text-[11px] opacity-60">سررسید {faDate(c.dueDate)}</p>
                                  </div>
                                </div>
                                <div className="text-left flex-shrink-0">
                                  <p className="text-xs font-semibold">{fa(c.amount)} <span className="text-[10px] opacity-60">تومان</span></p>
                                  <p className={`text-[11px] font-medium ${cs.color}`}>{cs.text}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <p className="text-[10px] opacity-50 text-center pt-1">
                          چک‌ها توسط فروشگاه بررسی و تأیید می‌شوند. در صورت سررسید گذشته، لطفاً با پشتیبانی تماس بگیرید.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export default InstallmentsModule
