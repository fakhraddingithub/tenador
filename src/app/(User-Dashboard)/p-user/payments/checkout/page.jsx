// صفحه پرداخت پیش از ثبت سفارش — سفارش فقط پس از تکمیل موفق پرداخت ساخته می‌شود
import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CheckoutPaymentPage from '@/components/payments/CheckoutPaymentPage';

const Page = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer position="top-center" autoClose={3000} rtl theme="light" />
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-[var(--color-primary)]">پرداخت سفارش</h1>
          <div className="hidden sm:block text-sm text-gray-500 font-medium">پایانه پرداخت امن (SSL)</div>
        </div>
      </header>
      <div className="flex-grow bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <CheckoutPaymentPage />
        </div>
      </div>
      <footer className="bg-white border-t border-gray-200 py-6 px-6 text-center text-gray-400 text-[10px] leading-relaxed">
        استفاده از این درگاه به منزله پذیرش تمامی قوانین تجارت الکترونیک است.<br />
        &copy; ۲۰۲۴ تمامی حقوق برای سیستم پرداخت یکپارچه محفوظ است.
      </footer>
    </div>
  );
};

export default Page;
