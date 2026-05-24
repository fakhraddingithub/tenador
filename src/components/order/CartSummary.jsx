'use client';

/**
 * src/components/order/CartSummary.jsx
 *
 * خلاصه سبد خرید با قیمت‌های محاسبه‌شده سمت سرور و کوپن واقعی
 */

import { useState } from 'react';
import { FiTag, FiCheck, FiX, FiShoppingBag, FiRefreshCw } from 'react-icons/fi';
import { toPersianNumbers } from 'base/utils/formatters';

/** فرمت عدد به تومان */
function formatToman(amount) {
  if (!amount && amount !== 0) return '—';
  return toPersianNumbers(Number(amount).toLocaleString('fa-IR')) + ' تومان';
}

const CartSummary = ({
  totalItems,
  subtotalToman,
  discountToman,
  couponDiscountToman,
  finalTotalToman,
  coupon,
  couponError,
  onApplyCoupon,    // async (code: string) => void
  onRemoveCoupon,   // () => void
  isLoadingPrice,
}) => {
  const [couponInput, setCouponInput] = useState(coupon?.code || '');
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!couponInput.trim()) return;
    setIsApplying(true);
    try {
      await onApplyCoupon(couponInput.trim().toUpperCase());
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = () => {
    setCouponInput('');
    onRemoveCoupon();
  };

  return (
    <aside
      className="
        rounded-2xl border border-slate-200
        bg-white p-5 md:p-6
        shadow-lg shadow-slate-200/40
        space-y-6
      "
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[var(--color-primary)]/20">
          <FiShoppingBag className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-base md:text-lg font-bold text-slate-800">
          خلاصه سبد خرید
        </h2>
        {isLoadingPrice && (
          <FiRefreshCw className="w-4 h-4 text-slate-400 animate-spin mr-auto" />
        )}
      </div>

      {/* Items count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">تعداد کالاها</span>
        <span className="font-semibold text-slate-800">
          {toPersianNumbers(totalItems)} عدد
        </span>
      </div>

      {/* Coupon */}
      <div
        className="
          rounded-xl border border-[var(--color-primary)]/30
          bg-[var(--color-primary)]/5 p-4 space-y-3
        "
      >
        <label className="text-sm font-semibold text-slate-700">
          کد تخفیف
        </label>

        {!coupon ? (
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
                    w-full h-11 pr-10 px-3
                    rounded-lg border border-[var(--color-primary)]/30
                    bg-white text-sm text-slate-800
                    placeholder:text-slate-400
                    focus:border-[var(--color-primary)]/50
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30
                    transition
                  "
                />
              </div>

              <button
                onClick={handleApply}
                disabled={isApplying || !couponInput.trim()}
                className="
                  h-11 px-4 rounded-lg
                  border border-[var(--color-primary)]/30
                  text-sm font-semibold
                  text-[var(--color-primary)]
                  hover:bg-[var(--color-primary)]/10
                  active:scale-[0.97]
                  transition
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                {isApplying ? (
                  <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  'اعمال'
                )}
              </button>
            </div>

            {couponError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <FiX className="w-3 h-3" />
                {couponError}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-emerald-600">
              <FiCheck className="w-4 h-4" />
              <span>کد «{coupon.code}» اعمال شد</span>
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

      {/* Price breakdown */}
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">جمع کالاها</span>
          <span className="font-medium text-slate-800">
            {formatToman(subtotalToman)}
          </span>
        </div>

        {discountToman > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تخفیف</span>
            <span className="font-medium text-emerald-600">
              − {formatToman(discountToman)}
            </span>
          </div>
        )}

        {couponDiscountToman > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تخفیف کد</span>
            <span className="font-medium text-emerald-600">
              − {formatToman(couponDiscountToman)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-slate-500">هزینه ارسال</span>
          <span className="font-semibold text-emerald-600">رایگان</span>
        </div>
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">
            مبلغ قابل پرداخت
          </span>
          <span className="text-lg md:text-xl font-extrabold text-[var(--color-primary)]">
            {formatToman(finalTotalToman)}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default CartSummary;
