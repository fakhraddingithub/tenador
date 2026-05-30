'use client'

import { motion } from 'framer-motion'
import { FaShoppingBag, FaEye, FaTruck } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

const OrdersModule = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders)
      } else toast.error('خطا در بارگذاری سفارش‌ها')
    } catch {
      toast.error('خطا در اتصال')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600'
      case 'processing': return 'text-blue-600'
      case 'shipped': return 'text-purple-600'
      case 'delivered': return 'text-green-600'
      case 'cancelled': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'در انتظار'
      case 'processing': return 'در حال پردازش'
      case 'shipped': return 'ارسال شده'
      case 'delivered': return 'تحویل شده'
      case 'cancelled': return 'لغو شده'
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
        <FaShoppingBag className="text-sm opacity-70" />
        سفارش‌های من
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-8 text-center">
          <FaShoppingBag className="mx-auto mb-3 text-3xl opacity-30" />
          <p className="text-sm text-[hsl(var(--foreground)/0.6)]">
            هیچ سفارشی ثبت نشده
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="
                rounded-[var(--radius)]
                border border-[hsl(var(--border))]
                bg-white
              "
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <FaShoppingBag className="text-sm" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      سفارش #{order._id.slice(-8)}
                    </p>
                    <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                      {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                </div>

                <div className="text-left">
                  <p className={`text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </p>
                  <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                    {order.totalAmount?.toLocaleString('fa-IR')} تومان
                  </p>
                </div>
              </div>

              {/* Items preview */}
              <div className="border-t border-[hsl(var(--border))] px-4 py-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {order.items?.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <img
                        src={item.product?.mainImage || '/placeholder.jpg'}
                        alt={item.product?.name}
                        className="h-11 w-11 rounded-[var(--radius)] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.product?.name}
                        </p>
                        <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                          {item.quantity} × {item.price?.toLocaleString('fa-IR')} تومان
                        </p>
                      </div>
                    </div>
                  ))}

                  {order.items?.length > 3 && (
                    <div className="flex items-center justify-center text-xs text-[hsl(var(--foreground)/0.6)]">
                      +{order.items.length - 3} محصول دیگر
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-4 py-3">
                <div className="flex gap-2">
                  <button
                    className="
                      flex items-center gap-1
                      rounded-[var(--radius)]
                      border border-[hsl(var(--border))]
                      px-3 py-1.5
                      text-xs
                      hover:bg-[hsl(var(--background))]
                    "
                  >
                    <FaEye />
                    جزئیات
                  </button>

                  {order.status === 'shipped' && (
                    <button
                      className="
                        flex items-center gap-1
                        rounded-[var(--radius)]
                        bg-[hsl(var(--primary))]
                        px-3 py-1.5
                        text-xs text-white
                        hover:bg-[hsl(var(--primary)/0.9)]
                      "
                    >
                      <FaTruck />
                      پیگیری
                    </button>
                  )}
                </div>

                <div className="text-left">
                  <p className="text-xs text-[hsl(var(--foreground)/0.6)]">مبلغ کل</p>
                  <p className="text-sm font-semibold text-[hsl(var(--primary))]">
                    {order.totalAmount?.toLocaleString('fa-IR')} تومان
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default OrdersModule
