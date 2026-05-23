'use client'

import { motion } from 'framer-motion'
import {
  FaShoppingCart,
  FaPlus,
  FaMinus,
  FaTrash,
  FaCreditCard,
  FaSpinner,
} from 'react-icons/fa'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import { useRouter } from 'next/navigation'

import {
  getCart,
  updateQuantity,
  removeFromCart,
} from '@/lib/cart'

const CartModule = () => {
  const [cart, setCart] = useState([])
  const [pricingData, setPricingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchCart = useCallback(async () => {
    setLoading(true)
    try {
      const rawCart = getCart()

      if (rawCart.length === 0) {
        setCart([])
        setPricingData(null)
        setLoading(false)
        return
      }

      // دریافت اطلاعات نمایشی و قیمت از سرور
      const [productsRes, priceRes] = await Promise.all([
        fetch('/api/cart/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: rawCart }),
        }),
        fetch('/api/cart/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: rawCart }),
        }),
      ])

      if (!productsRes.ok || !priceRes.ok) throw new Error('خطا در دریافت اطلاعات')

      const productsData = await productsRes.json()
      const priceData = await priceRes.json()

      setPricingData(priceData)

      const priceMap = new Map(
        (priceData.items || []).map((p) => [
          `${p.productId}-${p.variantId ?? 'null'}`,
          p,
        ])
      )

      const enriched = (productsData.items || []).map((item) => {
        const key = `${item.productId}-${item.variantId ?? 'null'}`
        const priceItem = priceMap.get(key)
        return {
          ...item,
          unitPriceToman: priceItem?.unitPriceToman ?? item.displayPriceToman,
          itemFinalPrice: priceItem?.itemFinalToman ?? (item.displayPriceToman * item.quantity),
          discountToman: priceItem?.discountToman ?? 0,
        }
      })

      setCart(enriched)
    } catch (e) {
      console.error('[CartModule]', e)
      toast.error('خطا در بارگذاری سبد خرید')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const handleUpdateQuantity = (item, delta) => {
    const newQuantity = Math.max(1, item.quantity + delta)
    updateQuantity(item.productId, item.variantId, newQuantity)
    fetchCart()
  }

  const handleRemoveFromCart = async (item) => {
    const result = await Swal.fire({
      title: 'حذف از سبد خرید',
      text: 'آیا مطمئن هستید؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'حذف',
      cancelButtonText: 'لغو',
    })

    if (result.isConfirmed) {
      removeFromCart(item.productId, item.variantId)
      fetchCart()
      toast.success('حذف شد')
    }
  }

  // قیمت نهایی از سرور
  const totalAmount = pricingData?.grandTotalToman
    ?? cart.reduce((sum, item) => sum + item.itemFinalPrice, 0)

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
        <FaShoppingCart className="text-sm opacity-70" />
        سبد خرید
      </h1>

      {cart.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-8 text-center">
          <FaShoppingCart className="mx-auto mb-3 text-3xl opacity-30" />

          <p className="text-sm text-[hsl(var(--foreground)/0.6)]">
            سبد خرید شما خالی است
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Items */}
          {cart.map((item) => (
            <motion.div
              key={`${item.productId}-${item.variantId || 'no-variant'}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="
                flex items-center gap-4
                rounded-[var(--radius)]
                border border-[hsl(var(--border))]
                bg-white p-4
              "
            >
              {/* تصویر */}
              <img
                src={item.product?.mainImage || '/placeholder.jpg'}
                alt={item.product?.name || 'product'}
                className="h-16 w-16 rounded-[var(--radius)] object-cover"
              />

              {/* اطلاعات */}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {item.product?.name || 'محصول'}
                </p>

                {item.variant && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(item.variant.attributes || {}).map(([k, v]) => (
                      <span key={k} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* قیمت واحد از سرور */}
                <p className="text-xs text-[hsl(var(--foreground)/0.6)]">
                  {item.unitPriceToman.toLocaleString('fa-IR')} تومان
                </p>
              </div>

              {/* تعداد */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleUpdateQuantity(item, -1)}
                  className="
                    rounded-[var(--radius)]
                    border
                    px-2 py-1
                    text-xs
                    hover:bg-[hsl(var(--border)/0.5)]
                  "
                >
                  {item.quantity === 1 ? <FaTrash className="text-red-500" /> : <FaMinus />}
                </button>

                <span className="min-w-[32px] text-center text-sm">
                  {item.quantity}
                </span>

                <button
                  onClick={() => handleUpdateQuantity(item, 1)}
                  disabled={!item.inStock}
                  className="
                    rounded-[var(--radius)]
                    border
                    px-2 py-1
                    text-xs
                    hover:bg-[hsl(var(--border)/0.5)]
                    disabled:opacity-40
                  "
                >
                  <FaPlus />
                </button>
              </div>

              {/* قیمت نهایی آیتم */}
              <div className="text-left">
                <p className="text-sm font-semibold text-[hsl(var(--primary))]">
                  {item.itemFinalPrice.toLocaleString('fa-IR')}
                  {' '}
                  تومان
                </p>

                <button
                  onClick={() => handleRemoveFromCart(item)}
                  className="
                    mt-1 flex items-center gap-1
                    text-xs text-red-600
                    hover:underline
                  "
                >
                  <FaTrash />
                  حذف
                </button>
              </div>
            </motion.div>
          ))}

          {/* خلاصه */}
          <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-white p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span>مجموع</span>

              <span className="font-semibold text-[hsl(var(--primary))]">
                {totalAmount.toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <button
              onClick={() => router.push('/p-user/signOrder')}
              className="
                flex w-full items-center justify-center gap-2
                rounded-[var(--radius)]
                bg-[hsl(var(--primary))]
                py-2.5 text-sm text-white
                hover:bg-[hsl(var(--primary)/0.9)]
              "
            >
              <FaCreditCard className="text-xs" />
              تسویه حساب
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default CartModule
