'use client';

/**
 * src/components/order/OrderActions.jsx
 *
 * دکمه ثبت سفارش — قیمت از سرور تأیید می‌شود
 * کلاینت فقط آیتم‌ها، آدرس و روش پرداخت را ارسال می‌کند
 */

import { useState } from 'react';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { clearCart } from '@/lib/cart';

function formatToman(amount) {
  if (!amount && amount !== 0) return '—';
  return Number(amount).toLocaleString('fa-IR') + ' تومان';
}

const OrderActions = ({
  cartItems,           // [{ productId, variantId?, usedProductId?, itemType, quantity }]
  finalTotalToman,     // مبلغ نمایشی (از سرور)
  selectedAddress,
  selectedPaymentMethod,
  couponCode,
  onSuccess,           // (trackingCode: string) => void
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  
  const validateOrder = () => {
    if (!cartItems?.length) {
      toast.error('سبد خرید شما خالی است');
      return false;
    }
    if (!selectedAddress) {
      toast.error('لطفاً آدرس تحویل را انتخاب کنید');
      return false;
    }
    if (!selectedPaymentMethod) {
      toast.error('لطفاً روش پرداخت را انتخاب کنید');
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    if (!validateOrder()) return;

    const result = await Swal.fire({
      title: 'تایید ثبت سفارش',
      html: `
        <div style="text-align:right; direction:rtl; font-family:var(--font-sans);">
          <p style="font-size:16px; color:var(--foreground)">آیا از ثبت سفارش اطمینان دارید؟</p>
          <p style="margin-top:12px; font-size:14px; color:#666; background:rgba(170, 71, 37, 0.05); padding:10px; border-radius:8px; border:1px dashed var(--color-primary);">
            مبلغ قابل پرداخت:
            <strong style="color:var(--color-primary); font-size:16px">
              ${formatToman(finalTotalToman)}
            </strong>
          </p>
          <p style="margin-top:8px; font-size:12px; color:#999;">
            قیمت نهایی پس از ثبت سفارش توسط سرور تأیید خواهد شد
          </p>
        </div>
      `,
      icon: 'question',
      iconColor: 'var(--color-primary)',
      showCancelButton: true,
      confirmButtonText: 'بله، ثبت شود',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#aa4725',
      cancelButtonColor: '#9ca3af',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg px-6 py-2',
        cancelButton: 'rounded-lg px-6 py-2',
      },
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);

    try {
      // ─── آماده‌سازی هوشمند و اصلاح‌شده آیتم‌ها برای ارسال به سرور ───
      const preparedItems = cartItems.map((item) => {
        // تشخیص همه‌جانبه دست‌دوم بودن آیتم از روی ساختار سبد خرید فرانت‌اند
        const isUsed = 
          item.itemType === 'used_product' || 
          item.itemType === 'used' || 
          item.isUsed === true || 
          !!item.usedProductId;

        if (isUsed) {
          // در حالت دست‌دوم، آی‌دی محصول دست‌دوم را استخراج کرده و تایپ را دقیقاً "used_product" می‌فرستیم
          return {
            usedProductId: item.usedProductId || item.productId || item._id, 
            itemType: 'used_product',
            quantity: 1, // محصولات دست‌دوم همیشه ۱ عدد هستند
          };
        }

        // محصولات معمولی
        return {
          productId: item.productId || item._id || null,
          variantId: item.variantId || null,
          itemType: 'product',
          quantity: item.quantity || 1,
          flowSelections: item.flowSelections ?? [],
        };
      });

      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: preparedItems,
          // اگر آدرس ذخیره‌شده باشه _id داره، اگر موقت باشه snapshot میفرستیم
          addressId:       selectedAddress._id || null,
          addressSnapshot: !selectedAddress._id ? selectedAddress : null,
          paymentMethod:   selectedPaymentMethod,
          couponCode:      couponCode || null,
          description:     description || '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'خطا در ثبت سفارش');
      }

      // لایه محافظتی برای اطمینان از وجود تراکینگ کد
      if (!data?.order?.trackingCode) {
        throw new Error('کد پیگیری سفارش از سرور دریافت نشد، اما سفارش ممکن است ثبت شده باشد.');
      }

      toast.success('سفارش با موفقیت ثبت شد');
      clearCart();
      onSuccess(data.order.trackingCode, data.order);

      // برای پرداخت آنلاین
      if (selectedPaymentMethod === 'ONLINE' && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'خطا در ثبت سفارش');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady =
    cartItems?.length > 0 && selectedAddress && selectedPaymentMethod;

  return (
    <aside
      className="
        rounded-2xl border border-slate-200
        bg-white p-5 md:p-6
        shadow-lg shadow-slate-200/40
        space-y-6
      "
    >
      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">
          توضیحات سفارش (اختیاری)
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="اگر توضیح خاصی برای سفارش دارید، اینجا بنویسید..."
          maxLength={500}
          className="
            w-full min-h-[120px] resize-none
            rounded-xl border border-[var(--color-primary)]/30
            bg-[var(--color-primary)]/5 p-4 text-sm text-slate-800
            placeholder:text-slate-500
            focus:border-[var(--color-primary)]/30 focus:bg-white
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30
            transition
          "
        />

        <p className="text-xs text-slate-400 text-left">
          {description.length}/500
        </p>
      </div>

      {/* Checklist */}
      <div
        className="
          rounded-xl border border-[var(--color-primary)]/30
          bg-[var(--color-primary)]/5 p-4 space-y-3
        "
      >
        {[
          { ok: cartItems?.length > 0, label: `سبد خرید (${cartItems?.length || 'خالی'})`, index: '۱' },
          { ok: !!selectedAddress,      label: 'آدرس تحویل',                               index: '۲' },
          { ok: !!selectedPaymentMethod,label: 'روش پرداخت',                               index: '۳' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center
                text-xs font-bold transition
                ${item.ok
                  ? 'bg-emerald-500 text-white shadow'
                  : 'bg-slate-200 text-slate-500'
                }
              `}
            >
              {item.ok ? <FiCheck /> : item.index}
            </div>
            <span className={item.ok ? 'text-slate-800' : 'text-slate-500'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleSubmitOrder}
        disabled={!isReady || isSubmitting}
        className={`
          w-full h-12 rounded-xl
          flex items-center justify-center gap-2
          text-base font-bold
          border border-[var(--color-primary)]/30
          transition-all
          ${isReady && !isSubmitting
            ? 'bg-[var(--color-primary)]/80 text-white hover:bg-[var(--color-primary)] hover:shadow-lg active:scale-[0.98]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }
        `}
      >
        {isSubmitting ? (
          <>
            <span className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            در حال ثبت سفارش...
          </>
        ) : (
          <>
            ادامه ثبت سفارش
            <FiArrowLeft className="w-5 h-5" />
          </>
        )}
      </button>

      {!isReady && (
        <p className="text-center text-xs text-slate-400">
          برای ادامه، تمام مراحل بالا باید تکمیل شوند
        </p>
      )}
    </aside>
  );
};

export default OrderActions;