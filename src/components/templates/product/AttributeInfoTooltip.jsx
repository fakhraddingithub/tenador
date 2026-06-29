"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiHelpCircle } from "react-icons/fi";

/**
 * src/components/templates/product/AttributeInfoTooltip.jsx
 *
 * آیکون راهنمای کوچک (؟) کنار نام ویژگی در تب «مشخصات فنی».
 * با کلیک، توضیح ویژگی را در یک تولتیپِ مینیمال بالای آیکون نشان می‌دهد:
 *  - کلیک بیرون از تولتیپ آن را می‌بندد.
 *  - چون با هر کلیکِ بیرونی بسته می‌شود، همیشه فقط یک تولتیپ هم‌زمان باز است.
 *  - موقعیت‌یابیِ خودکار: به‌صورت fixed نسبت به آیکون، با مهارِ افقی داخل ویوپورت و
 *    چرخش به پایین وقتی فضای بالا کافی نیست — بنابراین از لبه‌ی صفحه بیرون نمی‌زند
 *    و توسط کانتینرهای overflow کلیپ نمی‌شود (رندر در portal روی body).
 *
 * اگر description خالی باشد، هیچ آیکونی رندر نمی‌شود (سازگاری با داده‌ی قبلی).
 */
export default function AttributeInfoTooltip({ description }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { top, left, placement, arrowLeft }

  const btnRef = useRef(null);
  const tipRef = useRef(null);

  const computePosition = useCallback(() => {
    const btn = btnRef.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;

    const r = btn.getBoundingClientRect();
    const tipW = tip.offsetWidth || 240;
    const tipH = tip.offsetHeight || 60;
    const margin = 8; // فاصله از لبه‌ی ویوپورت
    const gap = 8; // فاصله‌ی تولتیپ از آیکون

    // پیش‌فرض بالا؛ اگر جا نبود به پایین برگردان
    let placement = "top";
    let top = r.top - gap - tipH;
    if (top < margin) {
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

  // پس از باز شدن، اندازه‌ی واقعیِ تولتیپ را اندازه‌گیری و موقعیت را تنظیم کن.
  // تا پیش از محاسبه، تولتیپ با opacity:0 و خارج از کادر است تا پرشی دیده نشود.
  useEffect(() => {
    if (open) computePosition();
  }, [open, computePosition]);

  // بستن با کلیک بیرون + هم‌گام‌سازی موقعیت هنگام اسکرول/تغییر اندازه
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (btnRef.current?.contains(e.target) || tipRef.current?.contains(e.target)) return;
      setOpen(false);
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
  }, [open, computePosition]);

  const text = typeof description === "string" ? description.trim() : "";
  if (!text) return null;

  // portal فقط روی کلاینت (پس از باز شدن) رندر می‌شود؛ در SSR document وجود ندارد.
  const canPortal = typeof document !== "undefined";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="توضیح ویژگی"
        aria-expanded={open}
        className={`inline-flex items-center justify-center text-gray-300 hover:text-[#aa4725] transition-colors shrink-0 ${
          open ? "text-[#aa4725]" : ""
        }`}
      >
        <FiHelpCircle size={13} />
      </button>

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
              zIndex: 9999,
            }}
            className="rounded-lg bg-[#1a1c22] px-3 py-2 text-[12px] font-medium leading-6 text-gray-100 shadow-xl pointer-events-auto"
          >
            {text}
            {coords && (
              <span
                className="absolute h-2 w-2 rotate-45 bg-[#1a1c22]"
                style={{
                  left: coords.arrowLeft - 4,
                  ...(coords.placement === "top"
                    ? { bottom: -4 }
                    : { top: -4 }),
                }}
              />
            )}
          </div>,
          document.body
        )}
    </>
  );
}
