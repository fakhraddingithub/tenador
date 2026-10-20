"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * تکه‌های مشترکِ رابطِ بلوک‌ها. پیش از این داخلِ BlockEditor تعریف شده بودند؛
 * حالا ویرایشگرِ پیش‌نمایش هم همان مودال‌ها را باز می‌کند، پس یک نسخه بیشتر
 * نباید وجود داشته باشد.
 */

// ظاهرِ کادر در admin-theme.css (.be-input، لایه‌ی components) است؛ utilityهای کنارش
// (ps-2، text-xs در مودالِ چیدمان) همچنان بی‌زور از آن می‌برند. کادرِ عرض‌ثابت
// «be-input w-28» می‌گیرد نه inputClass + w-28: دو utilityِ width با هم می‌جنگند و
// w-full می‌برد — همان که نوارِ لغزنده‌ی اسلایدر را به یک نقطه رسانده بود.
export const inputClass = "be-input w-full";

// مودال‌ها به body می‌روند: هر نیایی با transform یا backdrop-filter (مثلِ کارتِ
// مینی‌مقاله با backdrop-blur) بلوکِ دربرگیرنده‌ی position:fixed می‌شود و مودال را
// در خودش حبس می‌کند. متغیرهای تمِ ادمین روی .admin-scope تعریف شده‌اند، پس
// پورتال هم داخلِ همان کلاس می‌نشیند؛ `contents` نمی‌گذارد پس‌زمینه‌ی آن رنگ شود.
export const AdminPortal = ({ children }) => createPortal(<div className="admin-scope contents" dir="rtl">{children}</div>, document.body);

// بالاتر از هر لایه‌ی ویرایشگر: نوارهای شناور (۴۰/۵۰)، مودال‌ها و کتابخانه‌ی بلوک (۱۰۰).
const FLOATING_Z = 130;

/**
 * فهرستِ بازشو (نتایجِ جستجو، فهرستِ اندازه‌ی قلم) که هیچ ظرفی نمی‌تواند ببُردش.
 *
 * علت: نتایج `absolute top-full` داخلِ فیلد بودند و هر نیایی با overflow — بدنه‌ی
 * اسکرول‌خورِ مودالِ پیش‌نمایش (max-h-[68vh] overflow-y-auto)، قابِ کارت، چاهکِ
 * بلوک‌های تودرتو — آن‌ها را می‌بُرید؛ z-index در برابرِ overflow کاری نمی‌کند. پس
 * فهرست به body می‌رود (AdminPortal) و با position: fixed به خودِ کادر لنگر می‌شود:
 * با هر اسکرولِ هر نیا (capture) و تغییرِ اندازه دوباره جا می‌گیرد، و اگر زیرِ کادر
 * جا نباشد بالای آن باز می‌شود.
 *
 * matchWidth: هم‌عرضِ کادر (جستجو)؛ وگرنه `width` px از لبه‌ی راستِ کادر (RTL).
 * panelRef: برای «کلیکِ بیرون» — فهرست دیگر داخلِ DOM ـِ خودِ فیلد نیست.
 */
export function FloatingPanel({ anchorRef, open, children, matchWidth = true, width = 112, maxHeight = 256, panelRef, className = "", ...rest }) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor) return undefined;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = anchor.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const up = below < Math.min(maxHeight, 180) && above > below;
        const panelWidth = matchWidth ? rect.width : width;
        const left = Math.min(Math.max(8, matchWidth ? rect.left : rect.right - panelWidth), window.innerWidth - panelWidth - 8);
        setBox({
          left,
          width: panelWidth,
          ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          maxHeight: Math.max(120, Math.min(maxHeight, up ? above : below)),
        });
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      observer.disconnect();
      setBox(null);
    };
  }, [open, anchorRef, matchWidth, width, maxHeight]);

  if (!open || !box) return null;
  return <AdminPortal>
    <div ref={panelRef} style={{ position: "fixed", zIndex: FLOATING_Z, ...box }} className={`overflow-y-auto ${className}`} {...rest}>{children}</div>
  </AdminPortal>;
}
