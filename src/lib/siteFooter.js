/**
 * src/lib/siteFooter.js
 *
 * محتوای فوترِ سایت — یک سند در SiteSetting با کلیدِ `site_footer`.
 * این فایل خالص است (بدون DB/React) و هم سرور، هم فرم ادمین و هم تست از آن می‌خوانند.
 *
 * قرارداد: تا وقتی چیزی ذخیره نشده، DEFAULT_SITE_FOOTER نمایش داده می‌شود. بعد از
 * اولین ذخیره، فقط کلیدی که در سندِ ذخیره‌شده *وجود ندارد* از پیش‌فرض پر می‌شود؛
 * رشته‌ی خالیِ ذخیره‌شده یعنی «نمایش نده» (undefined ≠ "").
 */

export const SITE_FOOTER_SETTING_KEY = "site_footer";
export const SITE_FOOTER_CACHE_TAG = "site-footer";

/** شبکه‌های اجتماعیِ پشتیبانی‌شده — ترتیبِ نمایش همین ترتیب است. آیکن‌ها در socialIcons.js. */
export const FOOTER_SOCIAL_PLATFORMS = [
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "whatsapp", label: "واتس‌اپ" },
  { key: "twitter", label: "ایکس (توییتر)" },
  { key: "youtube", label: "یوتیوب" },
  { key: "aparat", label: "آپارات" },
  { key: "linkedin", label: "لینکدین" },
];

export const FOOTER_LIMITS = Object.freeze({
  sections: 8,
  linksPerSection: 20,
  text: 200,
  description: 1000,
  href: 500,
});

export const DEFAULT_SITE_FOOTER = Object.freeze({
  newsletter: {
    title: "عضویت در خبرنامه",
    description: "از جدیدترین محصولات و تخفیف‌های ویژه با خبر شوید",
    placeholder: "ایمیل خود را وارد کنید",
    buttonLabel: "عضویت",
    subscribedTitle: "شما عضو خبرنامه هستید",
    subscribedDescription: "از اینکه ما را دنبال می‌کنید سپاسگزاریم.",
  },
  description:
    "فروشگاه تخصصی تجهیزات ورزش‌های راکتی در ایران. ارائه‌دهنده محصولات اصل و با کیفیت برندهای معتبر جهانی با بهترین قیمت و خدمات پس از فروش.",
  contact: {
    phone: "",
    address: "",
    email: "info.tenador@gmail.com",
  },
  socials: [
    { platform: "instagram", enabled: true, href: "https://www.instagram.com/tenador.shop" },
    { platform: "telegram", enabled: true, href: "https://telegram.org" },
    { platform: "whatsapp", enabled: false, href: "" },
    { platform: "twitter", enabled: true, href: "https://twitter.com" },
    { platform: "youtube", enabled: true, href: "https://youtube.com" },
    { platform: "aparat", enabled: false, href: "" },
    { platform: "linkedin", enabled: false, href: "" },
  ],
  sections: [
    {
      title: "دسترسی سریع",
      links: [
        { label: "درباره ما", href: "/about" },
        { label: "تماس با ما", href: "/contact" },
        { label: "قوانین و مقررات", href: "/terms" },
        { label: "حریم خصوصی", href: "/privacy" },
      ],
    },
    {
      title: "خدمات مشتریان",
      links: [
        { label: "پاسخ به پرسش‌های متداول", href: "/faq" },
        { label: "رویه‌های بازگرداندن کالا", href: "/returns" },
        { label: "شرایط استفاده", href: "/usage" },
        { label: "گزارش باگ", href: "/bug-report" },
      ],
    },
    {
      title: "راهنمای خرید",
      links: [
        { label: "راهنمای انتخاب محصول مناسب", href: "/match" },
        { label: "مقایسه محصولات", href: "/compare" },
        { label: "نحوه ثبت سفارش", href: "/how-to-order" },
        { label: "رویه ارسال سفارش", href: "/shipping" },
        { label: "شیوه‌های پرداخت", href: "/payment" },
      ],
    },
    {
      title: "صفحات پربازدید",
      links: [
        { label: "راکت تنیس ویلسون", href: "/tennis/racket/wilson" },
        { label: "تجهیزات تنیس", href: "/tennis" },
        { label: "تجهیزات پدل", href: "/padel" },
        { label: "راکت دست دوم", href: "/second-hand/tennis/racket" },
      ],
    },
  ],
  copyright: "© ۲۰۲۶ تمامی حقوق برای فروشگاه محفوظ است.",
});

const NEWSLETTER_KEYS = Object.keys(DEFAULT_SITE_FOOTER.newsletter);
const CONTACT_KEYS = Object.keys(DEFAULT_SITE_FOOTER.contact);
const PLATFORM_KEYS = new Set(FOOTER_SOCIAL_PLATFORMS.map((p) => p.key));

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const clone = (v) => JSON.parse(JSON.stringify(v));

/** لینکِ منو: مسیرِ داخلی، http(s)، mailto یا tel. `//evil.com` مسیرِ داخلی نیست. */
export function isSafeFooterHref(href) {
  return (
    (href.startsWith("/") && !href.startsWith("//")) ||
    /^https?:\/\/\S+$/i.test(href) ||
    /^(mailto|tel):\S+$/i.test(href)
  );
}

/** «۰۲۱-۱۲۳» → «tel:021123» — ارقامِ فارسی/عربی هم تبدیل می‌شوند. */
export function phoneHref(phone) {
  const latin = String(phone || "")
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660);
  const digits = latin.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

/** شبکه‌ها همیشه کامل و به ترتیبِ FOOTER_SOCIAL_PLATFORMS برگردانده می‌شوند. */
function mergeSocials(list) {
  const byKey = new Map(
    (Array.isArray(list) ? list : [])
      .filter((s) => isObject(s) && PLATFORM_KEYS.has(s.platform))
      .map((s) => [s.platform, s])
  );
  return FOOTER_SOCIAL_PLATFORMS.map(({ key }) => {
    const fallback = DEFAULT_SITE_FOOTER.socials.find((s) => s.platform === key);
    const saved = byKey.get(key);
    if (!saved) return { ...fallback };
    return { platform: key, enabled: saved.enabled === true, href: str(saved.href) };
  });
}

/** سندِ ذخیره‌شده (یا null) → فوترِ کامل برای نمایش. هرگز throw نمی‌کند. */
export function normalizeSiteFooter(value) {
  if (!isObject(value)) return clone(DEFAULT_SITE_FOOTER);
  const d = DEFAULT_SITE_FOOTER;
  const pick = (src, key, fallback) => (typeof src?.[key] === "string" ? src[key].trim() : fallback);

  return {
    newsletter: Object.fromEntries(
      NEWSLETTER_KEYS.map((k) => [k, pick(value.newsletter, k, d.newsletter[k])])
    ),
    description: pick(value, "description", d.description),
    contact: Object.fromEntries(CONTACT_KEYS.map((k) => [k, pick(value.contact, k, d.contact[k])])),
    socials: mergeSocials(value.socials ?? d.socials),
    sections: Array.isArray(value.sections)
      ? value.sections.filter(isObject).map((s) => ({
          title: str(s.title),
          links: (Array.isArray(s.links) ? s.links : [])
            .filter(isObject)
            .map((l) => ({ label: str(l.label), href: str(l.href) })),
        }))
      : clone(d.sections),
    copyright: pick(value, "copyright", d.copyright),
  };
}

/**
 * ورودیِ PUT ادمین → { footer, errors }. همه‌چیز یا هیچ: با هر خطا footer = null.
 * فیلدهای متنی اختیاری‌اند (خالی = در سایت نمایش داده نمی‌شود)؛ آنچه الزامی است:
 * عنوانِ هر ستون، متن و لینکِ هر آیتم، و لینکِ هر شبکه‌ی فعال.
 */
export function validateSiteFooter(value) {
  if (!isObject(value)) return { footer: null, errors: ["داده‌های فوتر معتبر نیست"] };

  const errors = [];
  const L = FOOTER_LIMITS;
  const text = (v, label, max = L.text) => {
    const s = str(v);
    if (s.length > max) errors.push(`${label} حداکثر ${max} کاراکتر است`);
    return s;
  };

  const newsletter = Object.fromEntries(
    NEWSLETTER_KEYS.map((k) => [k, text(value.newsletter?.[k], "متن خبرنامه")])
  );
  const description = text(value.description, "توضیح فوتر", L.description);
  const contact = {
    phone: text(value.contact?.phone, "شماره تلفن"),
    address: text(value.contact?.address, "آدرس", 500),
    email: text(value.contact?.email, "ایمیل"),
  };
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push("ایمیل معتبر نیست");
  }
  if (contact.phone && !phoneHref(contact.phone)) errors.push("شماره تلفن معتبر نیست");

  const socials = mergeSocials(value.socials);
  for (const s of socials) {
    const label = FOOTER_SOCIAL_PLATFORMS.find((p) => p.key === s.platform).label;
    if (s.href.length > L.href) errors.push(`لینک ${label} بیش از حد طولانی است`);
    if (s.enabled && !s.href) errors.push(`لینک ${label} برای نمایش لازم است`);
    if (s.href && !/^https?:\/\/\S+$/i.test(s.href)) {
      errors.push(`لینک ${label} باید با http:// یا https:// شروع شود`);
    }
  }

  const rawSections = Array.isArray(value.sections) ? value.sections : [];
  if (rawSections.length > L.sections) errors.push(`حداکثر ${L.sections} ستون لینک مجاز است`);
  const sections = rawSections.slice(0, L.sections).map((s, i) => {
    const n = i + 1;
    const title = text(s?.title, `عنوان ستون ${n}`);
    if (!title) errors.push(`عنوان ستون ${n} الزامی است`);
    const rawLinks = Array.isArray(s?.links) ? s.links : [];
    if (rawLinks.length > L.linksPerSection) {
      errors.push(`ستون «${title || n}» حداکثر ${L.linksPerSection} لینک می‌تواند داشته باشد`);
    }
    const links = rawLinks.slice(0, L.linksPerSection).map((l, j) => {
      const where = `لینک ${j + 1} از ستون «${title || n}»`;
      const label = text(l?.label, `متن ${where}`);
      const href = text(l?.href, `آدرس ${where}`, L.href);
      if (!label) errors.push(`متن ${where} الزامی است`);
      if (!href) errors.push(`آدرس ${where} الزامی است`);
      else if (!isSafeFooterHref(href)) errors.push(`آدرس ${where} باید با / یا http(s):// شروع شود`);
      return { label, href };
    });
    return { title, links };
  });

  const copyright = text(value.copyright, "متن کپی‌رایت");

  return {
    footer: errors.length
      ? null
      : { newsletter, description, contact, socials, sections, copyright },
    errors,
  };
}
