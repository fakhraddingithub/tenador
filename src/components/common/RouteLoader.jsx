"use client";

/**
 * src/components/common/RouteLoader.jsx
 *
 * صفحه‌ی بارگذاریِ سطح-روت (App Router). به‌صورتِ خودکار به‌عنوان fallbackِ مرز
 * Suspense هنگام ناوبری به هر صفحه نمایش داده می‌شود (هر سه‌ گروهِ Site/Admin/User
 * از همین کامپوننت استفاده می‌کنند).
 *
 * - لوگوی سایت در مرکز + انیمیشنِ توپِ جهنده، روی پس‌زمینه‌ی تیره‌ی #0d0d0d.
 * - overlayِ position:fixed است؛ پس همیشه وسطِ ویوپورت دیده می‌شود و هرگز
 *   «چسبیده به پایین/فوتر» نمایش داده نمی‌شود (رفعِ باگِ موقعیتِ اسکرول).
 * - هنگامِ mount بلافاصله به بالای صفحه اسکرول می‌کند تا محتوای صفحه‌ی جدید هم
 *   پس از پایانِ بارگذاری از بالا شروع شود.
 */

import { useEffect } from "react";
import Image from "next/image";
import styles from "./RouteLoader.module.css";

export default function RouteLoader() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return (
    <div className={styles.overlay} role="status" aria-label="در حال بارگذاری">
      <Image
        src="/logo/logo.svg"
        alt="تنادور"
        width={180}
        height={72}
        priority
        className={styles.logo}
      />
      <span className={styles.loader} aria-hidden="true" />
    </div>
  );
}
