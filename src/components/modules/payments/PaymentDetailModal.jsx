'use client'

/**
 * PaymentDetailModal — نمای کاملِ جزئیاتِ یک پرداخت
 *
 * شامل: اطلاعات پرداخت، سفارشِ مرتبط، تصویرِ رسید، پیامِ رد (در صورت وجود)،
 * و خطِ زمانی. از کامپوننت‌ها و الگوهای موجودِ داشبورد پیروی می‌کند
 * (مودالِ کشویی موبایل / کارتِ مرکزیِ دسکتاپ، هدرِ #aa4725).
 */

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  X,
  Receipt,
  CreditCard,
  ExternalLink,
  AlertOctagon,
  CalendarClock,
  Hash,
  Wallet,
  ShoppingBag,
  CircleDollarSign,
} from 'lucide-react'
import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_FALLBACK,
  ORDER_PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  PAYMENT_METHOD,
  formatPrice,
  formatDateTime,
  getReceiptImages,
  getPaymentReference,
} from './constants'
import PaymentTimeline from './PaymentTimeline'

/* ─── سطرِ کلید/مقدار ─────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, children, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
        {Icon && <Icon size={13} className="opacity-70" />}
        {label}
      </span>
      <span
        className={`text-sm font-semibold text-[#1a1a1a] text-left ${valueClass}`}
      >
        {children}
      </span>
    </div>
  )
}

/* ─── تیترِ بخش ───────────────────────────────────────────────────────── */
function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div
      className={`border border-gray-100 rounded-[6px] overflow-hidden ${className}`}
    >
      {title && (
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-[#aa4725]" />}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </p>
        </div>
      )}
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

export default function PaymentDetailModal({
  payment,
  onClose,
  onViewReceipt,
}) {
  const statusCfg = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS_FALLBACK
  const StatusIcon = statusCfg.icon
  const methodCfg = PAYMENT_METHOD[payment.method] ?? {
    label: payment.method,
    icon: CreditCard,
  }
  const MethodIcon = methodCfg.icon

  const order = payment.order
  const images = getReceiptImages(payment)
  const reference = getPaymentReference(payment)
  const reviewedAt = payment.bankReceipt?.reviewedAt
  const rejectReason = payment.bankReceipt?.rejectReason
  const isRejected = payment.status === 'REJECTED'

  const orderPayCfg = order
    ? (ORDER_PAYMENT_STATUS[order.paymentStatus] ?? ORDER_PAYMENT_STATUS.UNPAID)
    : null
  const fulCfg = order
    ? (FULFILLMENT_STATUS[order.fulfillmentStatus] ??
      FULFILLMENT_STATUS.WAITING)
    : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-[6px] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* هدر */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#aa4725] text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Receipt className="text-white/80" size={16} />
              <div>
                <p className="font-bold text-sm tracking-tight">
                  جزئیات پرداخت
                </p>
                <p className="text-white/75 text-xs font-mono mt-0.5">
                  {reference}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="بستن"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* محتوای اسکرول‌شونده */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* بج‌های وضعیت */}
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${statusCfg.badge}`}
              >
                <StatusIcon size={12} />
                {statusCfg.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                <MethodIcon size={13} />
                {methodCfg.label}
              </span>
            </div>

            {/* مبلغِ بزرگ */}
            <div className="rounded-[6px] border border-[#aa4725]/15 bg-[#aa4725]/[0.04] px-4 py-4 text-center">
              <p className="text-xs text-gray-500 mb-1">مبلغ پرداخت</p>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-2xl font-black text-[#aa4725] tracking-tight">
                  {formatPrice(payment.amount)}
                </span>
                <span className="text-xs font-bold text-[#aa4725]/70">
                  تومان
                </span>
              </div>
            </div>

            {/* اطلاعات پرداخت */}
            <SectionCard title="اطلاعات پرداخت" icon={Wallet}>
              <InfoRow icon={Hash} label="شماره مرجع">
                <span className="font-mono" dir="ltr">
                  {reference}
                </span>
              </InfoRow>
              <InfoRow icon={CalendarClock} label="تاریخ ثبت">
                {formatDateTime(payment.createdAt)}
              </InfoRow>
              {reviewedAt && (
                <InfoRow icon={CalendarClock} label="تاریخ بررسی">
                  {formatDateTime(reviewedAt)}
                </InfoRow>
              )}
              {order && order.remaining > 0 && (
                <InfoRow
                  icon={CircleDollarSign}
                  label="ماندهٔ سفارش"
                  valueClass="text-[#aa4725]"
                >
                  {formatPrice(order.remaining)} تومان
                </InfoRow>
              )}
              {payment.onlinePayment?.refId && (
                <InfoRow icon={Hash} label="شماره پیگیری درگاه">
                  <span className="font-mono" dir="ltr">
                    {payment.onlinePayment.refId}
                  </span>
                </InfoRow>
              )}
            </SectionCard>

            {/* پیامِ رد — فقط وقتی دلیلی ثبت شده باشد */}
            {isRejected && rejectReason && (
              <div className="rounded-[6px] border border-red-200 bg-red-50 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-red-100">
                  <AlertOctagon size={14} className="text-red-500" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
                    دلیل رد پرداخت
                  </p>
                </div>
                <p className="px-4 py-3 text-sm leading-relaxed text-red-700 whitespace-pre-line">
                  {rejectReason}
                </p>
              </div>
            )}

            {/* سفارشِ مرتبط */}
            {order && (
              <SectionCard title="سفارش مرتبط" icon={ShoppingBag}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-400">شماره سفارش</p>
                    <p className="font-mono text-sm font-bold text-[#1a1a1a] truncate">
                      {order.trackingCode}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {orderPayCfg && (
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${orderPayCfg.badge}`}
                      >
                        {orderPayCfg.label}
                      </span>
                    )}
                    {fulCfg && (
                      <span
                        className={`text-[11px] font-medium ${fulCfg.accent}`}
                      >
                        {fulCfg.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-50 text-center">
                  <div className="px-2 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">مبلغ کل</p>
                    <p className="text-xs font-bold text-[#1a1a1a]">
                      {formatPrice(order.totalPrice)}
                    </p>
                  </div>
                  <div className="px-2 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">پرداخت‌شده</p>
                    <p className="text-xs font-bold text-green-600">
                      {formatPrice(order.paidAmount)}
                    </p>
                  </div>
                  <div className="px-2 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">مانده</p>
                    <p
                      className={`text-xs font-bold ${order.remaining > 0 ? 'text-[#aa4725]' : 'text-green-600'}`}
                    >
                      {formatPrice(order.remaining)}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/p-user/orders?order=${order.trackingCode}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-[#aa4725] hover:bg-[#aa4725]/[0.06] transition-colors"
                >
                  <ExternalLink size={13} />
                  مشاهدهٔ جزئیات سفارش
                </Link>
              </SectionCard>
            )}

            {/* تصویرِ رسید */}
            {images.length > 0 && (
              <SectionCard title="تصویر رسید" icon={Receipt}>
                <div
                  className={`grid gap-2 p-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}
                >
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => onViewReceipt(images, idx)}
                      className="group relative rounded-[6px] overflow-hidden border border-gray-200 hover:border-[#aa4725] transition aspect-video bg-gray-100"
                    >
                      <img
                        src={url}
                        alt={`رسید ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <ExternalLink
                          size={18}
                          className="text-white opacity-0 group-hover:opacity-100 transition drop-shadow"
                        />
                      </div>
                      {images.length > 1 && (
                        <span className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {idx + 1}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* خط زمانی */}
            <PaymentTimeline payment={payment} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
