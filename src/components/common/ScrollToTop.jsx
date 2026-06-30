"use client";

/**
 * src/components/common/ScrollToTop.jsx
 *
 * هر بار که مسیر (pathname) تغییر می‌کند، فوراً به بالای صفحه اسکرول می‌کند.
 * این هم ناوبریِ <Link> و هم router.push برنامه‌نویسی را پوشش می‌دهد، چون هر دو
 * pathname را عوض می‌کنند.
 *
 * نکته: usePathname شاملِ searchParams نیست؛ پس تغییرِ فیلترها (که فقط
 * query را عوض می‌کنند و عمداً با scroll:false هستند) باعثِ اسکرول نمی‌شود.
 *
 * behavior:"instant" تضمین می‌کند حتی با وجودِ scroll-behavior:smooth (مثلاً روی
 * <html className="scroll-smooth"> در پنل ادمین) پرش به بالا آنی باشد، نه نرم.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
