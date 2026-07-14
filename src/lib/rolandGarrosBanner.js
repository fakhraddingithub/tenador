export const ROLAND_GARROS_BANNER_SETTING_KEY = "home_roland_garros_banner";
export const ROLAND_GARROS_BANNER_CACHE_TAG = "home-roland-garros";

export const DEFAULT_ROLAND_GARROS_BANNER = Object.freeze({
  backgroundText: "Roland Garros",
  eyebrow: "کالکشن رسمی 2026",
  titlePrefix: "رولاند",
  titleHighlight: "گاروس",
  englishTitlePrefix: "Roland",
  englishTitleHighlight: "Garros",
  description:
    "تجربه‌ای که از قلب پاریس می‌آید. راکت‌ها و اکسسوری‌هایی که مرز بین هنر و ورزش را از بین برده‌اند؛ برای کسانی که به دنبال اصالت هستند.",
  ctaLabel: "مشاهده محصولات",
  ctaHref: "/wilson/roland-garros",
  statValue: "۱۰۰٪",
  statLabel: "اصالت تضمین شده",
  cornerTitle: "PARIS",
  cornerSubtitle: "تورنمنت 2026",
  imageUrl: "/images/roland-garros.webp",
  imageAlt: "محصولات رولاند گاروس",
});

export const ROLAND_GARROS_REQUIRED_FIELDS = Object.keys(
  DEFAULT_ROLAND_GARROS_BANNER
);

const FIELD_LABELS = {
  backgroundText: "متن پس‌زمینه",
  eyebrow: "متن بالای کارت",
  titlePrefix: "بخش اول عنوان فارسی",
  titleHighlight: "بخش رنگی عنوان فارسی",
  englishTitlePrefix: "بخش اول عنوان انگلیسی",
  englishTitleHighlight: "بخش رنگی عنوان انگلیسی",
  description: "توضیح بنر",
  ctaLabel: "متن دکمه",
  ctaHref: "لینک دکمه",
  statValue: "عدد کنار دکمه",
  statLabel: "متن زیر عدد",
  cornerTitle: "عنوان کارت کوچک تصویر",
  cornerSubtitle: "متن کارت کوچک تصویر",
  imageUrl: "تصویر بنر",
  imageAlt: "متن جایگزین تصویر",
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeRolandGarrosBanner(value) {
  const source = isPlainObject(value) ? value : {};

  return ROLAND_GARROS_REQUIRED_FIELDS.reduce((banner, key) => {
    const cleaned = cleanString(source[key]);
    banner[key] = cleaned || DEFAULT_ROLAND_GARROS_BANNER[key];
    return banner;
  }, {});
}

export function validateRolandGarrosBanner(value) {
  if (!isPlainObject(value)) {
    return {
      banner: null,
      errors: ["داده‌های بنر معتبر نیست"],
    };
  }

  const banner = {};
  const missing = [];

  for (const key of ROLAND_GARROS_REQUIRED_FIELDS) {
    const cleaned = cleanString(value[key]);
    if (!cleaned) missing.push(FIELD_LABELS[key] || key);
    banner[key] = cleaned;
  }

  const errors = missing.map((label) => `${label} الزامی است`);

  if (
    banner.ctaHref &&
    !banner.ctaHref.startsWith("/") &&
    !/^https?:\/\//i.test(banner.ctaHref)
  ) {
    errors.push("لینک دکمه باید با / یا http شروع شود");
  }

  // آدرسِ داخلیِ سایت، یا آدرسِ ImageKit (فعلی)، یا آدرسِ قدیمیِ Cloudinary
  // (برای بنرهایی که قبل از مهاجرت ساخته شده‌اند) پذیرفته می‌شود.
  const imagekitEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "";
  if (
    banner.imageUrl &&
    !banner.imageUrl.startsWith("/") &&
    !banner.imageUrl.startsWith("https://res.cloudinary.com/") &&
    !(imagekitEndpoint && banner.imageUrl.startsWith(imagekitEndpoint))
  ) {
    errors.push("تصویر بنر باید آدرس داخلی سایت یا آدرس ImageKit باشد");
  }

  return {
    banner: errors.length ? null : banner,
    errors,
  };
}
