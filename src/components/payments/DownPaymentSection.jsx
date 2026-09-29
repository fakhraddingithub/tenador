import React from 'react';
import { toEnglishDigits } from '@/lib/addressForm.mjs';
import { HiOutlineCash, HiOutlineGlobeAlt, HiOutlineLibrary } from 'react-icons/hi';

const DownPaymentSection = ({ value, onChange, max, onBankPayment, bankPaymentOpen }) => {
  const handleChange = (e) => {
    const val = Number(toEnglishDigits(e.target.value).replace(/\D/g, ''));
    if (val <= max) {
      onChange(val);
    }
  };
  
  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">
        پیش‌پرداخت (الزامی)
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value.toLocaleString('en-US')}
          onChange={handleChange}
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-[var(--radius)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all font-bold"
          placeholder="مبلغ به تومان..."
        />
        <HiOutlineCash className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
      </div>
      
      {value > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 text-gray-500 text-xs rounded-[var(--radius)] cursor-not-allowed"
          >
            <HiOutlineGlobeAlt />
            پرداخت آنلاین (غیرفعال)
          </button>
          <button
            type="button"
            onClick={onBankPayment}
            aria-expanded={bankPaymentOpen}
            aria-controls="down-payment-receipt"
            className="flex items-center justify-center gap-2 py-2 px-3 border border-[var(--color-secondary)] text-[var(--color-text)] text-xs rounded-[var(--radius)] hover:bg-amber-50 transition-colors"
          >
            <HiOutlineLibrary />
            پرداخت بانکی
          </button>
        </div>
      )}
    </div>
  );
};

export default DownPaymentSection;
