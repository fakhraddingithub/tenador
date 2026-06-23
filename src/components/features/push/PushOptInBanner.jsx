'use client';

/**
 * PushOptInBanner
 *
 * بنرِ غیرمزاحمِ درخواستِ اجازهٔ نوتیفیکیشن، مخصوصِ صفحهٔ محصولات دست‌دوم.
 *
 * رفتار (مطابق Step 5):
 *  - ابتدا پشتیبانی مرورگر و وضعیت اجازه را بررسی می‌کند.
 *  - به‌جای پاپ‌آپِ خام مرورگر، یک کارتِ توضیحیِ درون‌صفحه نشان می‌دهد.
 *  - با کلیک روی «بله، اطلاع بده» → درخواست اجازهٔ مرورگر → در صورت تأیید،
 *    اشتراک را با POST /api/push/subscribe ذخیره می‌کند.
 *  - با رد/بستن → تا پایان این نشست دیگر نمایش داده نمی‌شود (sessionStorage).
 *  - اگر قبلاً subscribe شده یا اجازه denied است → نمایش داده نمی‌شود.
 */

import { useEffect, useState } from 'react';
import { FiBell, FiX } from 'react-icons/fi';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = 'tenador_push_dismissed';

// تبدیل کلید VAPID از base64url به Uint8Array (موردنیازِ pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushOptInBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // ۱) پشتیبانی مرورگر
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY تنظیم نشده — بنر نمایش داده نمی‌شود.');
        return;
      }

      // ۲) اگر در این نشست رد کرده → بی‌خیال
      if (sessionStorage.getItem(DISMISS_KEY)) return;

      // ۳) اگر اجازه قبلاً رد شده → دیگر نپرس
      if (Notification.permission === 'denied') return;

      try {
        // ثبتِ Service Worker (در ریشهٔ سایت تا scope کامل داشته باشد)
        const registration = await navigator.serviceWorker.register('/sw.js');

        // ۴) اگر از قبل subscribe شده → بنر را نشان نده
        const existing = await registration.pushManager.getSubscription();
        if (existing) return;

        if (!cancelled) setVisible(true);
      } catch (err) {
        console.error('[push] service worker registration failed:', err);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        // رد یا نادیده گرفته شد → تا پایان نشست دیگر نپرس
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) throw new Error('subscribe API failed');

      setVisible(false);
    } catch (err) {
      console.error('[push] enable failed:', err);
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 inset-x-4 z-[60] mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl shadow-black/10 sm:bottom-6 sm:left-6 sm:right-auto sm:mx-0"
      role="dialog"
      aria-label="اجازهٔ دریافت نوتیفیکیشن"
    >
      <button
        onClick={dismiss}
        aria-label="بستن"
        className="absolute top-3 left-3 text-gray-400 transition-colors hover:text-gray-600"
      >
        <FiX size={18} />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <FiBell size={20} />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-bold text-[var(--color-text)]">
            از محصولات دست‌دوم جدید باخبر شو
          </h3>
          <p className="text-xs leading-relaxed text-gray-500">
            با فعال‌کردن نوتیفیکیشن، به‌محضِ افزوده‌شدنِ هر «محصول دست دوم جدید» به تو اطلاع می‌دهیم.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={enable}
          disabled={busy}
          className="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'در حال فعال‌سازی…' : 'بله، اطلاع بده'}
        </button>
        <button
          onClick={dismiss}
          disabled={busy}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          فعلاً نه
        </button>
      </div>
    </div>
  );
}
