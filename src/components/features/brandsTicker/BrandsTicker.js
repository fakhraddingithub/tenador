"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker) — بازنویسیِ کامل.
 *
 * حلقه‌ی بی‌وقفه (فقط CSS):
 *   • آرایه دوبار در DOM رندر می‌شود: [...brands, ...brands]
 *   • هر دو نسخه داخلِ یک فلکسِ بدونِ wrap هستند و عرضِ ترَک به‌صورتِ طبیعی
 *     (width: max-content) برابرِ مجموعِ هر دو نسخه می‌شود.
 *   • keyframe از translateX(0) تا translateX(-50%) حرکت می‌کند؛ چون عرضِ کل
 *     دقیقاً دو برابرِ یک نسخه است، -۵۰٪ یعنی ابتدای نسخه‌ی دوم → بدونِ پرش.
 *   • linear + infinite، روی hover مکث می‌کند. هیچ جاوااسکریپتی در انیمیشن نیست.
 *
 * بازرنگ‌سازی (mask approach):
 *   • به‌جای filter/hue-rotate، لوگو به‌عنوانِ ماسک روی یک لایه با
 *     background-color: #aa4725 استفاده می‌شود → رنگِ خروجی همیشه دقیقاً پرایمری
 *     است، فارغ از رنگِ اصلیِ لوگو (مشکی، رنگی، چندرنگ).
 *   • روی hover لایه‌ی ماسک محو و تصویرِ واقعیِ برند (رنگِ اصلی) نمایان می‌شود.
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
              style={{ "--logo-url": `url("${brand.logo}")` }}
            >
              {/* لایه‌ی بازرنگ‌شده با ماسک — رنگِ ثابتِ #aa4725 */}
              <span className={styles.logoMask} aria-hidden="true" />
              {/* تصویرِ واقعیِ برند — فقط روی hover نمایان می‌شود */}
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
