"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker) — بازسازی بر اساسِ نسخه‌ی مرجعِ پروداکشن.
 *
 * ساختار دقیقاً مطابقِ مرجع:
 *   section.brandSection > div.brandTrack > a.brandLogo > img.logoImage
 *
 * بازرنگ‌سازی: فقط CSS `filter` روی <img> (نه mask). با mask لوگوهای کاملاً
 * مات (PNG/JPG با پس‌زمینه) به مستطیلِ توپُر تبدیل می‌شدند؛ filter پیکسل‌های
 * واقعیِ تصویر را حفظ می‌کند و فقط آن‌ها را به رنگِ پرایمری (#aa4725) می‌بَرَد.
 *
 * حلقه: آرایه دوبار رندر می‌شود ([...brands, ...brands]) و کلِ ترَک با keyframe
 * از translateX(0) تا translateX(-50%) حرکت می‌کند (linear, infinite، فقط CSS).
 * فاصله‌ی بینِ لوگوها به‌جای flex-gap به‌صورتِ margin روی هر آیتم گذاشته شده تا
 * عرضِ ترَک دقیقاً دو برابرِ یک نسخه شود و -۵۰٪ بدونِ پرشِ نیم‌گپ روی درز بنشیند.
 *
 * مسیرِ کلیک:
 *   • sportSlug داده شود → /[sportSlug]/[brandSlug]
 *   • sportSlug داده نشود → /[brandSlug]
 */

import React from "react";
import Link from "next/link";
import styles from "@/styles/BrandSection.module.css";

const BrandsTicker = ({ brands = [], sportSlug = "" }) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;

  // دو نسخه برای پیوستگیِ بصری؛ نسخه‌ی دوم (clone) از دسترس‌پذیری خارج می‌شود.
  const loop = [...brands, ...brands];

  return (
    <section className={styles.brandSection} aria-label="برندها">
      <div className={styles.brandTrack}>
        {loop.map((brand, index) => {
          const isClone = index >= brands.length;
          const href = sportSlug
            ? `/${sportSlug}/${brand.slug}`
            : `/${brand.slug}`;

          return (
            <Link
              key={`${brand.slug}-${index}`}
              href={href}
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
