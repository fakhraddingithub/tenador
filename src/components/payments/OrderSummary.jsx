import React from 'react';
import { MdOutlineConfirmationNumber, MdOutlineReceiptLong, MdOutlinePayment } from 'react-icons/md';
import VariantSummary from '@/components/order/VariantSummary';

const OrderSummary = ({ order }) => {
  const formatPrice = (price) =>
    new Intl.NumberFormat('fa-IR').format(price) + ' تومان';

  // جداسازی نام فارسی و انگلیسی
  const splitName = (text) => {
    if (!text) return { farsi: '', english: '' };
    const match = text.match(/[a-zA-Z(].*/);
    if (match) {
      return {
        farsi:   text.substring(0, match.index).trim(),
        english: match[0].trim(),
      };
    }
    return { farsi: text, english: '' };
  };

  const paymentMethodLabel = {
    BANK_RECEIPT:  'فیش بانکی',
    INSTALLMENT:   'اقساطی',
    ONLINE:        'پرداخت آنلاین',
  };

  // پرداخت‌های تأییدشده‌ی قبلی (سفارش‌های «پرداخت جزئی») — مانده = کل − پرداخت‌شده
  const paidTotal = (order.payments ?? [])
    .filter((p) => p?.status === 'PAID')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAmount = Math.max((order.totalPrice ?? 0) - paidTotal, 0);

  return (
    <div className="bg-white rounded-[6px] border border-gray-200 p-4 sm:p-6 shadow-md mb-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3 sm:pb-4 mb-3 sm:mb-4">
        <MdOutlineReceiptLong className="text-[var(--color-primary)] text-xl sm:text-2xl" />
        <h2 className="text-base sm:text-lg font-bold text-[#1a1a1a] tracking-tight">خلاصه سفارش</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div className="flex flex-col min-w-0">
          <span className="text-gray-500 text-xs mb-1">کد پیگیری:</span>
          <div className="flex items-center gap-2 font-mono text-gray-800 font-bold bg-gray-50 px-3 py-1.5 rounded border border-gray-100 w-full sm:w-fit text-sm">
            <MdOutlineConfirmationNumber className="text-gray-400 flex-shrink-0" />
            {order.trackingCode || (
              <span className="font-sans text-[11px] text-gray-400 leading-relaxed">
                پس از تکمیل پرداخت صادر می‌شود
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-gray-500 text-xs mb-1">روش پرداخت:</span>
          <div className="flex items-center gap-2 text-gray-800 font-medium text-sm">
            <MdOutlinePayment className="text-gray-400 flex-shrink-0" />
            {paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}
          </div>
        </div>
      </div>

      {/* اقلام سفارش */}
      <div className="space-y-0 mb-5 sm:mb-6">
        <span className="text-gray-500 text-xs block mb-2.5 sm:mb-3">اقلام سفارش:</span>

        {order.items.map((item, idx) => {
          // ۱. تشخیص هوشمند کالا دست‌دوم
          const isUsed = item.itemType === 'used_product' || !!item.usedProduct;

          // ۲. اولویت‌دهی به نام و عکس محصول دست‌دوم در صورت وجود
          const productName  = isUsed ? (item.usedProduct?.name || item.product?.name) : item.product?.name;
          const productImage = isUsed ? (item.usedProduct?.mainImage || item.usedProduct?.images?.[0] || item.product?.mainImage) : item.product?.mainImage;
          
          const { farsi, english } = splitName(productName);
          const variantAttrs = item.variant?.attributes ?? null;

          return (
            <div
              key={item.usedProduct?._id || item.product?._id || idx}
              className="flex gap-2.5 sm:gap-3 py-3 sm:py-4 border-b border-[var(--color-primary)]/20 last:border-0"
            >
              {/* تصویر */}
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 border border-[var(--color-primary)]/20 rounded-xl overflow-hidden">
                {productImage && (
                  <img
                    src={productImage}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* اطلاعات */}
              <div className="flex-1 min-w-0">
                {/* نام محصول */}
                <div className="mb-1">
                  {/* لیبل دست دوم برای تفکیک ظاهری */}
                  {isUsed && (
                    <span className="inline-block bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold mb-1 ml-1">
                      دست دوم
                    </span>
                  )}
                  
                  {farsi && (
                    <p className="text-sm font-bold text-[#1a1a1a] leading-snug tracking-tight line-clamp-1">
                      {farsi}
                    </p>
                  )}
                  {english && (
                    <span
                      className="block text-xs font-bold text-[#1a1a1a] tracking-tight"
                      dir="ltr"
                    >
                      {english}
                    </span>
                  )}
                  {!farsi && !english && productName && (
                    <p className="text-sm font-bold text-[#1a1a1a] leading-snug tracking-tight line-clamp-1">
                      {productName}
                    </p>
                  )}
                </div>

                {/* واریانت — زیر نام (مخصوص کالای نو) */}
                {!isUsed && variantAttrs && Object.keys(variantAttrs).length > 0 && (
                  <div className="mb-1.5">
                    <VariantSummary
                      attributes={variantAttrs}
                      attributeImages={item.variant?.attributeImages}
                      attributeUnits={item.variant?.attributeUnits}
                    />
                  </div>
                )}

                {/* قیمت و تعداد */}
                <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    {item.quantity} عدد
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-[#1a1a1a] tracking-tight">
                      {new Intl.NumberFormat('fa-IR').format(item.unitPrice * item.quantity)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">تومان</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* خلاصه قیمت */}
      {(order.discountAmount > 0 || order.couponDiscount > 0) && (
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 text-[13px] sm:text-sm">
          <div className="flex justify-between items-center gap-2 flex-wrap text-gray-500">
            <span>جمع کالاها</span>
            <span className="font-medium text-gray-800">
              {formatPrice(order.subtotalPrice ?? order.totalPrice)}
            </span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between items-center gap-2 flex-wrap text-emerald-600">
              <span>تخفیف</span>
              <span className="font-medium">{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          {order.couponDiscount > 0 && (
            <div className="flex justify-between items-center gap-2 flex-wrap text-emerald-600">
              <span>{order.coupon?.isManual ? "تخفیف مدیریت" : `تخفیف کد «${order.coupon?.code}»`}</span>
              <span className="font-medium">− {formatPrice(order.couponDiscount)}</span>
            </div>
          )}
        </div>
      )}

      {/* پرداخت‌شده تاکنون — فقط برای سفارش‌های دارای پرداخت جزئی تأییدشده */}
      {paidTotal > 0 && (
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 text-[13px] sm:text-sm">
          <div className="flex justify-between items-center gap-2 flex-wrap text-gray-500">
            <span>مبلغ کل سفارش</span>
            <span className="font-medium text-gray-800">{formatPrice(order.totalPrice)}</span>
          </div>
          <div className="flex justify-between items-center gap-2 flex-wrap text-emerald-600">
            <span>پرداخت‌شده تاکنون</span>
            <span className="font-medium">− {formatPrice(paidTotal)}</span>
          </div>
        </div>
      )}

      {/* مبلغ قابل پرداخت */}
      <div className="flex justify-between items-center gap-2 flex-wrap bg-[var(--color-primary)]/5 p-3.5 sm:p-4 rounded-[6px] border border-[var(--color-primary)]/10">
        <span className="font-bold text-[#1a1a1a] text-[13px] sm:text-sm">
          {paidTotal > 0 ? 'مانده قابل پرداخت:' : 'مبلغ قابل پرداخت:'}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-bold text-[var(--color-primary)] tracking-tight">
            {new Intl.NumberFormat('fa-IR').format(remainingAmount)}
          </span>
          <span className="text-xs font-bold text-[var(--color-primary)]/70">تومان</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;