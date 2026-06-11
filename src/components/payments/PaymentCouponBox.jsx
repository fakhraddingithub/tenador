'use client';

/**
 * src/components/payments/PaymentCouponBox.jsx
 *
 * ورود کد تخفیف در صفحه پرداخت — اعتبارسنجی از سرور (/api/cart/price) انجام
 * می‌شود و مبلغ قابل پرداخت بلافاصله بازمحاسبه می‌گردد. سرور هنگام ثبت نهایی
 * نیز کد را دوباره اعتبارسنجی و قیمت را مستقل محاسبه می‌کند.
 */

import { useState } from 'react';
import { FiTag, FiCheck, FiX } from 'react-icons/fi';

const PaymentCouponBox = ({
  appliedCoupon,   // { code } یا null
  couponDiscount,  // تومان
  couponError,
  onApply,         // async (code) => void
  onRemove,        // () => void
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!couponInput.trim() || isApplying) return;
    setIsApplying(true);
    try {
      await onApply(couponInput.trim().toUpperCase());
      setCouponInput('');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
        <FiTag className="text-[var(--color-primary)] text-2xl" />
        <h2 className="text-lg font-bold">کد تخفیف</h2>
        {appliedCoupon && couponDiscount > 0 && (
          <span className="mr-auto text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
            {new Intl.NumberFormat('fa-IR').format(couponDiscount)} تومان تخفیف
          </span>
        )}
      </div>

      {!appliedCoupon ? (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FiTag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                dir="ltr"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                placeholder="کد تخفیف خود را وارد کنید"
                className="w-full h-11 pr-10 px-3 rounded-[6px] border border-gray-200 bg-gray-50 text-sm font-bold tracking-widest text-left text-gray-800 placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-right focus:border-[var(--color-primary)] focus:bg-white focus:outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || !couponInput.trim()}
              className="h-11 px-5 rounded-[6px] text-sm font-bold text-white bg-[var(--color-primary)] hover:opacity-90 active:scale-[0.97] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                'اعمال'
              )}
            </button>
          </div>

          {couponError && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-3">
              <FiX className="w-3 h-3" /> {couponError}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-[6px] p-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <FiCheck className="w-4 h-4" />
            <span>
              کد «<span dir="ltr" className="font-mono tracking-widest">{appliedCoupon.code}</span>» اعمال شد
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-bold text-gray-400 hover:text-red-500 transition"
          >
            حذف کد
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentCouponBox;
