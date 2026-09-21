"use client";

import { createPortal } from "react-dom";

/**
 * تکه‌های مشترکِ رابطِ بلوک‌ها. پیش از این داخلِ BlockEditor تعریف شده بودند؛
 * حالا ویرایشگرِ پیش‌نمایش هم همان مودال‌ها را باز می‌کند، پس یک نسخه بیشتر
 * نباید وجود داشته باشد.
 */

export const inputClass = "w-full px-3 py-2.5 border bg-gray-50 text-sm outline-none focus:bg-white focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

// مودال‌ها به body می‌روند: هر نیایی با transform یا backdrop-filter (مثلِ کارتِ
// مینی‌مقاله با backdrop-blur) بلوکِ دربرگیرنده‌ی position:fixed می‌شود و مودال را
// در خودش حبس می‌کند. متغیرهای تمِ ادمین روی .admin-scope تعریف شده‌اند، پس
// پورتال هم داخلِ همان کلاس می‌نشیند؛ `contents` نمی‌گذارد پس‌زمینه‌ی آن رنگ شود.
export const AdminPortal = ({ children }) => createPortal(<div className="admin-scope contents" dir="rtl">{children}</div>, document.body);
