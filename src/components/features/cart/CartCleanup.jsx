'use client';

/**
 * src/components/features/cart/CartCleanup.jsx
 *
 * پاک‌سازی یک‌باره‌ی داده‌های قدیمی/خراب سبد خرید.
 * فقط یک‌بار به‌ازای هر مرورگر اجرا می‌شود (پرچم cart_cleanup_v1_done در localStorage).
 * به وضعیت ورود/نشست کاربر دست نمی‌زند — صرفاً کلیدهای مربوط به سبد را پاک می‌کند.
 *
 * این کامپوننت چیزی رندر نمی‌کند.
 */

import { useEffect } from 'react';
import { runOneTimeCartCleanup } from '@/lib/cart';

export default function CartCleanup() {
  useEffect(() => {
    runOneTimeCartCleanup();
  }, []);

  return null;
}
