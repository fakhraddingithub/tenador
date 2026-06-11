'use client';

/**
 * src/components/order/CartSummary.jsx
 */

import { useState } from 'react';
import { FiTag, FiCheck, FiX, FiShoppingBag, FiRefreshCw } from 'react-icons/fi';
import { formatPriceWithCurrency, toPersianNumbers } from 'base/utils/formatters';

const CartSummary = ({
  totalItems,
  totalPrice,       // قیمت نهایی (بعد از همه تخفیف‌ها + کوپن)
  totalRawPrice,    // قیمت بدون تخفیف
  totalDiscount,    // تخفیف rule/flash
  couponDiscount,   // تخفیف کوپن
  appliedCoupon,    // { code } یا null
  couponError,
  onApplyCoupon,    // async (code) => void
  onRemoveCoupon,   // () => void
  isLoading,
  // کد تخفیف در صفحه پرداخت وارد می‌شود؛ این بخش در صفحه ثبت سفارش مخفی است
  showCoupon = true,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!couponInput.trim()) return;
    setIsApplying(true);
    try {
      await onApplyCoupon(couponInput.trim().toUpperCase());
      if (!couponError) setCouponInput('');
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    setCouponInput('');
    onRemoveCoupon();
  };

  return (
    <aside className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[var(--color-primary)]/20">
          <FiShoppingBag className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-base md:text-lg font-bold text-slate-800">
          خلاصه سبد خرید
        </h2>
        {isLoading && (
          <FiRefreshCw className="w-4 h-4 text-slate-400 animate-spin mr-auto" />
        )}
      </div>

      {/* تعداد */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">تعداد کالاها</span>
        <span className="font-semibold text-slate-800">
          {toPersianNumbers(totalItems)} عدد
        </span>
      </div>

      {/* کوپن */}
      {showCoupon && (
      <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4 space-y-3">
        <label className="text-sm font-semibold text-slate-700">کد تخفیف</label>

        {!appliedCoupon ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FiTag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                  placeholder="کد تخفیف را وارد کنید"
                  className="
                    w-full h-11 pr-10 px-3 rounded-lg
                    border border-[var(--color-primary)]/30 bg-white
                    text-sm text-slate-800 placeholder:text-slate-400
                    focus:border-[var(--color-primary)]/50 focus:outline-none
                    focus:ring-2 focus:ring-[var(--color-primary)]/30 transition
                  "
                />
              </div>
              <button
                onClick={handleApply}
                disabled={isApplying || !couponInput.trim()}
                className="
                  h-11 px-4 rounded-lg border border-[var(--color-primary)]/30
                  text-sm font-semibold text-[var(--color-primary)]
                  hover:bg-[var(--color-primary)]/10 active:scale-[0.97] transition
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isApplying
                  ? <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin inline-block" />
                  : 'اعمال'
                }
              </button>
            </div>

            {couponError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <FiX className="w-3 h-3" /> {couponError}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-emerald-600">
              <FiCheck className="w-4 h-4" />
              <span>کد «{appliedCoupon.code}» اعمال شد</span>
            </div>
            <button
              onClick={handleRemove}
              className="text-xs text-slate-400 hover:text-red-500 transition"
            >
              حذف
            </button>
          </div>
        )}
      </div>
      )}

      {/* تفکیک قیمت */}
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">جمع کالاها</span>
          <span className="font-medium text-slate-800">
            {formatPriceWithCurrency(totalRawPrice)}
          </span>
        </div>

        {totalDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تخفیف</span>
            <span className="font-medium text-emerald-600">
              {formatPriceWithCurrency(totalDiscount)}
            </span>
          </div>
        )}

        {couponDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تخفیف کد</span>
            <span className="font-medium text-emerald-600">
              − {formatPriceWithCurrency(couponDiscount)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-slate-500">هزینه ارسال</span>
          <span className="font-semibold text-emerald-600">رایگان</span>
        </div>
      </div>

      {/* جمع کل */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">مبلغ قابل پرداخت</span>
          <span className="text-lg md:text-xl font-bold text-[var(--color-primary)]">
            {formatPriceWithCurrency(totalPrice)}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default CartSummary;
