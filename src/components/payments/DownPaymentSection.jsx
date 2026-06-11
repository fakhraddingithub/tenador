import React from 'react';
import { HiOutlineCash, HiOutlineGlobeAlt, HiOutlineLibrary } from 'react-icons/hi';

const DownPaymentSection = ({ value, onChange, max }) => {
  const handleChange = (e) => {
    const val = Number(e.target.value.replace(/\D/g, ''));
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
          value={value.toLocaleString()}
          onChange={handleChange}
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-[var(--radius)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all font-bold"
          placeholder="مبلغ به تومان..."
        />
        <HiOutlineCash className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
      </div>
      
      {value > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button className="flex items-center justify-center gap-2 py-2 px-3 bg-[var(--color-primary)] text-white text-xs rounded-[var(--radius)] hover:opacity-90 transition-opacity">
            <HiOutlineGlobeAlt />
            پرداخت آنلاین
          </button>
          <button className="flex items-center justify-center gap-2 py-2 px-3 border border-[var(--color-secondary)] text-[var(--color-text)] text-xs rounded-[var(--radius)] hover:bg-amber-50 transition-colors">
            <HiOutlineLibrary />
            پرداخت بانکی
          </button>
        </div>
      )}
    </div>
  );
};

export default DownPaymentSection;