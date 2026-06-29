import React from 'react';
import { HiOutlineCalendar } from 'react-icons/hi';

const InstallmentCalculator = ({ count, setCount, rate = 4 }) => {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">
        تعداد اقساط
      </label>
      <div className="relative">
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-[var(--radius)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none appearance-none transition-all cursor-pointer"
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} قسط
            </option>
          ))}
        </select>
        <HiOutlineCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none" />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <p className="text-[10px] text-gray-400">
        سود ماهیانه: {Number(rate).toLocaleString('fa-IR')} درصد
      </p>
    </div>
  );
};

export default InstallmentCalculator;