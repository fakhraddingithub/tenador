"use client";

/**
 * src/components/payments/CheckoutPaymentPage.jsx
 *
 * صفحه پرداختِ پیش از ثبت سفارش.
 *
 * در این مرحله هنوز هیچ سفارشی ساخته نشده است؛ اطلاعات از سبد خرید زنده
 * (localStorage) و اطلاعات مرحله ثبت سفارش (sessionStorage) خوانده می‌شود.
 * کاربر می‌تواند برگردد، سبد را تغییر دهد و دوباره ادامه دهد.
 *
 * سفارش فقط پس از ثبت موفق پرداخت (رسید بانکی) یا تکمیل درخواست اقساط در
 * POST /api/checkout ساخته می‌شود؛ همان‌جا پرداخت به سفارش متصل و سبد خالی می‌گردد.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FiArrowRight } from 'react-icons/fi';
import Link from 'next/link';

import OrderSummary from '@/components/payments/OrderSummary';
import PaymentCouponBox from '@/components/payments/PaymentCouponBox';
import BankInfoBox from '@/components/payments/BankInfoBox';
import ReceiptUploader from '@/components/payments/ReceiptUploader';
import EmailBox from '@/components/payments/EmailBox';
import RulesAgreement from '@/components/payments/RulesAgreement';
import SubmitPaymentButton from '@/components/payments/SubmitPaymentButton';
import InstallmentPage from '@/components/payments/InstallmentPage';

import { useCart } from '@/hooks/useCart';
import { getCart, clearCart } from '@/lib/cart';
import { getPendingCheckout, clearPendingCheckout } from '@/lib/pendingCheckout';
import { getProfile, editProfile } from '@/hooks/useProfile';

// آیتم‌های خام سبد (localStorage) — همان شکلی که سرور برای محاسبه قیمت می‌پذیرد
const prepareItemsForServer = () =>
  getCart().map((item) => {
    if (item.itemType === 'used_product') {
      return {
        usedProductId: item.usedProductId,
        itemType: 'used_product',
        quantity: 1,
      };
    }
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      itemType: 'product',
      quantity: item.quantity,
      flowSelections: item.flowSelections ?? [],
    };
  });

const CheckoutPaymentPage = () => {
  const router = useRouter();

  const {
    cartItems,
    isLoading: isCartLoading,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    couponDiscount,
    couponError,
    totalPrice,
    totalRawPrice,
    totalDiscount,
  } = useCart();

  const [checkout,      setCheckout]      = useState(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [user,          setUser]          = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [receiptUrls,  setReceiptUrls]  = useState([]);
  const [email,        setEmail]        = useState('');
  const [rulesChecked, setRulesChecked] = useState(false);

  // ─── بارگذاری اطلاعات مرحله ثبت سفارش ───
  useEffect(() => {
    const pending = getPendingCheckout();

    if (!pending) {
      toast.error('لطفاً ابتدا مراحل ثبت سفارش را تکمیل کنید');
      router.replace('/p-user/signOrder');
      return;
    }

    setCheckout(pending);
    setCheckoutReady(true);

    // سازگاری با نشست‌های قدیمی که کد تخفیف را از صفحه ثبت سفارش آورده‌اند
    if (pending.couponCode) {
      applyCoupon(pending.couponCode);
    }

    getProfile()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null));
  }, []); // eslint-disable-line

  const validateEmail = (val) => {
    if (!val) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // ─── ارسال نهایی به سرور — اینجا سفارش ساخته می‌شود ───
  const submitCheckout = async (paymentFields) => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items:           prepareItemsForServer(),
        addressId:       checkout.addressId,
        addressSnapshot: checkout.addressSnapshot,
        paymentMethod:   checkout.paymentMethod,
        // کد تخفیفِ اعمال‌شده در همین صفحه — سرور دوباره اعتبارسنجی می‌کند
        couponCode:      appliedCoupon?.code ?? null,
        description:     checkout.description,
        ...paymentFields,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'خطا در ثبت سفارش و پرداخت');
    }
    if (!data?.trackingCode) {
      throw new Error('کد پیگیری سفارش از سرور دریافت نشد');
    }

    return data;
  };

  const handleCheckoutSuccess = async (trackingCode, successText) => {
    // سفارش ساخته شد — سبد و اطلاعات موقت پاک می‌شوند
    clearCart();
    clearPendingCheckout();

    await Swal.fire({
      title:              'پرداخت با موفقیت ثبت شد',
      text:               successText,
      icon:               'success',
      confirmButtonText:  'متوجه شدم',
      confirmButtonColor: '#aa4725',
    });

    window.location.replace(`/p-user/orders/success/${trackingCode}`);
  };

  // ─── ثبت رسید بانکی ───
  const handleBankReceiptSubmit = async () => {
    if (receiptUrls.length === 0) {
      toast.error('لطفاً حداقل یک تصویر فیش واریزی بارگذاری کنید.');
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
      if (email) {
        await editProfile({ email });
      }

      const data = await submitCheckout({ receiptImageUrls: receiptUrls });

      await handleCheckoutSuccess(
        data.trackingCode,
        'سفارش شما ثبت شد؛ اطلاعات پرداخت در حال بررسی است و نتیجه تا ساعاتی دیگر اعلام خواهد شد.',
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'خطایی در ثبت اطلاعات رخ داد. مجدداً تلاش کنید.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── ثبت درخواست اقساط (از InstallmentPage فراخوانی می‌شود) ───
  const handleInstallmentSubmit = async (installmentPayload) => {
    const data = await submitCheckout({ installment: installmentPayload });

    await handleCheckoutSuccess(
      data.trackingCode,
      'سفارش و طرح اقساطی شما ثبت شد و پس از بررسی پیش‌پرداخت، نتیجه اعلام خواهد شد.',
    );
  };

  // ─── Loading ───
  if (!checkoutReady || isCartLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">در حال دریافت اطلاعات پرداخت...</p>
      </div>
    );
  }

  // ─── سبد خالی ───
  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-gray-600 font-bold">سبد خرید شما خالی است</p>
        <p className="text-gray-400 text-sm">
          برای ادامه فرایند پرداخت ابتدا محصولی به سبد اضافه کنید.
        </p>
        <Link
          href="/p-user/signOrder"
          className="px-5 py-2.5 rounded-[6px] bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          بازگشت به ثبت سفارش
        </Link>
      </div>
    );
  }

  // ─── سفارش مجازی (هنوز در دیتابیس ساخته نشده) برای کامپوننت‌های نمایش ───
  const pseudoOrder = {
    trackingCode:  null, // پس از تکمیل پرداخت صادر می‌شود
    paymentMethod: checkout.paymentMethod,
    items: cartItems.map((item) => ({
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice: item.unitPriceToman,
      product: {
        _id:       item.productId,
        name:      item.product?.product?.name,
        mainImage: item.product?.product?.mainImage,
      },
      usedProduct:
        item.itemType === 'used_product'
          ? {
              _id:    item.usedProductId,
              name:   item.product?.product?.name,
              images: item.product?.product?.mainImage
                ? [item.product.product.mainImage]
                : [],
            }
          : null,
      variant: item.variant ?? null,
    })),
    subtotalPrice:  totalRawPrice,
    discountAmount: totalDiscount,
    couponDiscount,
    coupon:         appliedCoupon,
    totalPrice,
  };

  // ─── لینک بازگشت برای ویرایش سبد/سفارش ───
  const backLink = (
    <Link
      href="/p-user/signOrder"
      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:gap-2.5 transition-all mb-4"
    >
      <FiArrowRight className="w-4 h-4" />
      بازگشت و ویرایش سبد خرید
    </Link>
  );

  // ─── باکس کد تخفیف — اعمال آن مبلغ قابل پرداخت را همان لحظه بازمحاسبه می‌کند ───
  const couponBox = (
    <PaymentCouponBox
      appliedCoupon={appliedCoupon}
      couponDiscount={couponDiscount}
      couponError={couponError}
      onApply={applyCoupon}
      onRemove={removeCoupon}
    />
  );

  // ─── اقساط ───
  if (checkout.paymentMethod === 'INSTALLMENT') {
    return (
      <div>
        {backLink}
        {couponBox}
        <InstallmentPage
          user={user}
          order={pseudoOrder}
          onFinalSubmit={handleInstallmentSubmit}
        />
      </div>
    );
  }

  // ─── رسید بانکی ───
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {backLink}

      <div className="flex flex-col md:flex-row md:flex-row-reverse">
        <div className="md:w-1/3 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <OrderSummary order={pseudoOrder} />
        </div>

        <div className="md:w-2/3 flex flex-col gap-6 md:px-6">
          {couponBox}

          <BankInfoBox />

          <ReceiptUploader onFileChange={setReceiptUrls} />

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
            disabled={receiptUrls.length === 0 || !rulesChecked}
            onClick={handleBankReceiptSubmit}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutPaymentPage;
