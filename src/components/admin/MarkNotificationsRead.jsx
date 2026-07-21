"use client";

/**
 * <MarkNotificationsRead filter={{ order }} />
 *
 * چیزی رندر نمی‌کند؛ فقط هنگام mount اعلان‌های مرتبط را «خوانده‌شده» می‌کند.
 * در هر صفحه‌ی مقصد (سفارش/تیکت/مربی/…) قرار می‌گیرد تا با «مشاهده‌ی واقعیِ محتوا»
 * اعلان از زنگوله و بَج‌ها فوراً حذف شود. سرور و کلاینت داخل Provider همگام می‌شوند.
 *
 * filter: { order } | { coach } | { ticket } | { type } — پایدار بماند (یا با key کلید).
 */

import { useEffect } from "react";
import { useNotifications } from "./NotificationProvider";

export default function MarkNotificationsRead({ filter }) {
  const { markRead } = useNotifications();
  const key = JSON.stringify(filter || {});

  useEffect(() => {
    if (filter && Object.keys(filter).length) markRead(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
