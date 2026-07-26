"use client";

import { useEffect } from "react";

/**
 * پولینگ فقط وقتی تب دیده می‌شود.
 *
 * تب که مخفی شود تایمر متوقف می‌شود؛ با بازگشت، یک واکشیِ فوری انجام و تایمر
 * از سر گرفته می‌شود. هدف حذفِ درخواست‌های بی‌فایده‌ی تبِ پس‌زمینه است — یک تبِ
 * بازِ فراموش‌شده دیگر تا ابد به سرور درخواست نمی‌فرستد.
 *
 * fn با یک آرگومان صدا زده می‌شود: fn(false) برای واکشی اولیه (خطا در UI نشان
 * داده شود) و fn(true) برای پولینگ و بازگشت به تب (بی‌صدا). کال‌بک‌هایی که
 * آرگومان نمی‌گیرند بدون تغییر کار می‌کنند.
 */
export function startVisiblePoll(fn, intervalMs) {
  let id = null;

  const stop = () => {
    if (id) {
      clearInterval(id);
      id = null;
    }
  };
  const start = () => {
    if (!id) id = setInterval(() => fn(true), intervalMs);
  };

  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else {
      fn(true); // داده‌ی کهنه‌ی زمانِ مخفی‌بودن فوراً تازه می‌شود
      start();
    }
  };

  fn(false);
  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export default function useVisiblePoll(fn, intervalMs) {
  useEffect(() => startVisiblePoll(fn, intervalMs), [fn, intervalMs]);
}
