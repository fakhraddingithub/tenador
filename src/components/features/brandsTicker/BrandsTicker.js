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

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "@/styles/BrandSection.module.css";

// آستانه‌ی حرکتِ اشاره‌گر تا «کلیک» به «درگ» تبدیل شود (px) — کمتر از این مقدار
// کلیکِ عادی روی برند حفظ می‌شود و ناوبری اتفاق می‌افتد.
const DRAG_THRESHOLD = 6;

// خواندنِ translateXِ جاریِ ترَک از ماتریسِ computed (px) — در حینِ انیمیشنِ CSS
// درصدها به px حل شده‌اند، پس همیشه مقدارِ پیکسلیِ لحظه‌ای برمی‌گردد.
function getTrackTranslateX(el) {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).m41;
  } catch {
    return 0;
  }
}

// نگاشتِ هر آفستِ دلخواه به بازه‌ی (-period, 0] — دقیقاً همان بازه‌ای که انیمیشنِ
// CSS می‌پیماید (۰ تا -۵۰٪ = -oneSetWidth). چون ترَک دو نسخه‌ی یکسان است، این
// wrap کاملاً بدونِ پرش (seamless) دیده می‌شود و درگ در هر دو جهت پر می‌ماند.
function normalizeOffset(x, period) {
  if (!period) return x;
  let n = x % period;
  if (n > 0) n -= period;
  return n;
}

// حداقل تعدادِ لوگو در «یک ست» تا یک ست از پهن‌ترین ویوپورت (≈۴K) عریض‌تر شود.
// هر لوگوی دسکتاپ ≈ ۲۲۰px (۱۷۰ + ۵۰ مارجین) → ۲۰×۲۲۰ ≈ ۴۴۰۰px.
const MIN_PER_SET = 20;
const EMPTY_BRANDS = [];
const VECTOR_LOGO_RE = /\.svg(?:[?#]|$)/i;
const PRIMARY_TINT = { r: 170, g: 71, b: 37 };
const MAX_TINT_SIZE = 360;
const MIN_ALPHA = 8;
const BG_HARD_TOLERANCE = 18;
const BG_SOFT_TOLERANCE = 64;
const tintedLogoCache = new Map();

function isVectorLogo(src = "") {
  return VECTOR_LOGO_RE.test(src);
}

function loadLogoImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getScaledSize(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;

  const scale = Math.min(1, MAX_TINT_SIZE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function readPixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

function detectSolidBackground(data, width, height) {
  const sampleSize = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 8)));
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];
  const samples = [];
  let transparentCount = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const pixel = readPixel(data, width, x, y);
        if (pixel.a < 240) {
          transparentCount += 1;
        } else {
          samples.push(pixel);
        }
      }
    }
  }

  if (samples.length === 0 || transparentCount > samples.length) return null;

  const background = samples.reduce(
    (acc, pixel) => ({
      r: acc.r + pixel.r,
      g: acc.g + pixel.g,
      b: acc.b + pixel.b,
    }),
    { r: 0, g: 0, b: 0 }
  );
  background.r = Math.round(background.r / samples.length);
  background.g = Math.round(background.g / samples.length);
  background.b = Math.round(background.b / samples.length);

  const cornersAreConsistent = samples.every(
    (pixel) => colorDistance(pixel, background) <= BG_SOFT_TOLERANCE
  );

  return cornersAreConsistent ? background : null;
}

async function createTintedRasterLogo(src) {
  const image = await loadLogoImage(src);
  const size = getScaledSize(image);
  if (!size) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, size.width, size.height);
  const imageData = context.getImageData(0, 0, size.width, size.height);
  const { data } = imageData;
  const background = detectSolidBackground(data, size.width, size.height);

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha <= MIN_ALPHA) {
      data[index + 3] = 0;
      continue;
    }

    let nextAlpha = alpha;
    if (background) {
      const distance = colorDistance(
        { r: data[index], g: data[index + 1], b: data[index + 2] },
        background
      );

      if (distance <= BG_HARD_TOLERANCE) {
        data[index + 3] = 0;
        continue;
      }

      if (distance < BG_SOFT_TOLERANCE) {
        const softAlpha =
          (distance - BG_HARD_TOLERANCE) /
          (BG_SOFT_TOLERANCE - BG_HARD_TOLERANCE);
        nextAlpha = Math.round(alpha * softAlpha);
      }
    }

    data[index] = PRIMARY_TINT.r;
    data[index + 1] = PRIMARY_TINT.g;
    data[index + 2] = PRIMARY_TINT.b;
    data[index + 3] = nextAlpha;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function getTintedRasterLogo(src) {
  if (tintedLogoCache.has(src)) {
    return Promise.resolve(tintedLogoCache.get(src));
  }

  const pending = createTintedRasterLogo(src).catch(() => null);
  tintedLogoCache.set(src, pending);

  return pending.then((result) => {
    tintedLogoCache.set(src, result);
    return result;
  });
}

function useTintedRasterLogos(brands) {
  const rasterLogoUrls = useMemo(
    () =>
      Array.from(
        new Set(
          brands
            .map((brand) => brand?.logo)
            .filter((logo) => logo && !isVectorLogo(logo))
        )
      ),
    [brands]
  );

  const [tintedLogos, setTintedLogos] = useState({});

  useEffect(() => {
    if (rasterLogoUrls.length === 0) return undefined;

    let cancelled = false;

    Promise.all(
      rasterLogoUrls.map(async (logoUrl) => [
        logoUrl,
        await getTintedRasterLogo(logoUrl),
      ])
    ).then((entries) => {
      if (cancelled) return;

      setTintedLogos((current) => {
        let changed = false;
        const next = { ...current };

        for (const [logoUrl, tintedLogo] of entries) {
          if (tintedLogo && next[logoUrl] !== tintedLogo) {
            next[logoUrl] = tintedLogo;
            changed = true;
          }
        }

        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [rasterLogoUrls]);

  return tintedLogos;
}

const BrandsTicker = ({ brands = EMPTY_BRANDS, sportSlug = "" }) => {
  const brandList = Array.isArray(brands) ? brands : EMPTY_BRANDS;
  const tintedLogos = useTintedRasterLogos(brandList);

  // «یک ست» را با تکرارِ آرایه‌ی پایه تا حداقل MIN_PER_SET می‌سازیم،
  // سپس برای حلقه‌ی seamless آن را دو بار می‌گذاریم.
  const loop = useMemo(() => {
    let set = brandList;
    if (brandList.length > 0 && brandList.length < MIN_PER_SET) {
      const times = Math.ceil(MIN_PER_SET / brandList.length);
      set = Array.from({ length: times }, () => brandList).flat();
    }
    return [...set, ...set];
  }, [brandList]);

  // ── درگ برای اسکرول (ماوس + لمس) روی همان انیمیشنِ خودکارِ CSS ────────────────
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const hasDraggedRef = useRef(false);
  const dragRef = useRef({
    pointerDown: false,
    dragging: false,
    startX: 0,
    baseOffset: 0,
    lastOffset: 0,
    oneSetWidth: 0,
    duration: 0,
  });

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return undefined;

    const drag = dragRef.current;

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag.pointerDown = true;
      drag.dragging = false;
      drag.startX = e.clientX;
      hasDraggedRef.current = false;
    };

    // لحظه‌ی عبور از آستانه: انیمیشن را «فریز» می‌کنیم و از موقعیتِ زنده‌ی فعلی
    // ادامه می‌دهیم تا هیچ پرشی رخ ندهد.
    const beginDrag = (e) => {
      drag.dragging = true;
      hasDraggedRef.current = true;
      drag.duration = parseFloat(getComputedStyle(track).animationDuration) || 0;
      drag.oneSetWidth = track.scrollWidth / 2 || 0;
      drag.baseOffset = getTrackTranslateX(track);
      drag.startX = e.clientX;
      track.style.animation = "none";
      track.style.transform = `translateX(${drag.baseOffset}px)`;
    };

    const onPointerMove = (e) => {
      if (!drag.pointerDown) return;
      if (!drag.dragging) {
        if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD) return;
        beginDrag(e);
      }
      const offset = normalizeOffset(
        drag.baseOffset + (e.clientX - drag.startX),
        drag.oneSetWidth
      );
      drag.lastOffset = offset;
      track.style.transform = `translateX(${offset}px)`;
      e.preventDefault();
    };

    // رها کردن: انیمیشنِ خودکارِ CSS را با animation-delayِ منفی دقیقاً از همان
    // نقطه‌ای که درگ رها شد از سر می‌گیریم (ادامه‌ی نرم و بی‌پرش).
    const endDrag = () => {
      if (!drag.pointerDown) return;
      drag.pointerDown = false;
      if (!drag.dragging) return;
      drag.dragging = false;

      // بدونِ انیمیشنِ خودکار (مثلاً prefers-reduced-motion) همان‌جا فریز می‌ماند.
      if (!drag.duration || !drag.oneSetWidth) return;

      const period = drag.oneSetWidth;
      let n = drag.lastOffset % period;
      if (n > 0) n -= period; // (-period, 0]
      const fraction = -n / period; // [0, 1)

      track.style.transform = "";
      track.style.animation = ""; // بازگشت به انیمیشنِ کلاسِ CSS
      track.style.animationDelay = `${-(fraction * drag.duration)}s`;
    };

    // جلوگیری از درگِ گوستِ تصویر/انتخابِ متن هنگام فشردنِ اشاره‌گر.
    const onDragStart = (e) => {
      if (drag.pointerDown) e.preventDefault();
    };

    // فقط وقتی واقعاً درگ رخ داده، کلیکِ ناوبریِ برند را خنثی می‌کنیم؛ تپِ عادی
    // دست‌نخورده باقی می‌ماند.
    const onClickCapture = (e) => {
      if (!hasDraggedRef.current) return;
      hasDraggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };

    section.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    section.addEventListener("dragstart", onDragStart);
    section.addEventListener("click", onClickCapture, true);

    return () => {
      section.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      section.removeEventListener("dragstart", onDragStart);
      section.removeEventListener("click", onClickCapture, true);
    };
  }, [brandList.length]);

  if (brandList.length === 0) return null;

  // فقط اولین رخدادِ هر برند در دسترسِ صفحه‌کلید/اسکرین‌ریدر است؛ تکرارها و
  // نسخه‌ی دوم decorative‌اند.
  const seen = new Set();

  return (
    <section
      ref={sectionRef}
      className={styles.brandSection}
      aria-label="برندها"
      style={{ touchAction: "pan-y" }}
    >
      <div ref={trackRef} className={styles.brandTrack}>
        {loop.map((brand, index) => {
          const decorative = seen.has(brand.slug);
          if (!decorative) seen.add(brand.slug);

          const href = sportSlug
            ? `/${sportSlug}/${brand.slug}`
            : `/${brand.slug}`;
          const vectorLogo = isVectorLogo(brand.logo);
          const tintedLogo = tintedLogos[brand.logo] || brand.logo;

          return (
            <Link
              key={`${brand.slug}-${index}`}
              href={href}
              className={styles.brandLogo}
              title={brand.name}
              aria-hidden={decorative ? true : undefined}
              tabIndex={decorative ? -1 : undefined}
              style={vectorLogo ? { "--logo-url": `url("${brand.logo}")` } : undefined}
            >
              {/* لایه‌ی بازرنگ‌شده با ماسک — رنگِ ثابت و دقیقِ #aa4725 */}
              {vectorLogo ? (
                <span className={styles.logoMask} aria-hidden="true" />
              ) : (
                <Image
                  src={tintedLogo}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 100px, (max-width: 768px) 150px, 170px"
                  className={styles.logoTintedImage}
                  aria-hidden="true"
                  loading="lazy"
                  unoptimized
                />
              )}
              {/* تصویرِ واقعیِ برند — فقط روی هاور نمایان می‌شود (رنگِ اصلی) */}
              <Image
                src={brand.logo}
                alt={brand.name}
                fill
                sizes="(max-width: 480px) 100px, (max-width: 768px) 150px, 170px"
                className={styles.logoImage}
                loading="lazy"
                unoptimized={vectorLogo}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default BrandsTicker;
