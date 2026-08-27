/**
 * src/lib/racketMatch/normalize.js
 *
 * تبدیل دادهٔ واقعیِ محصول (product.attributes + product.technicalStats + گریپِ
 * واریانت‌ها) به «شناسنامهٔ فنیِ راکت» با شکل یکسان و قابل امتیازدهی.
 *
 * قاعدهٔ طلایی (§32 سند مرجع): هیچ مقداری حدس زده نمی‌شود. هر چیزی که در
 * دیتابیس نباشد یا قابل تفسیر نباشد، null می‌ماند و موتور امتیازدهی آن محور را
 * کاملاً کنار می‌گذارد (نه اینکه جریمه‌اش کند). وزن سویینگ هرگز از وزن استاتیک
 * استنتاج نمی‌شود و بالانس هرگز از متن تبلیغاتی برداشت نمی‌شود.
 */

// ارقام فارسی/عربی + جداکنندهٔ اعشار عربی → لاتین
const DIGIT_MAP = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** پاک‌سازی رشتهٔ خام: ارقام فارسی، فاصلهٔ مجازی/بی‌شکست، فاصلهٔ اضافه */
export function cleanRaw(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d])
    .replace(/[‌​﻿ ]/g, " ")
    .replace(/٫/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/** «نامشخص»/«-»/خالی یعنی داده نداریم — نه عدد صفر */
const UNKNOWN = /^(نامشخص|نا مشخص|ندارد|-{1,2}|—|null|undefined)$/i;

/** اولین عدد معنادار داخل رشته؛ در نبود آن null */
export function toNumber(value) {
  const raw = cleanRaw(value);
  if (!raw || UNKNOWN.test(raw)) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * طول راکت به اینچ.
 * دادهٔ فروشگاه بیشتر بر حسب سانتی‌متر ثبت شده (۶۸.۵) و بخشی بر حسب اینچ (۲۷).
 * تفکیک با آستانهٔ ۴۰ انجام می‌شود؛ این یک تبدیل فیزیکی است، نه حدس.
 */
export function parseLengthInches(value) {
  const n = toNumber(value);
  if (n === null || n <= 0) return null;
  const inches = n > 40 ? n / 2.54 : n;
  // خارج از بازهٔ فیزیکیِ ممکن (۱۹ اینچ کودک تا ۲۹ اینچ سقفِ قانونِ ITF) → بی‌اعتبار
  if (inches < 17 || inches > 30) return null;
  return Math.round(inches * 100) / 100;
}

const HEAD_LIGHT = /سرسبک|سر سبک|head[- ]?light/i;
const HEAD_HEAVY = /سرسنگین|سر سنگین|head[- ]?heavy/i;
const EVEN_BALANCE = /تعادلی|even/i;

/**
 * بالانس. سه حالتِ ورودیِ واقعی در دیتابیس:
 *   «۴ پوینت سرسبک» → head-light با ۴ پوینت
 *   «۰ پوینت تعادلی» → even
 *   «۳۴ cm» → نقطهٔ بالانس؛ جهتش نسبت به وسطِ راکت محاسبه می‌شود
 *   (هر پوینت = ۱/۸ اینچ = ۳.۱۷۵ میلی‌متر — یک واقعیت فیزیکی، نه تخمین)
 *
 * @param {*} value مقدار خام attributes.Balance
 * @param {number|null} lengthInches طول راکت، برای تفسیر نقطهٔ بالانس
 */
export function parseBalance(value, lengthInches) {
  const raw = cleanRaw(value);
  if (!raw || UNKNOWN.test(raw)) {
    return { balance: null, balancePoint: null, balancePoints: null };
  }

  const points = toNumber(raw);

  if (EVEN_BALANCE.test(raw)) {
    return { balance: "even", balancePoint: null, balancePoints: 0 };
  }
  if (HEAD_LIGHT.test(raw)) {
    return {
      balance: points === 0 ? "even" : "head-light",
      balancePoint: null,
      balancePoints: points,
    };
  }
  if (HEAD_HEAVY.test(raw)) {
    return {
      balance: points === 0 ? "even" : "head-heavy",
      balancePoint: null,
      balancePoints: points,
    };
  }

  // حالت «۳۴ cm» — نقطهٔ بالانس از انتهای دسته
  if (/cm|سانت/i.test(raw) && points !== null && lengthInches) {
    const balancePointMm = points * 10;
    const midMm = (lengthInches * 25.4) / 2;
    const deltaMm = balancePointMm - midMm;
    const pts = Math.round((Math.abs(deltaMm) / 3.175) * 10) / 10;
    if (pts < 0.5) {
      return { balance: "even", balancePoint: balancePointMm, balancePoints: 0 };
    }
    return {
      balance: deltaMm < 0 ? "head-light" : "head-heavy",
      balancePoint: balancePointMm,
      balancePoints: pts,
    };
  }

  return { balance: null, balancePoint: null, balancePoints: null };
}

/**
 * الگوی زهکشی. علاوه بر سه حالتِ نامبرده در سند (16x19 / 16x20 / 18x20) دادهٔ
 * واقعیِ فروشگاه 16x18، 16x17، 18x19 و 18x16 هم دارد؛ به‌جای دور ریختنشان، بر
 * اساس «بازبودن» طبقه‌بندی می‌شوند تا امتیازدهی روی همهٔ محصولات کار کند.
 * patternOpenness: ۱ = بازترین (اسپین‌پذیرتر) … ۰ = متراکم‌ترین (کنترلی‌تر)
 */
export function parseStringPattern(value) {
  const raw = cleanRaw(value)
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/\s/g, "");
  const match = raw.match(/(\d{2})x(\d{2})/);
  if (!match) return { stringPattern: null, patternOpenness: null };

  const mains = Number(match[1]);
  const crosses = Number(match[2]);
  if (!mains || !crosses) return { stringPattern: null, patternOpenness: null };

  // چگالیِ نسبیِ شبکه: هرچه تعداد رشته‌ها کمتر، الگو بازتر است.
  // 16x17=272 (بازترین) تا 18x20=360 (متراکم‌ترین) — نگاشت خطی و کلمپ‌شده
  const density = mains * crosses;
  const openness = Math.max(0, Math.min(1, (360 - density) / (360 - 272)));

  return {
    stringPattern: mains + "x" + crosses,
    patternOpenness: Math.round(openness * 100) / 100,
  };
}

const LEVEL_TOKENS = [
  { re: /حرفه/, levels: ["advanced"] },
  { re: /پیشرفته/, levels: ["advanced"] },
  { re: /متوسط/, levels: ["intermediate"] },
  { re: /مبتدی|تازه/, levels: ["beginner"] },
];

/**
 * سطحِ پیشنهادیِ محصول. «متوسط-پیشرفته» یعنی هر دو سطح، نه یکی.
 * @returns {string[]|null}
 */
export function parseRecommendedLevel(value) {
  const raw = cleanRaw(value);
  if (!raw || UNKNOWN.test(raw)) return null;
  const found = new Set();
  for (const token of LEVEL_TOKENS) {
    if (token.re.test(raw)) token.levels.forEach((level) => found.add(level));
  }
  return found.size ? [...found] : null;
}

/** دستهٔ اندازهٔ صفحه طبق §6 — مشتق‌شده از عدد واقعی، نه حدس */
export function headSizeCategoryOf(headSize) {
  if (headSize === null || headSize === undefined) return null;
  if (headSize <= 98) return "small";
  if (headSize <= 102) return "medium";
  return "large";
}

const STYLE_TOKENS = [
  { re: /قدرت|power/i, style: "power" },
  { re: /اسپین|چرخش|spin/i, style: "spin" },
  { re: /کنترل|control/i, style: "control" },
  { re: /همه\s*کاره|all[- ]?court/i, style: "all-court" },
];

/** سبک‌های پیشنهادیِ محصول — فقط اگر ادمین صریحاً ثبت کرده باشد */
export function parsePlayingStyles(value) {
  const raw = cleanRaw(value);
  if (!raw || UNKNOWN.test(raw)) return null;
  const found = STYLE_TOKENS.filter((token) => token.re.test(raw)).map((token) => token.style);
  return found.length ? found : null;
}

/** امتیاز ۰..۱۰۰ از technicalStats — کلیدها در دیتابیس یکدست نیستند (power/Power) */
function stat(technicalStats, key) {
  if (!technicalStats) return null;
  const wanted = key.toLowerCase();
  const candidates = [technicalStats[key]];
  for (const [k, v] of Object.entries(technicalStats)) {
    if (k.toLowerCase().trim() === wanted) candidates.push(v);
  }
  for (const candidate of candidates) {
    if (candidate === "" || candidate === null || candidate === undefined) continue;
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

const GRIP_RE = /^L[0-5]$/i;

/** سایزهای گریپِ موجود — از واریانت‌های همین محصول */
export function parseGripSizes(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sizes = new Set();
  for (const variant of variants) {
    const raw = cleanRaw(variant?.attributes?.Grip ?? variant?.attributes?.grip);
    if (GRIP_RE.test(raw)) sizes.add(raw.toUpperCase());
  }
  return sizes.size ? [...sizes].sort() : null;
}

/**
 * شناسنامهٔ فنیِ کاملِ یک راکت. هر فیلدِ ناموجود = null.
 * @param {Object} product محصولِ lean با attributes/technicalStats/variants
 */
export function normalizeRacketSpecs(product) {
  const attributes = product?.attributes || {};
  const stats = product?.technicalStats || {};

  const length = parseLengthInches(attributes["Racket Length"] ?? attributes["Length"]);
  const { balance, balancePoint, balancePoints } = parseBalance(attributes["Balance"], length);
  const { stringPattern, patternOpenness } = parseStringPattern(attributes["String Pattern"]);
  const headSize = toNumber(attributes["Head Size"]);

  return {
    unstrungWeight: toNumber(attributes["Unstrung Weight"]),
    strungWeight: toNumber(attributes["Strung Weight"]),
    headSize,
    headSizeCategory: headSizeCategoryOf(headSize),
    gripSizes: parseGripSizes(product),
    balance,
    balancePoint,
    balancePoints,
    swingweight: toNumber(attributes["Swingweight"]),
    length,
    stringPattern,
    patternOpenness,
    frameMaterial: cleanRaw(attributes["Composition"]) || null,
    frameStiffnessRA: toNumber(attributes["Stiffness"]),
    powerLevel: stat(stats, "power"),
    controlLevel: stat(stats, "control"),
    spinPotential: stat(stats, "spin"),
    maneuverability: stat(stats, "maneuverability"),
    stability: stat(stats, "stability"),
    comfort: stat(stats, "comfort"),
    forgiveness: stat(stats, "forgiveness"),
    recommendedLevel: parseRecommendedLevel(attributes["Level"]),
    recommendedPlayingStyles: parsePlayingStyles(attributes["Playing Style"]),
    recommendedPlayerTypes: cleanRaw(attributes["Suitable for"]) || null,
  };
}
