"use client";

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
