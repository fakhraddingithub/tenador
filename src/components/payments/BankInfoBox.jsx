"use client";

import React from 'react';
import { MdContentCopy, MdAccountBalance } from 'react-icons/md';
import useSWR from 'swr';
import { toast } from 'react-toastify';

const BANK_DETAILS_ENDPOINT = '/api/payments/bank-details';

async function fetchBankDetails(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || 'دریافت اطلاعات حساب بانکی انجام نشد. لطفاً دوباره تلاش کنید.'
    );
    error.status = response.status;
    throw error;
  }

  return data.value ?? null;
}

// تعریف در سطح ماژول تا با هر رندر دوباره ساخته نشود
const InfoRow = ({ label, value, onCopy }) => (
  <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-[6px] border border-gray-100 group relative overflow-hidden transition-all hover:border-[var(--color-primary)]/30">
    <span className="text-xs text-gray-500">{label}</span>
    <div className="flex justify-between items-center">
      <span className="font-mono text-gray-800 font-bold tracking-wider">{value}</span>
      <button
        onClick={() => onCopy(value, label)}
        className="text-gray-400 hover:text-[var(--color-primary)] p-2 rounded-full hover:bg-white transition-colors"
        title={`کپی ${label}`}
      >
        <MdContentCopy />
      </button>
    </div>
  </div>
);

const BankInfoBox = () => {
  const {
    data: bank,
    error,
    isLoading: loading,
    mutate,
  } = useSWR(BANK_DETAILS_ENDPOINT, fetchBankDetails, {
    revalidateOnFocus: true,
    shouldRetryOnError: (requestError) => requestError?.status !== 401,
    errorRetryCount: 2,
  });

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} کپی شد`, {
      style: { fontFamily: 'Vazirmatn' }
    });
  };

  // در حال بارگذاری
  if (loading) {
    return (
      <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6 space-y-4">
        <div className="h-6 w-48 bg-gray-100 animate-pulse rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 w-full bg-gray-50 animate-pulse rounded-[6px]" />
        ))}
      </div>
    );
  }

  if (error) {
    const sessionExpired = error.status === 401;
    return (
      <div className="bg-white rounded-[6px] border border-red-100 p-6 shadow-md mb-6">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
          <MdAccountBalance className="text-[var(--color-primary)] text-2xl" />
          <h2 className="text-lg font-bold">اطلاعات حساب بانکی</h2>
        </div>
        <p className="text-sm text-red-600 leading-relaxed">
          {sessionExpired
            ? 'نشست کاربری شما معتبر نیست. لطفاً دوباره وارد حساب کاربری شوید.'
            : error.message}
        </p>
        {!sessionExpired && (
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 rounded-[6px] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            تلاش دوباره
          </button>
        )}
      </div>
    );
  }

  // اگر اطلاعات حساب توسط ادمین ثبت نشده باشد
  if (!bank || (!bank.cardNumber && !bank.accountNumber && !bank.iban)) {
    return (
      <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
          <MdAccountBalance className="text-[var(--color-primary)] text-2xl" />
          <h2 className="text-lg font-bold">اطلاعات حساب بانکی</h2>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          اطلاعات حساب بانکی هنوز ثبت نشده است. لطفاً برای دریافت اطلاعات واریز با پشتیبانی تماس بگیرید.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
        <MdAccountBalance className="text-[var(--color-primary)] text-2xl" />
        <h2 className="text-lg font-bold">اطلاعات حساب بانکی</h2>
      </div>

      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        لطفاً مبلغ سفارش را به حساب زیر واریز نموده و تصویر فیش واریزی را در بخش پایین بارگذاری کنید.
      </p>

      <div className="space-y-4">
        {bank.ownerName && (
          <div className="p-3 bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 rounded text-sm text-gray-800 flex justify-between items-center">
            <span className="font-medium text-gray-600">نام صاحب حساب:</span>
            <span className="font-bold">{bank.ownerName}</span>
          </div>
        )}

        {bank.cardNumber && <InfoRow label="شماره کارت" value={bank.cardNumber} onCopy={copyToClipboard} />}
        {bank.accountNumber && <InfoRow label="شماره حساب" value={bank.accountNumber} onCopy={copyToClipboard} />}
        {bank.iban && <InfoRow label="شماره شبا (IBAN)" value={bank.iban} onCopy={copyToClipboard} />}
      </div>
    </div>
  );
};

export default BankInfoBox;
