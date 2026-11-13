
import React from 'react';

const SubmitPaymentButton = ({ disabled, loading, onClick, label = 'ثبت نهایی و تکمیل پرداخت' }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
        className={`w-full py-4 rounded-[6px] font-bold text-lg transition-all flex items-center justify-center gap-2
        ${disabled || loading 
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
          : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98]'}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          در حال ثبت...
        </>
      ) : (
        label
      )}
    </button>
  );
};

export default SubmitPaymentButton;
