"use client";

/**
 * src/components/payments/InstallmentPage.jsx
 *
 * صفحه تنظیم و ثبت طرح اقساطی.
 *
 * این کامپوننت خودش سفارش/پرداخت نمی‌سازد؛ پس از اعتبارسنجی و آپلود تصاویر،
 * payload اقساط را به onFinalSubmit (از صفحه والد) می‌دهد:
 *  - صفحه پرداختِ پیش از سفارش (CheckoutPaymentPage) → POST /api/checkout
 *  - صفحه پرداخت سفارش‌های موجود (PaymentPage)        → POST /api/payments/bank-receipt
 *
 * همه مبالغ به تومان هستند.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

// Components
import OrderSummary from './OrderSummary.jsx';
import InstallmentCalculator from './InstallmentCalculator.jsx';
import DownPaymentSection from './DownPaymentSection.jsx';
import InstallmentResult from './InstallmentResult.jsx';
import CheckUploadSection from './CheckUploadSection.jsx';
import ReceiptUploader from './ReceiptUploader.jsx';
import EmailBox from './EmailBox.jsx';
import RulesAgreement from './RulesAgreement.jsx';
import { editProfile } from '@/hooks/useProfile';
import SubmitPaymentButton from './SubmitPaymentButton.jsx';
import { INSTALLMENT_MONTHLY_INTEREST_RATE } from '@/lib/constants';

// تبدیل تاریخ چک (DateObject یا رشته شمسی YYYY-MM-DD) به ISO میلادی برای سرور
const checkDateToISO = (date) => {
  if (!date) return null;
  if (typeof date === 'object' && typeof date.toDate === 'function') {
    return date.toDate().toISOString();
  }
  const obj = new DateObject({
    date: String(date),
    format: 'YYYY-MM-DD',
    calendar: persian,
    locale: persian_fa,
  });
  return obj.isValid ? obj.toDate().toISOString() : null;
};

// آپلود تصویر چک (data URL) و دریافت URL نهایی
const uploadCheckImage = async (dataUrl, index) => {
  // اگر از قبل URL آپلودشده باشد (نه data URL)، همان را برگردان
  if (typeof dataUrl === 'string' && !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const blob = await (await fetch(dataUrl)).blob();
  const formData = new FormData();
  formData.append(
    'file',
    new File([blob], `check-${index + 1}-${Date.now()}.png`, {
      type: blob.type || 'image/png',
    }),
  );
  formData.append('folder', 'checks');

  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `خطا در آپلود تصویر چک شماره ${index + 1}`);
  return data.url;
};

const InstallmentPage = ({ order, user, onFinalSubmit }) => {
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentReceipts, setDownPaymentReceipts] = useState([]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [checks, setChecks] = useState([]);
  const [email, setEmail] = useState('');
  const [rulesChecked, setRulesChecked] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Dynamic Calculations — همه مبالغ تومان
  const calculations = useMemo(() => {
    const remaining = Math.max(0, order.totalPrice - downPayment);
    const totalInterest = remaining * INSTALLMENT_MONTHLY_INTEREST_RATE * installmentCount;
    const totalWithInterest = remaining + totalInterest;
    const monthlyInstallment = totalWithInterest / installmentCount;

    return {
      remaining,
      totalInterest,
      totalWithInterest,
      monthlyInstallment
    };
  }, [order.totalPrice, downPayment, installmentCount]);

  // Sync check fields with installment count
  useEffect(() => {
    const defaultCheckAmount = Math.floor(calculations.monthlyInstallment);

    setChecks(prevChecks => {
      return Array.from({ length: installmentCount }, (_, i) => {
        const existing = prevChecks[i];

        // ساخت تاریخ شمسی + ذخیره استاندارد YYYY-MM-DD
        const installmentDate = new DateObject({
          calendar: persian,
          locale: persian_fa
        }).add(i + 1, "month");

        return {
          id: existing?.id || Date.now() + i,
          image: existing?.image || null,
          number: existing?.number || '',
          amount: defaultCheckAmount, // تومان — همیشه sync شود
          date: existing?.date || installmentDate // اگر قبلا داشت نگه دار
        };
      });
    });

  }, [installmentCount, calculations.monthlyInstallment]);

  const handleUpdateCheck = (index, field, value) => {
    const updated = [...checks];
    updated[index] = { ...updated[index], [field]: value };
    setChecks(updated);
  };

  const handleRemoveCheck = (index) => {
    if (installmentCount > 1) {
      setInstallmentCount(prev => prev - 1);
    } else {
      toast.error('حداقل یک قسط الزامی است');
    }
  };

  const validateEmail = (email) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleFinalSubmit = async () => {
    // ─── اعتبارسنجی ───
    if (!downPayment || downPayment <= 0) {
      return toast.error('مبلغ پیش‌پرداخت الزامی است');
    }
    if (downPayment >= order.totalPrice) {
      return toast.error('پیش‌پرداخت باید کمتر از مبلغ کل سفارش باشد');
    }
    if (downPaymentReceipts.length === 0) {
      return toast.error('لطفاً حداقل یک تصویر رسید پیش‌پرداخت بارگذاری کنید');
    }

    const isAllFilled = checks.every(c => c.image && c.number && c.amount && c.date);
    if (!isAllFilled) {
      return toast.error('لطفا تمامی فیلدهای مربوط به چک‌ها را تکمیل کنید');
    }

    const totalCheckAmount = checks.reduce((acc, curr) => acc + Number(curr.amount), 0);
    // Tolerance for rounding
    if (Math.abs(totalCheckAmount - calculations.totalWithInterest) > 100) {
      return toast.error(`مجموع مبالغ چک‌ها باید برابر با ${Math.round(calculations.totalWithInterest).toLocaleString()} تومان باشد`);
    }
    if (!rulesChecked) {
      toast.error('پذیرش قوانین الزامی است.');
      return;
    }
    if (email && !validateEmail(email)) {
      toast.error('فرمت ایمیل وارد شده صحیح نیست.');
      return;
    }

    const dueDates = checks.map((c) => checkDateToISO(c.date));
    if (dueDates.some((d) => !d)) {
      return toast.error('تاریخ سررسید همه چک‌ها باید معتبر باشد');
    }

    const result = await Swal.fire({
      title: 'آیا از تایید نهایی اطمینان دارید؟',
      text: 'پس از تایید، سفارش شما ثبت و طرح اقساطی برای بازبینی ارسال خواهد شد.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'بله، تایید می‌کنم',
      cancelButtonText: 'انصراف',
      confirmButtonColor: 'var(--color-primary)',
    });

    if (!result.isConfirmed) return;

    setSubmitLoading(true);
    try {
      if (email) await editProfile({ email });

      // آپلود تصاویر چک‌ها و ساخت payload نهایی
      const checkImageUrls = await Promise.all(
        checks.map((c, i) => uploadCheckImage(c.image, i)),
      );

      const payload = {
        downPaymentAmount:      downPayment,
        downPaymentReceiptUrls: downPaymentReceipts,
        numberOfChecks:         installmentCount,
        checks: checks.map((c, i) => ({
          checkNumber:     c.number,
          amount:          Number(c.amount),
          dueDate:         dueDates[i],
          receiptImageUrl: checkImageUrls[i],
        })),
      };

      // ثبت نهایی — صفحه والد مسئول ساخت سفارش/پرداخت و هدایت پس از موفقیت است
      await onFinalSubmit(payload);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'خطایی در ثبت اطلاعات رخ داد. مجدداً تلاش کنید.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-8xl mx-auto">
        <header className="mb-8 text-center lg:text-right">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">مدیریت پرداخت اقساطی</h1>
          <p className="text-gray-500">مراحل تنظیم و تایید چک‌های بانکی</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Order Summary */}
          <aside className="lg:col-span-4 h-fit lg:sticky lg:top-8 order-1 lg:order-2">
            <OrderSummary order={order} downPayment={downPayment} />
          </aside>

          {/* Right Column: Configuration */}
          <main className="lg:col-span-8 space-y-6 order-2 lg:order-1">
            <div className="bg-[var(--color-background)] rounded-[var(--radius)] shadow-sm border border-gray-100 p-6 space-y-8">
              <section>
                <h2 className="text-xl font-bold mb-6 pb-2 border-b border-gray-100">تنظیمات اقساط</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DownPaymentSection
                    value={downPayment}
                    onChange={setDownPayment}
                    max={order.totalPrice}
                  />
                  <InstallmentCalculator
                    count={installmentCount}
                    setCount={setInstallmentCount}
                  />
                </div>
              </section>

              {/* رسید واریز پیش‌پرداخت — برای ثبت درخواست الزامی است */}
              <section>
                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">
                  رسید واریز پیش‌پرداخت
                </h3>
                <ReceiptUploader onFileChange={setDownPaymentReceipts} />
              </section>

              <InstallmentResult calculations={calculations} />

              <CheckUploadSection
                checks={checks}
                onUpdate={handleUpdateCheck}
                onRemove={handleRemoveCheck}
                remainingBalance={calculations.totalWithInterest}
              />

              <EmailBox
                show={!user?.email}
                email={email}
                setEmail={setEmail}
              />

              <RulesAgreement
                checked={rulesChecked}
                onChange={setRulesChecked}
              />
              <SubmitPaymentButton
                loading={submitLoading}
                disabled={!checks.length || !rulesChecked}
                onClick={handleFinalSubmit}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default InstallmentPage
