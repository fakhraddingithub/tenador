"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiHelpCircle } from "react-icons/fi";

/**
 * src/components/templates/product/AttributeInfoTooltip.jsx
 *
 * آیکون راهنمای (؟) کنار نام ویژگی در تب «مشخصات فنی» + تولتیپِ توضیح آن.
 *
 * این کامپوننت «کنترل‌شده» است: وضعیتِ باز/بسته را والد (جدولِ مشخصات) نگه می‌دارد
 * تا کلیک روی کلِ ردیف، تولتیپِ همان ردیف را باز کند و همیشه فقط یکی باز بماند.
 *  - آیکون فقط نشانگر است؛ کلیکِ بازکننده روی خودِ ردیف انجام می‌شود (rowRef).
 *  - کلیک بیرون از ردیف و تولتیپ → onClose.
 *  - موقعیت‌یابیِ خودکار: fixed نسبت به آیکون، مهارِ افقی داخل ویوپورت و چرخش به
 *    پایین وقتی فضای بالا (زیر نوار ناوبری) کافی نیست. رندر در portal روی body تا
 *    توسط کانتینرهای overflow کلیپ نشود.
 *  - لایه‌بندی: zIndex زیر نوار ناوبری (که z-50 است) ولی بالای محتوای صفحه.
 *
 * اگر description خالی باشد، هیچ آیکونی رندر نمی‌شود (سازگاری با داده‌ی قبلی).
 */

// ارتفاعِ نوار ناوبریِ ثابت (h-[75px]) + کمی فاصله — مرزِ امنِ بالا برای چرخش تولتیپ
const NAVBAR_SAFE = 84;
// تولتیپ زیر نوار ناوبری (z-50) و بالای محتوای صفحه قرار می‌گیرد
const TOOLTIP_Z = 40;

export default function AttributeInfoTooltip({ description, open, onClose, rowRef }) {
  const [coords, setCoords] = useState(null); // { top, left, placement, arrowLeft }

  const iconRef = useRef(null);
  const tipRef = useRef(null);

  const computePosition = useCallback(() => {
    const icon = iconRef.current;
    const tip = tipRef.current;
    // وقتی بسته است tip رندر نشده → مختصات ریست می‌شود تا بازِ بعدی تازه اندازه بگیرد
    if (!icon || !tip) {
      setCoords(null);
      return;
    }

    const r = icon.getBoundingClientRect();
    const tipW = tip.offsetWidth || 240;
    const tipH = tip.offsetHeight || 60;
    const margin = 8; // فاصله از لبه‌ی ویوپورت
    const gap = 8; // فاصله‌ی تولتیپ از آیکون

    // پیش‌فرض بالا؛ اگر زیرِ نوار ناوبری بیفتد به پایین برگردان
    let placement = "top";
    let top = r.top - gap - tipH;
    if (top < NAVBAR_SAFE) {
      placement = "bottom";
      top = r.bottom + gap;
    }

    const center = r.left + r.width / 2;
    let left = center - tipW / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tipW - margin));

    // موقعیت افقیِ فلش نسبت به خودِ تولتیپ (همیشه زیر مرکز آیکون)
    const arrowLeft = Math.max(12, Math.min(center - left, tipW - 12));

    setCoords({ top, left, placement, arrowLeft });
  }, []);

  // با باز شدن، اندازه‌ی واقعیِ تولتیپ اندازه‌گیری و موقعیت تنظیم می‌شود؛ با بسته
  // شدن، مختصات null می‌شود. تا پیش از محاسبه opacity:0 است تا پرشی دیده نشود.
  useEffect(() => {
    computePosition();
  }, [open, computePosition]);

  // بستن با کلیک بیرون + هم‌گام‌سازی موقعیت هنگام اسکرول/تغییر اندازه
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rowRef?.current?.contains(e.target) || tipRef.current?.contains(e.target)) return;
      onClose?.();
    };
    const onReflow = () => computePosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, computePosition, onClose, rowRef]);

  const text = typeof description === "string" ? description.trim() : "";
  if (!text) return null;

  // portal فقط روی کلاینت (پس از باز شدن) رندر می‌شود؛ در SSR document وجود ندارد.
  const canPortal = typeof document !== "undefined";

  return (
    <>
      <span
        ref={iconRef}
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 transition-colors ${
          open ? "text-[#aa4725]" : "text-gray-400 group-hover:text-[#aa4725]"
        }`}
      >
        <FiHelpCircle size={16} />
      </span>

      {open &&
        canPortal &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            dir="rtl"
            style={{
              position: "fixed",
              top: coords ? coords.top : -9999,
              left: coords ? coords.left : -9999,
              maxWidth: 260,
              opacity: coords ? 1 : 0,
              zIndex: TOOLTIP_Z,
            }}
            className="rounded-lg bg-[#1a1c22] px-3 py-2 text-[12px] font-medium leading-6 text-gray-100 shadow-xl pointer-events-auto"
          >
            {text}
            {coords && (
              <span
                className="absolute h-2 w-2 rotate-45 bg-[#1a1c22]"
                style={{
                  left: coords.arrowLeft - 4,
                  ...(coords.placement === "top" ? { bottom: -4 } : { top: -4 }),
                }}
              />
            )}
          </div>,
          document.body
        )}
    </>
  );
}
