import React from 'react';

const InstallmentResult = ({ calculations }) => {
  const { remaining, totalInterest, totalWithInterest, monthlyInstallment } = calculations;
  const formatPrice = (price) => new Intl.NumberFormat('fa-IR').format(price)
  return (
    <div className="bg-orange-50 rounded-[var(--radius)] p-5 border border-orange-100 grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="space-y-1">
        <p className="text-[10px] text-orange-600 ">مبلغ باقی‌مانده</p>
        <p className="text-sm font-bold text-[var(--color-text)]">{formatPrice(remaining)} <span className="text-[8px]">تومان</span></p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-orange-600 font-bold">مجموع سود</p>
        <p className="text-sm font-bold text-[var(--color-text)]">{formatPrice(totalInterest)} <span className="text-[8px]">تومان</span></p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-orange-600 font-bold">مجموع اقساط</p>
        <p className="text-sm font-bold text-[var(--color-text)] font-bold">{formatPrice(totalWithInterest)} <span className="text-[8px]">تومان</span></p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-orange-600 font-bold">مبلغ هر قسط</p>
        <p className="text-sm font-bold text-[var(--color-primary)] font-bold">{formatPrice(Math.round(monthlyInstallment))} <span className="text-[8px]">تومان</span></p>
      </div>
    </div>
  );
};

export default InstallmentResult;