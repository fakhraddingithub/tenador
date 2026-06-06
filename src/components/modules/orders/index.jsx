'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  FaShoppingBag, FaTruck, FaCheckCircle, FaTimesCircle,
  FaClock, FaSpinner, FaTrash, FaReceipt, FaMapMarkerAlt,
  FaTimes, FaChevronDown
} from 'react-icons/fa'
import { MdOutlinePayment, MdOutlineConfirmationNumber } from 'react-icons/md'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import OrderFlowSelectionsView from '@/components/order/OrderFlowSelectionsView'

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatPrice(price) {
  return new Intl.NumberFormat('fa-IR').format(Number(price ?? 0))
}

function splitName(text) {
  if (!text) return { farsi: '', english: '' }
  const match = text.match(/[a-zA-Z(].*/)
  if (match) {
    return { farsi: text.substring(0, match.index).trim(), english: match[0].trim() }
  }
  return { farsi: text, english: '' }
}

const PAYMENT_STATUS = {
  UNPAID:          { label: 'پرداخت نشده',      color: 'bg-red-50 text-red-600 border-red-200',        icon: FaTimesCircle },
  PARTIALLY_PAID:  { label: 'پرداخت جزئی',      color: 'bg-amber-50 text-amber-600 border-amber-200',  icon: FaClock },
  PAID:            { label: 'پرداخت شده',        color: 'bg-green-50 text-green-600 border-green-200',  icon: FaCheckCircle },
}

const FULFILLMENT_STATUS = {
  PENDING:    { label: 'در انتظار',      color: 'text-gray-500' },
  PROCESSING: { label: 'در حال پردازش', color: 'text-blue-600' },
  SHIPPED:    { label: 'ارسال شده',      color: 'text-purple-600' },
  DELIVERED:  { label: 'تحویل شده',     color: 'text-green-600' },
  CANCELLED:  { label: 'لغو شده',       color: 'text-red-500' },
}

const PAYMENT_METHOD = {
  ONLINE:       'پرداخت آنلاین',
  BANK_RECEIPT: 'فیش بانکی',
  INSTALLMENT:  'اقساطی',
}

/* ─── OrderDetailModal ─────────────────────────────────────────────── */

function OrderDetailModal({ order, onClose }) {
  const addressSnap = order.address?.snapshot ?? {}
  const payStatus   = PAYMENT_STATUS[order.paymentStatus] ?? PAYMENT_STATUS.UNPAID
  const fulStatus   = FULFILLMENT_STATUS[order.fulfillmentStatus] ?? FULFILLMENT_STATUS.PENDING
  const PayIcon     = payStatus.icon

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
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#aa4725] text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <FaReceipt className="text-white/80 text-sm" />
              <div>
                <p className="font-bold text-sm tracking-tight">جزئیات سفارش</p>
                <p className="text-white/75 text-xs font-mono mt-0.5">{order.trackingCode}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">

            {/* وضعیت */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${payStatus.color}`}>
                <PayIcon className="text-[11px]" />
                {payStatus.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 ${fulStatus.color}`}>
                {fulStatus.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                <MdOutlinePayment className="text-sm" />
                {PAYMENT_METHOD[order.paymentMethod] ?? order.paymentMethod}
              </span>
            </div>

            {/* اقلام */}
            <div className="border border-gray-100 rounded-[6px] overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">اقلام سفارش</p>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items?.map((item, idx) => {
                  const name  = item.product?.name ?? ''
                  const image = item.product?.mainImage ?? ''
                  const { farsi, english } = splitName(name)
                  const variantAttrs = item.variant?.attributes ?? null
                  const total = (item.unitPrice ?? 0) * (item.quantity ?? 1)

                  return (
                    <div key={item.product?._id ?? idx} className="flex gap-3 px-4 py-3">
                      {image && (
                        <img src={image} alt={name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div>
                          {farsi && <p className="text-sm font-bold text-[#1a1a1a] leading-snug tracking-tight line-clamp-1">{farsi}</p>}
                          {english && <span className="text-xs font-semibold text-gray-500 tracking-tight" dir="ltr">{english}</span>}
                          {!farsi && !english && name && <p className="text-sm font-bold text-[#1a1a1a] line-clamp-1">{name}</p>}
                        </div>
                        {variantAttrs && Object.keys(variantAttrs).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(variantAttrs).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-[#aa4725]/8 text-[#aa4725] border border-[#aa4725]/20 px-2 py-0.5 rounded-full">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.flowSelections?.length > 0 && (
                          <OrderFlowSelectionsView flowSelections={item.flowSelections} />
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[11px] text-gray-400">{item.quantity} × {formatPrice(item.unitPrice)} ت</span>
                          <span className="text-sm font-bold text-[#1a1a1a] tracking-tight">
                            {formatPrice(total)} <span className="text-[10px] font-medium text-gray-400">تومان</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* قیمت */}
            <div className="border border-gray-100 rounded-[6px] overflow-hidden">
              <div className="divide-y divide-gray-50 text-sm">
                {(order.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between px-4 py-2.5 text-emerald-600">
                    <span className="text-gray-500">تخفیف</span>
                    <span className="font-medium">− {formatPrice(order.discountAmount)} تومان</span>
                  </div>
                )}
                {(order.couponDiscount ?? 0) > 0 && (
                  <div className="flex justify-between px-4 py-2.5 text-emerald-600">
                    <span className="text-gray-500">تخفیف کد «{order.coupon?.code}»</span>
                    <span className="font-medium">− {formatPrice(order.couponDiscount)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 bg-gray-50">
                  <span className="font-bold text-[#1a1a1a]">مبلغ کل</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-[#aa4725] tracking-tight">{formatPrice(order.totalPrice)}</span>
                    <span className="text-[11px] font-bold text-[#aa4725]/60">تومان</span>
                  </div>
                </div>
              </div>
            </div>

            {/* آدرس */}
            {addressSnap.fullName && (
              <div className="border border-gray-100 rounded-[6px] overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5">
                  <FaMapMarkerAlt className="text-[#aa4725] text-xs" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">آدرس تحویل</p>
                </div>
                <div className="px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 flex-shrink-0 text-xs mt-0.5">گیرنده:</span>
                    <span className="font-semibold text-[#1a1a1a] text-sm">{addressSnap.fullName}</span>
                  </div>
                  {addressSnap.phone && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-20 flex-shrink-0 text-xs mt-0.5">تلفن:</span>
                      <span className="text-[#1a1a1a] font-mono text-sm">{addressSnap.phone}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 flex-shrink-0 text-xs mt-0.5">آدرس:</span>
                    <span className="text-[#1a1a1a] leading-relaxed text-sm">{addressSnap.addressLine}</span>
                  </div>
                  {addressSnap.postalCode && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-20 flex-shrink-0 text-xs mt-0.5">کد پستی:</span>
                      <span className="text-[#1a1a1a] font-mono text-sm">{addressSnap.postalCode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* تاریخ */}
            <p className="text-center text-xs text-gray-400">
              ثبت سفارش:{' '}
              {new Date(order.createdAt).toLocaleDateString('fa-IR', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </p>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ─── OrderCard ────────────────────────────────────────────────────── */

function OrderCard({ order, onDelete, onViewDetail }) {
  const [expanded, setExpanded] = useState(false)
  const payStatus = PAYMENT_STATUS[order.paymentStatus] ?? PAYMENT_STATUS.UNPAID
  const fulStatus = FULFILLMENT_STATUS[order.fulfillmentStatus] ?? FULFILLMENT_STATUS.PENDING
  const PayIcon   = payStatus.icon
  const canDelete = order.paymentStatus === 'UNPAID'
  const previewItems = order.items?.slice(0, 3) ?? []
  const extraCount   = (order.items?.length ?? 0) - 3

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-[6px] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* ── Top bar: tracking + statuses ── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[6px] bg-[#aa4725]/10 flex items-center justify-center flex-shrink-0">
            <FaShoppingBag className="text-[#aa4725] text-sm" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <MdOutlineConfirmationNumber className="text-gray-400 text-sm flex-shrink-0" />
              <span className="font-mono text-sm font-bold text-[#1a1a1a] tracking-tight truncate">
                {order.trackingCode}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(order.createdAt).toLocaleDateString('fa-IR', {
                year: 'numeric', month: 'short', day: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* وضعیت‌ها */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${payStatus.color}`}>
            <PayIcon className="text-[10px]" />
            {payStatus.label}
          </span>
          <span className={`text-[11px] font-medium ${fulStatus.color}`}>
            {fulStatus.label}
          </span>
        </div>
      </div>

      {/* ── محصولات preview ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {previewItems.map((item, idx) => {
            const name    = item.product?.name ?? ''
            const image   = item.product?.mainImage ?? ''
            const { farsi, english } = splitName(name)
            const variantAttrs = item.variant?.attributes ?? null

            return (
              <div key={item.product?._id ?? idx} className="flex items-center gap-2 bg-gray-50 rounded-[6px] px-2.5 py-1.5 min-w-0 max-w-full sm:max-w-[calc(50%-4px)]">
                {image && (
                  <img src={image} alt={name}
                    className="w-9 h-9 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1a1a1a] leading-tight truncate tracking-tight">
                    {farsi || english || name}
                  </p>
                  {variantAttrs && Object.keys(variantAttrs).length > 0 && (
                    <p className="text-[10px] text-[#aa4725] truncate mt-0.5">
                      {Object.entries(variantAttrs).map(([k, v]) => `${k}: ${v}`).join(' / ')}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">× {item.quantity}</p>
                </div>
              </div>
            )
          })}
          {extraCount > 0 && (
            <div className="bg-gray-50 rounded-[6px] px-3 py-1.5 text-xs text-gray-500 font-medium flex-shrink-0">
              +{extraCount} کالا
            </div>
          )}
        </div>
      </div>

      {/* ── روش پرداخت + قیمت ── */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
          <MdOutlinePayment className="text-xs" />
          {PAYMENT_METHOD[order.paymentMethod] ?? order.paymentMethod}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-[#aa4725] tracking-tight">
            {formatPrice(order.totalPrice)}
          </span>
          <span className="text-[11px] font-bold text-[#aa4725]/60">تومان</span>
        </div>
      </div>

      {/* ── Footer: actions ── */}
      <div className="border-t border-gray-50 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* دکمه جزئیات */}
          <button
            onClick={() => onViewDetail(order)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[6px] bg-[#aa4725] text-white hover:bg-[#933d1f] transition-colors"
          >
            <FaReceipt className="text-[10px]" />
            جزئیات
          </button>

          {/* دکمه پرداخت — اگر پرداخت نشده */}
          {order.paymentStatus === 'UNPAID' && (
            <a
              href={`/p-user/payments/${order.trackingCode}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[6px] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <MdOutlinePayment className="text-sm" />
              پرداخت
            </a>
          )}

          {/* پیگیری ارسال */}
          {order.fulfillmentStatus === 'SHIPPED' && (
            <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[6px] border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors">
              <FaTruck className="text-[10px]" />
              پیگیری
            </button>
          )}
        </div>

        {/* حذف — فقط اگر UNPAID */}
        {canDelete && (
          <button
            onClick={() => onDelete(order._id, order.trackingCode)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-2 rounded-[6px] border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <FaTrash className="text-[10px]" />
            حذف
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ─── OrdersModule ─────────────────────────────────────────────────── */

const FILTER_OPTIONS = [
  { key: 'ALL',      label: 'همه' },
  { key: 'UNPAID',   label: 'پرداخت نشده' },
  { key: 'PAID',     label: 'پرداخت شده' },
  { key: 'PARTIALLY_PAID', label: 'جزئی' },
]

const OrdersModule = () => {
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [detailOrder,  setDetailOrder]  = useState(null)

  useEffect(() => { fetchOrders() }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      } else {
        toast.error('خطا در بارگذاری سفارش‌ها')
      }
    } catch {
      toast.error('خطا در اتصال')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (orderId, trackingCode) => {
    const result = await Swal.fire({
      title:    'حذف سفارش؟',
      html:     `<p style="font-family:Vazirmatn,sans-serif;direction:rtl;font-size:14px;color:#555;">سفارش <strong style="color:#aa4725">${trackingCode}</strong> حذف شود؟<br>این عمل قابل بازگشت نیست.</p>`,
      icon:     'warning',
      showCancelButton: true,
      confirmButtonText:  'بله، حذف شود',
      cancelButtonText:   'انصراف',
      confirmButtonColor: '#aa4725',
      cancelButtonColor:  '#6b7280',
      reverseButtons: true,
    })
    if (!result.isConfirmed) return

    try {
      const res = await fetch(`/api/orders/${trackingCode}`, {
        method:      'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o._id !== orderId))
        toast.success('سفارش با موفقیت حذف شد')
      } else {
        const data = await res.json()
        toast.error(data.message ?? 'خطا در حذف سفارش')
      }
    } catch {
      toast.error('خطا در اتصال')
    }
  }

  const filtered = activeFilter === 'ALL'
    ? orders
    : orders.filter((o) => o.paymentStatus === activeFilter)

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#aa4725] border-t-transparent" />
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#1a1a1a] tracking-tight">
            <FaShoppingBag className="text-[#aa4725] text-base" />
            سفارش‌های من
            {orders.length > 0 && (
              <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            )}
          </h1>

          {/* Filters */}
          {orders.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150 ${
                    activeFilter === f.key
                      ? 'bg-[#aa4725] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty State */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[6px] border border-dashed border-gray-200 bg-white p-12 text-center"
          >
            <FaShoppingBag className="mx-auto mb-4 text-4xl text-gray-200" />
            <p className="text-sm font-medium text-gray-400">
              {activeFilter === 'ALL'
                ? 'هیچ سفارشی ثبت نشده'
                : 'سفارشی با این وضعیت یافت نشد'}
            </p>
            {activeFilter !== 'ALL' && (
              <button
                onClick={() => setActiveFilter('ALL')}
                className="mt-3 text-xs text-[#aa4725] hover:underline"
              >
                نمایش همه سفارشات
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-4">
            {filtered.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onDelete={handleDelete}
                onViewDetail={setDetailOrder}
              />
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Detail Modal */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </>
  )
}

export default OrdersModule