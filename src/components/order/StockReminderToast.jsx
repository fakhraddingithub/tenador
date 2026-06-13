'use client';

/**
 * src/components/order/StockReminderToast.jsx
 *
 * اعلان «بررسی موجودی کالاها» — کامپوننت مشترک بین سبد خرید کشویی (CartDrawer)
 * و صفحه ثبت سفارش (signOrder).
 *
 * رفتار:
 *  - وقتی شرایط نمایش (active) برقرار شد، با انیمیشن slide-up ظاهر می‌شود.
 *  - تا زمانی که کاربر دستی نبندد باقی می‌ماند (به‌صورت خودکار بسته نمی‌شود).
 *  - کلیک روی بدنه، گفتگوی واتس‌اپ پشتیبانی را برای استعلام موجودی باز می‌کند.
 *  - دکمه × فقط همین اعلان را می‌بندد (لینک واتس‌اپ باز نمی‌شود).
 *  - با خالی شدن سبد (active=false) پنهان می‌شود.
 *
 * نکته نمایش مجدد: این کامپوننت در هر بار mount از نو شروع می‌کند؛ چون
 * CartDrawer هنگام بسته شدن کل خود را unmount می‌کند، با هر بار باز شدن سبد
 * اعلان دوباره نمایش داده می‌شود.
 */

import { useEffect, useRef, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

// لینک واقعی واتس‌اپ (با پیام آماده) — در موبایل اپ و در دسکتاپ واتس‌اپ‌وب باز می‌شود
export const SUPPORT_WHATSAPP_URL =
    'https://wa.me/33743649300?text=' +
    encodeURIComponent('سلام، لطفاً موجودی کالاهای سبد خرید من را بررسی کنید.');

export default function StockReminderToast({ active, floating = false }) {
    const [mounted, setMounted] = useState(false); // در DOM هست؟
    const [visible, setVisible] = useState(false); // کلاس انیمیشن slide-up
    const dismissedRef = useRef(false); // کاربر همین بار آن را بسته است؟

    // تصمیم نمایش: با برقراری شرایط (و نبودن dismiss) نمایش بده؛ با از بین رفتن شرایط پنهان کن
    useEffect(() => {
        if (active && !dismissedRef.current) {
            setMounted(true);
        } else if (!active) {
            setMounted(false);
            setVisible(false);
        }
    }, [active]);

    // اجرای transition پس از paint اولیه در حالت پنهان (double rAF)
    // ⚠️ این افکت جداست تا re-run شدنِ افکت تصمیم، تایمر انیمیشن را پاک نکند
    useEffect(() => {
        if (!mounted) return;
        let raf2 = null;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setVisible(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            if (raf2 !== null) cancelAnimationFrame(raf2);
        };
    }, [mounted]);

    const dismiss = () => {
        dismissedRef.current = true;
        setVisible(false);
        // پس از پایان انیمیشن از DOM حذف شود
        setTimeout(() => setMounted(false), 300);
    };

    if (!mounted || !active) return null;

    return (
        <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            role="status"
            aria-live="polite"
            className={`
                ${floating ? 'absolute bottom-3 inset-x-3' : 'relative'}
                z-40 flex items-center gap-3
                bg-[#1f1f1f]/95 backdrop-blur-sm text-white
                rounded-xl shadow-2xl px-4 py-3
                cursor-pointer select-none no-underline
                transition-all duration-300 ease-out
                ${visible
                    ? 'translate-y-0 opacity-100 pointer-events-auto'
                    : 'translate-y-6 opacity-0 pointer-events-none'}
            `}
        >
            {/* آیکن واتس‌اپ */}
            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.03a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.12.82.83-3.04-.2-.31a8.07 8.07 0 0 1-1.24-4.28c0-4.47 3.64-8.1 8.16-8.1 4.47 0 8.1 3.63 8.1 8.1s-3.63 8.12-8.1 8.12zm4.44-6.07c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.43-1.35-1.68-.14-.24-.02-.37.11-.5.11-.11.24-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.65.3-.22.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.72 2.62 4.16 3.68.58.25 1.04.4 1.39.51.58.19 1.12.16 1.54.1.47-.07 1.44-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28z" />
                </svg>
            </span>

            <p className="flex-1 text-xs leading-6 text-gray-100">
                لطفاً از موجود بودن کالاهای سبد خریدتان اطمینان حاصل کنید.
                <span className="block text-[10px] text-gray-400 mt-0.5">
                    برای استعلام موجودی، با پشتیبانی واتس‌اپ در تماس باشید
                </span>
            </p>

            {/* بستن — فقط اعلان را می‌بندد و واتس‌اپ باز نمی‌شود */}
            <button
                type="button"
                aria-label="بستن اعلان"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismiss();
                }}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
                <FaTimes size={12} />
            </button>
        </a>
    );
}
