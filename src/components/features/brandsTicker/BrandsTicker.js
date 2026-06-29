"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker).
 *
 * - داده از دیتابیس می‌آید (برندهای دارای لوگو) و از طریقِ prop پاس می‌شود.
 * - حلقه‌ی بی‌وقفه با تکنیکِ استاندارد: لیست دوبار کنارِ هم رندر می‌شود (اصلی +
 *   دوقلو) و کلِ ترَک با CSS از translateX(0) تا translateX(-50%) حرکت می‌کند؛
 *   چون هر دو گروه دقیقاً یکسان‌اند، در نقطه‌ی ریست (بازگشت به ۰) دوقلو جای
 *   خالی را پر کرده و هیچ پرشی دیده نمی‌شود.
 * - هر لوگو کلیک‌پذیر است و به `${basePath}/${slug}` می‌رود:
 *     • صفحه‌ی اصلی → basePath="" → /[brandSlug]
 *     • صفحه‌ی ورزش → basePath="/[sportSlug]" → /[sportSlug]/[brandSlug]
 */

import React from "react";
import Link from "next/link";
import styles from "@/styles/BrandSection.module.css";

const BrandGroup = ({ brands, basePath, clone = false }) => (
  <div className={styles.brandGroup} aria-hidden={clone ? true : undefined}>
    {brands.map((brand, index) => (
      <Link
        key={`${brand.slug}-${index}`}
        href={`${basePath}/${brand.slug}`}
        className={styles.brandLogo}
        title={brand.name}
        tabIndex={clone ? -1 : undefined}
      >
        <img
          src={brand.logo}
          alt={brand.name}
          className={styles.logoImage}
          loading="lazy"
        />
      </Link>
    ))}
  </div>
);

const BrandsTicker = ({ brands = [], basePath = "" }) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;

  return (
    <section className={styles.brandSection} aria-label="برندها">
      <div className={styles.brandTrack}>
        <BrandGroup brands={brands} basePath={basePath} />
        <BrandGroup brands={brands} basePath={basePath} clone />
      </div>
    </section>
  );
};

export default BrandsTicker;
