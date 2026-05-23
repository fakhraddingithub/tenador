import { useState } from 'react';
import { FiTag, FiCheck, FiShoppingBag, FiX } from 'react-icons/fi';
import { formatPriceWithCurrency, toPersianNumbers } from 'base/utils/formatters';
import { toast } from 'react-toastify';

const CartSummary = ({
  totalItems,
  totalPrice,
  totalRawPrice,
  totalDiscount,
  discountCode,
  onDiscountCodeChange,
  onApplyCoupon,
  couponError,
  appliedCoupon,
}) => {
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      toast.error('لطفاً کد تخفیف را وارد کنید');
      return;
    }

    setIsApplying(true);
    try {
      await onApplyCoupon(discountCode.trim());
      // couponError از hook برمی‌گردد — اگر null بود یعنی اعمال شد
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveCoupon = async () => {
    onDiscountCodeChange('');
    await onApplyCoupon(null);
  };

  const isCouponApplied = appliedCoupon && !couponError;
  // نمایش صرفه‌جویی کلی (تخفیف قوانین + کوپن)
  const savingsToShow = totalRawPrice > totalPrice ? totalRawPrice - totalPrice : totalDiscount;

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
      </div>

      {/* Items */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">تعداد کالاها</span>
        <span className="font-semibold text-slate-800">
          {toPersianNumbers(totalItems)} عدد
        </span>
      </div>

      {/* Discount Code */}
      <div
        className="
          rounded-xl border border-[var(--color-primary)]/30
          bg-[var(--color-primary)]/5 p-4 space-y-3
        "
      >
        <label className="text-sm font-semibold text-slate-700">
          کد تخفیف
        </label>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiTag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={discountCode}
              onChange={(e) => onDiscountCodeChange(e.target.value)}
              placeholder="کد تخفیف را وارد کنید"
              disabled={isCouponApplied}
              className="
                w-full h-11 pr-10 px-3
                rounded-lg border border-[var(--color-primary)]/30
                bg-white text-sm text-slate-800
                placeholder:text-slate-400
                focus:border-[var(--color-primary)]/50
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30
                disabled:bg-slate-100 disabled:cursor-not-allowed
                transition
              "
            />
          </div>

          {isCouponApplied ? (
            <button
              onClick={handleRemoveCoupon}
              className="
                h-11 px-4 rounded-lg
                border border-red-300
                text-sm font-semibold text-red-500
                hover:bg-red-50
                transition
              "
            >
              <FiX className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleApplyDiscount}
              disabled={isApplying}
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
          )}
        </div>

        {/* وضعیت کوپن */}
        {couponError && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <FiX className="w-3 h-3" />
            {couponError}
          </div>
        )}
        {isCouponApplied && (
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <FiCheck className="w-3 h-3" />
            کد تخفیف «{appliedCoupon}» اعمال شد
          </div>
        )}
      </div>

      {/* Price Breakdown */}
      <div className="space-y-3 text-sm">
        {totalRawPrice > 0 && totalRawPrice !== totalPrice && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">قیمت اولیه</span>
            <span className="font-medium text-slate-400 line-through">
              {formatPriceWithCurrency(totalRawPrice)}
            </span>
          </div>
        )}

        {savingsToShow > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">تخفیف</span>
            <span className="font-semibold text-emerald-600">
              — {formatPriceWithCurrency(savingsToShow)}
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
            {formatPriceWithCurrency(totalPrice)}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default CartSummary;
