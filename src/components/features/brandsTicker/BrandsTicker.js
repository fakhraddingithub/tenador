"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker).
 *
 * - داده از دیتابیس می‌آید (برندهای دارای لوگو) و از طریقِ prop پاس می‌شود.
 * - حلقه‌ی بی‌وقفه با تکنیکِ استاندارد و فقط با CSS:
 *     • آرایه دوبار در DOM رندر می‌شود: [...brands, ...brands]
 *     • کلِ ترَک با keyframe از translateX(0) تا translateX(-50%) حرکت می‌کند
 *     • چون عرضِ کل دقیقاً دو برابرِ یک نسخه است، -۵۰٪ یعنی دقیقاً ابتدای نسخه‌ی
 *       دوم؛ هنگامِ ریست به ۰، نسخه‌ی دوم جای خالی را پر کرده و پرشی دیده نمی‌شود.
 *     • animation-iteration-count: infinite, timing-function: linear (در CSS)
 *     • هیچ تایمر/منطقِ ریستِ جاوااسکریپتی — صرفاً keyframeِ CSS.
 * - هر لوگو کلیک‌پذیر است و به `${basePath}/${slug}` می‌رود:
 *     • صفحه‌ی اصلی → basePath="" → /[brandSlug]
 *     • صفحه‌ی ورزش → basePath="/[sportSlug]" → /[sportSlug]/[brandSlug]
 */

import React from "react";
import Link from "next/link";
import styles from "@/styles/BrandSection.module.css";

const BrandsTicker = ({ brands = [], basePath = "" }) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;

  // نسخه‌ی دوم (clone) صرفاً برای پیوستگیِ بصری است → از دسترس‌پذیری/تب خارج می‌شود.
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
