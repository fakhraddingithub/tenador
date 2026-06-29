"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker).
 *
 * - داده از دیتابیس می‌آید (برندهای دارای لوگو) و از طریقِ prop پاس می‌شود.
 * - برای حلقه‌ی بی‌وقفه، آرایه دوبار پشت‌سرهم رندر می‌شود و ترَک با CSS
 *   (translateX 0 → -50%) حرکت می‌کند؛ چون هر دو نیمه دقیقاً یکسان‌اند، در
 *   نقطه‌ی بازگشت هیچ پرش یا فاصله‌ای دیده نمی‌شود (فاصله‌ها per-item هستند، نه gap).
 * - هر لوگو کلیک‌پذیر است و به `${basePath}/${slug}` می‌رود:
 *     • صفحه‌ی اصلی → basePath="" → /[brandSlug]
 *     • صفحه‌ی ورزش → basePath="/[sportSlug]" → /[sportSlug]/[brandSlug]
 */

import React from "react";
import Link from "next/link";
import styles from "@/styles/BrandSection.module.css";

const BrandsTicker = ({ brands = [], basePath = "" }) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;

  // نیمه‌ی دوم صرفاً برای پیوستگیِ بصری است → از دسترس‌پذیری و tab خارج می‌شود.
  const loop = [...brands, ...brands];

  return (
    <section className={styles.brandSection} aria-label="برندها">
      <div className={styles.brandTrack}>
        {loop.map((brand, index) => {
          const isClone = index >= brands.length;
          return (
            <Link
              key={`${brand.slug}-${index}`}
              href={`${basePath}/${brand.slug}`}
              className={styles.brandLogo}
              title={brand.name}
              aria-hidden={isClone ? true : undefined}
              tabIndex={isClone ? -1 : undefined}
            >
              <img
                src={brand.logo}
                alt={brand.name}
                className={styles.logoImage}
                loading="lazy"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default BrandsTicker;
