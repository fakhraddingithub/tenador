'use client'

import { motion } from 'framer-motion'
import { FaCreditCard } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

const PaymentsModule = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/payments')
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments)
      } else toast.error('خطا در بارگذاری پرداخت‌ها')
    } catch {
      toast.error('خطا در اتصال')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'pending': return 'text-yellow-600'
      case 'failed': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'تکمیل شده'
      case 'pending': return 'در انتظار'
      case 'failed': return 'ناموفق'
      default: return status
    }
  }

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
        پرداخت‌های من
      </h1>

      {payments.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-8 text-center">
          <FaCreditCard className="mx-auto mb-3 text-3xl opacity-30" />
          <p className="text-sm text-[hsl(var(--foreground)/0.6)]">
            هیچ پرداختی ثبت نشده
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <motion.div
              key={payment._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="
                rounded-[var(--radius)]
                border border-[hsl(var(--border))]
                bg-white
                py-3
              "
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <FaCreditCard className="text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      پرداخت #{payment._id.slice(-8)}
                    </p>
                    <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                      {new Date(payment.createdAt).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <p className={`text-sm font-semibold ${getStatusColor(payment.status)}`}>
                    {getStatusText(payment.status)}
                  </p>
                  <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                    {payment.method === 'card' ? 'کارت بانکی' : payment.method}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
                <div>
                  <p className="text-xs text-[hsl(var(--foreground)/0.6)]">مبلغ</p>
                  <p className="text-sm font-semibold text-[hsl(var(--primary))]">
                    {payment.amount?.toLocaleString('fa-IR')} تومان
                  </p>
                </div>

                {payment.order && (
                  <div className="text-left">
                    <p className="text-xs text-[hsl(var(--foreground)/0.6)]">سفارش</p>
                    <p className="text-sm font-medium">
                      #{payment.order.slice(-8)}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default PaymentsModule
