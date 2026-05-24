/**
 * src/hooks/usePayment.js
 */

// ─── دریافت سفارش با trackingCode ───
export const fetchOrder = async (trackingCode) => {
  if (!trackingCode) throw new Error('Tracking code is required');

  const res = await fetch(`/api/orders/${trackingCode}`, {
    method:      'GET',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    cache:       'no-store',
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || 'Failed to fetch order');

  return data.order;
};

// ─── ارسال رسید بانکی ───
// ⚠️  amount حذف شد — مبلغ از سرور و از روی سفارش خوانده می‌شود
export const submitPaymentReceipt = async ({ orderId, receiptImageUrl }) => {
  try {
    if (!orderId)         throw new Error('orderId الزامی است');
    if (!receiptImageUrl) throw new Error('تصویر رسید الزامی است');

    const res = await fetch('/api/payments/bank-receipt', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        method:          'BANK_RECEIPT',
        receiptImageUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to create payment');

    return { success: true, payment: data.payment };
  } catch (error) {
    return { success: false, error: error.message || 'خطایی رخ داد' };
  }
};
