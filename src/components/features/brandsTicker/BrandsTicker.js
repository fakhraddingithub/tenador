"use client";

/**
 * نوار حلقه‌ایِ برندها (seamless ticker).
 *
 * Bug 1 — رنگِ دقیق: به‌جای filter (که با hue-rotate تقریبی و وابسته به رنگِ
 *   مبدأ بود) از تکنیکِ mask استفاده می‌شود: لوگو به‌عنوانِ ماسک روی یک لایه با
 *   background-color:#aa4725 → خروجی همیشه دقیقاً #aa4725 است.
 *   ⚠️ نکته‌ی اثبات‌شده: mask بر اساسِ کانالِ آلفا کار می‌کند؛ پس لوگوهایی که
 *   پس‌زمینه‌ی شفاف دارند (PNG/SVG ترنسپرنت) به سیلوئتِ دقیق تبدیل می‌شوند، اما
 *   فایل‌هایی که پس‌زمینه‌ی توپُر دارند به مستطیلِ توپُر می‌رسند (ذاتِ ماسک).
 *   هاور → لایه‌ی ماسک محو و تصویرِ واقعیِ برند (رنگِ اصلی) دیده می‌شود.
 *
 * Bug 2 — خالی‌شدنِ نوار: با تعدادِ کمِ برند (مثلاً صفحه‌ی ورزش)، دو نسخه از
 *   آرایه کمتر از عرضِ ویوپورت می‌شد و translateX(-50%) فضای خالی نشان می‌داد.
 *   راه‌حل: آرایه آن‌قدر تکرار می‌شود که «یک ست» از پهن‌ترین ویوپورت بزرگ‌تر شود،
 *   سپس همان ست دوبار رندر می‌شود ([...set, ...set]) → -۵۰٪ همیشه پر است.
 *
 * مسیرِ کلیک: sportSlug → /[sportSlug]/[brandSlug] ، وگرنه /[brandSlug].
 */

import React from "react";
import Link from "next/link";
import styles from "@/styles/BrandSection.module.css";

// حداقل تعدادِ لوگو در «یک ست» تا یک ست از پهن‌ترین ویوپورت (≈۴K) عریض‌تر شود.
// هر لوگوی دسکتاپ ≈ ۲۲۰px (۱۷۰ + ۵۰ مارجین) → ۲۰×۲۲۰ ≈ ۴۴۰۰px.
const MIN_PER_SET = 20;

const BrandsTicker = ({ brands = [], sportSlug = "" }) => {
  if (!Array.isArray(brands) || brands.length === 0) return null;

  // «یک ست» را با تکرارِ آرایه‌ی پایه تا حداقل MIN_PER_SET می‌سازیم،
  // سپس برای حلقه‌ی seamless آن را دو بار می‌گذاریم.
  let set = brands;
  if (brands.length < MIN_PER_SET) {
    const times = Math.ceil(MIN_PER_SET / brands.length);
    set = Array.from({ length: times }, () => brands).flat();
  }
  const loop = [...set, ...set];

  // فقط اولین رخدادِ هر برند در دسترسِ صفحه‌کلید/اسکرین‌ریدر است؛ تکرارها و
  // نسخه‌ی دوم decorative‌اند.
  const seen = new Set();

  return (
    <section className={styles.brandSection} aria-label="برندها">
      <div className={styles.brandTrack}>
        {loop.map((brand, index) => {
          const decorative = seen.has(brand.slug);
          if (!decorative) seen.add(brand.slug);

          const href = sportSlug
            ? `/${sportSlug}/${brand.slug}`
            : `/${brand.slug}`;

          return (
            <Link
              key={`${brand.slug}-${index}`}
              href={href}
              className={styles.brandLogo}
              title={brand.name}
              aria-hidden={decorative ? true : undefined}
              tabIndex={decorative ? -1 : undefined}
              style={{ "--logo-url": `url("${brand.logo}")` }}
            >
              {/* لایه‌ی بازرنگ‌شده با ماسک — رنگِ ثابت و دقیقِ #aa4725 */}
              <span className={styles.logoMask} aria-hidden="true" />
              {/* تصویرِ واقعیِ برند — فقط روی هاور نمایان می‌شود (رنگِ اصلی) */}
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
