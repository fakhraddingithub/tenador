"use client";

import React, { useState, useEffect } from 'react';
import { fetchOrder, submitPaymentReceipt } from '@/hooks/usePayment';
import OrderSummary from '@/components/payments/OrderSummary';
import BankInfoBox from '@/components/payments/BankInfoBox';
import ReceiptUploader from '@/components/payments/ReceiptUploader';
import EmailBox from '@/components/payments/EmailBox';
import RulesAgreement from '@/components/payments/RulesAgreement';
import SubmitPaymentButton from '@/components/payments/SubmitPaymentButton';
import InstallmentPage from '@/components/payments/InstallmentPage';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { getProfile, editProfile } from '@/hooks/useProfile';

const PaymentPage = ({ trackingCode }) => {
  const router = useRouter();

  const [loading,       setLoading]       = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [order,         setOrder]         = useState(null);
  const [user,          setUser]          = useState(null);

  // ReceiptUploader حالا URL آپلودشده را مستقیماً برمی‌گرداند
  const [receiptUrl,    setReceiptUrl]    = useState(null);

  const [email,         setEmail]         = useState('');
  const [rulesChecked,  setRulesChecked]  = useState(false);

  // ─── بارگذاری سفارش ───
  useEffect(() => {
    const loadOrder = async () => {
      setLoading(true);

      if (!trackingCode) {
        router.replace('/p-user/404');
        return;
      }

      try {
        const fetchedOrder = await fetchOrder(trackingCode);

        if (!fetchedOrder) {
          router.replace('/p-user/404');
          return;
        }

        // سفارش‌های ONLINE که قبلاً پرداخت شده‌اند → صفحه موفقیت
        if (fetchedOrder.paymentMethod === 'ONLINE' && fetchedOrder.paymentStatus === 'PAID') {
          router.replace('/p-user/success');
          return;
        }

        // سفارش‌های ONLINE که هنوز پرداخت نشده‌اند → ارسال به درگاه
        if (fetchedOrder.paymentMethod === 'ONLINE' && fetchedOrder.paymentStatus !== 'PAID') {
          router.replace(`/p-user/checkout/online/${trackingCode}`);
          return;
        }

        // BANK_RECEIPT یا INSTALLMENT که قبلاً تأیید شده → موفقیت
        if (fetchedOrder.paymentStatus === 'PAID') {
          router.replace('/p-user/success');
          return;
        }

        setOrder(fetchedOrder);

        const profile = await getProfile();
        setUser(profile);
      } catch (error) {
        console.error('Error fetching order:', error);
        router.replace('/p-user/404');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [trackingCode]); // eslint-disable-line

  // ─── اعتبارسنجی ایمیل ───
  const validateEmail = (val) => {
    if (!val) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // ─── ارسال فرم ───
  const handleSubmit = async () => {
    if (order.paymentMethod === 'BANK_RECEIPT' && !receiptUrl) {
      toast.error('لطفاً تصویر فیش واریزی را بارگذاری کنید.');
      return;
    }

    if (!rulesChecked) {
      toast.error('پذیرش قوانین الزامی است.');
      return;
    }

    if (email && !validateEmail(email)) {
      toast.error('فرمت ایمیل وارد شده صحیح نیست.');
      return;
    }

    setSubmitLoading(true);

    try {
      // ذخیره ایمیل در صورت وارد کردن
      if (email) {
        await editProfile({ email });
      }

      if (order.paymentMethod === 'BANK_RECEIPT') {
        const result = await submitPaymentReceipt({
          orderId:         order._id,
          receiptImageUrl: receiptUrl,   // ✅ از state — نه متغیر تعریف‌نشده
        });

        if (!result.success) {
          toast.error(result.error || 'خطا در ثبت رسید');
          return;
        }
      }

      await Swal.fire({
        title:             'پرداخت با موفقیت ثبت شد',
        text:              'اطلاعات شما در حال بررسی است و نتیجه تا ساعاتی دیگر اعلام خواهد شد.',
        icon:              'success',
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#aa4725',
      });

      router.push(`/p-user/orders/success/${trackingCode}`);
    } catch (error) {
      console.error(error);
      toast.error('خطایی در ثبت اطلاعات رخ داد. مجدداً تلاش کنید.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">در حال دریافت اطلاعات سفارش...</p>
      </div>
    );
  }

  // ─── اقساط ───
  if (order.paymentMethod === 'INSTALLMENT') {
    return <InstallmentPage user={user} order={order} />;
  }

  // ─── رسید بانکی ───
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col md:flex-row md:flex-row-reverse">

      {/* خلاصه سفارش — ستون چپ، sticky */}
      <div className="md:w-1/3 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <OrderSummary order={order} />
      </div>

      {/* فرم پرداخت — ستون راست */}
      <div className="md:w-2/3 flex flex-col gap-6 md:px-6">
        <BankInfoBox />

        {/* onFileChange حالا URL آپلودشده را دریافت می‌کند */}
        <ReceiptUploader onFileChange={setReceiptUrl} />

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
          disabled={
            (order.paymentMethod === 'BANK_RECEIPT' && !receiptUrl) ||
            !rulesChecked
          }
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
};

export default PaymentPage;
