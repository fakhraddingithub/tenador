
import React from 'react';
import { MdOutlineConfirmationNumber, MdOutlineReceiptLong, MdOutlinePayment } from 'react-icons/md';

const OrderSummary = ({ order }) => {
  const formatPrice = (price) => new Intl.NumberFormat('fa-IR').format(price) + ' تومان';

  return (
    <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
        <MdOutlineReceiptLong className="text-[var(--color-primary)] text-2xl" />
        <h2 className="text-lg font-bold">خلاصه سفارش</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col">
          <span className="text-gray-500 text-sm mb-1">کد پیگیری:</span>
          <div className="flex items-center gap-2 font-mono text-gray-800 font-bold bg-gray-50 px-3 py-1 rounded border border-gray-100 w-fit">
            <MdOutlineConfirmationNumber className="text-gray-400" />
            {order.trackingCode}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 text-sm mb-1">روش پرداخت:</span>
          <div className="flex items-center gap-2 text-gray-800 font-medium">
            <MdOutlinePayment className="text-gray-400" />
            {order.paymentMethod === 'BANK_RECEIPT' ? 'فیش بانکی' : 'اقساطی'}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <span className="text-gray-500 text-sm block mb-2">اقلام سفارش:</span>

        {order.items.map((item) => (
          <div
            key={item.product._id}
            className="flex justify-between py-4 border-b border-[var(--color-primary)]/30 min-h-[90px]"
          >
            <div className="relative w-14 h-14 md:w-18 md:h-18 flex-shrink-0 border border-[var(--color-primary)]/30 rounded-md">
              <img
                src={item.product.mainImage}
                alt={item.product.name}
                className="
                  w-full h-full object-cover
                  rounded-xl border border-slate-100
                "
              />
            </div>

            <div className='pr-2'>
              {/* Top Section: Name + Quantity */}
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-gray-800 leading-6 line-clamp-2">
                  {item.product.name}
                </span>

                <span className="shrink-0 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs px-2 py-1 rounded-full">
                  × {item.quantity}
                </span>
              </div>

              {/* Bottom Section: Price */}
              <div className="text-sm font-semibold text-gray-900 text-left mt-3">
                {formatPrice(item.product.basePrice * item.quantity)}
              </div>
            </div>
          </div>
        ))}



      </div>

      <div className="flex justify-between items-center bg-[var(--color-primary)]/5 p-4 rounded-[6px] border border-[var(--color-primary)]/10">
        <span className="font-bold text-gray-800">مبلغ قابل پرداخت:</span>
        <span className="text-xl font-bold text-[var(--color-primary)]">{formatPrice(order.totalPrice)}</span>
      </div>
    </div>
  );
};

export default OrderSummary;
