/**
 * جستجوی مشترکِ کلِ پروژه — سرور (Mongo) و کلاینت (فیلترِ درجا).
 *
 * چرا: قبلاً هر صفحه یک `{$regex: q}` روی یک فیلد بود، یعنی کاربر باید عینِ
 * عبارت و با همان ترتیبِ کلمات را تایپ می‌کرد؛ «Blade racket» هیچ‌وقت
 * «Wilson Blade 98 16x19 V10 Tennis Racket» را پیدا نمی‌کرد.
 *
 * منطق: کوئری به توکن شکسته می‌شود و *هر* توکن باید در *یکی* از فیلدها بیاید
 * (AND روی توکن‌ها، OR روی فیلدها). پس ترتیب کلمات بی‌اهمیت است، کلمه‌ی ناقص
 * هم کار می‌کند و نقطه‌گذاریِ کوئری (پرانتز، خط تیره، اسلش) دور ریخته می‌شود.
 *
 * این فایل ایزومورفیک است: هیچ وابستگیِ Node/Mongoose ندارد تا کامپوننت‌های
 * کلاینت هم بتوانند همان قواعد را import کنند و رفتار جستجو یکسان بماند.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی/عربی → لاتین، تا جستجو با هر صفحه‌کلیدی کار کند */
export function normalizeDigits(input) {
  return String(input ?? "").replace(/[۰-۹٠-٩]/g, (d) => {
    const i = PERSIAN_DIGITS.indexOf(d);
    if (i > -1) return String(i);
    const j = ARABIC_DIGITS.indexOf(d);
    return j > -1 ? String(j) : d;
  });
}

/**
 * متن را برای *مقایسه* یکسان می‌کند (نه برای نمایش): حروفِ هم‌شکلِ عربی/فارسی،
 * ارقام، نیم‌فاصله و حروف کوچک/بزرگ.
 */
export function normalizeSearchText(input) {
  return normalizeDigits(input)
    .replace(/ي/g, "ی") // ي → ی
    .replace(/ك/g, "ک") // ك → ک
    .replace(/[‌​﻿]/g, " ") // نیم‌فاصله/ZWSP/BOM
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** فقط برای توکن‌سازی: نقطه‌گذاری به فاصله تبدیل می‌شود، حروف/رقم باقی می‌ماند */
function stripPunctuation(value) {
  return value.replace(/[^\p{L}\p{N}]+/gu, " ");
}

const MAX_TOKENS = 8;

/** کوئری کاربر → توکن‌های نرمال‌شده‌ی یکتا (حداکثر ۸ تا، تا کوئریِ Mongo منفجر نشود) */
export function searchTokens(query) {
  const normalized = stripPunctuation(normalizeSearchText(query));
  const seen = new Set();
  for (const token of normalized.split(" ")) {
    if (!token) continue;
    seen.add(token);
    if (seen.size >= MAX_TOKENS) break;
  }
  return [...seen];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * توکن → منبعِ regex که نسبت به شکلِ نوشتاری بردبار است: چون دیتابیس متنِ خام را
 * نگه می‌دارد (ي عربی، ارقام فارسی، ...) ولی توکن نرمال‌شده است، هر کاراکترِ
 * دوشکله به کلاسِ کاراکتری باز می‌شود.
 */
function lenientSource(token) {
  // ⚠️ ترتیب مهم است: اگر کلاس‌ها با `\uXXXX` نوشته شوند، جایگزینیِ ارقام رقم‌های
  // داخلِ همان escape را هم عوض می‌کند و regex خراب می‌شود. پس کاراکترِ واقعی.
  return escapeRegExp(token)
    .replace(/[0-9]/g, (d) => `[${d}${PERSIAN_DIGITS[+d]}${ARABIC_DIGITS[+d]}]`)
    .replace(/[يی]/g, "[يی]")
    .replace(/[كک]/g, "[كک]");
}

/**
 * شرطِ Mongo برای یک کوئری روی چند فیلد.
 * خروجی: `{ $and: [ { $or: [{field: /token/i}, ...] }, ... ] }` یا `null` اگر
 * کوئری خالی باشد. `null` یعنی «فیلتری اضافه نکن» تا رفتار قبلی حفظ شود.
 *
 * ponytail: regex بدون anchor از ایندکس استفاده نمی‌کند (مثل کدِ قبلی). تا وقتی
 * حجمِ کالکشن‌ها در این حد است مسئله‌ای نیست؛ اگر شد، Atlas Search یا یک فیلدِ
 * `searchText` با ایندکسِ text جایگزینِ همین تابع می‌شود بدون تغییر در فراخوان‌ها.
 */
export function buildSearchFilter(query, fields) {
  const tokens = searchTokens(query);
  const list = (Array.isArray(fields) ? fields : [fields]).filter(Boolean);
  if (!tokens.length || !list.length) return null;

  return {
    $and: tokens.map((token) => {
      const rx = { $regex: lenientSource(token), $options: "i" };
      return list.length === 1
        ? { [list[0]]: rx }
        : { $or: list.map((field) => ({ [field]: rx })) };
    }),
  };
}

/**
 * شرطِ جستجو را به فیلترِ موجود اضافه می‌کند بدون اینکه `$or`/`$and`ِ قبلی را
 * بشکند (اگر مستقیم Object.assign شود، فیلترهای موجود خراب می‌شوند).
 * فیلترِ ورودی تغییر نمی‌کند؛ یک آبجکتِ تازه برمی‌گردد.
 */
export function withSearch(filter, query, fields) {
  const condition = buildSearchFilter(query, fields);
  if (!condition) return { ...filter };
  const previous = Array.isArray(filter?.$and) ? filter.$and : [];
  return { ...filter, $and: [...previous, ...condition.$and] };
}

/** چند مقدار → یک رشته‌ی نرمال‌شده‌ی قابلِ جستجو (برای فیلترِ سمتِ کلاینت) */
export function searchHaystack(...values) {
  return normalizeSearchText(values.flat(Infinity).filter(Boolean).join(" "));
}

/** آیا همه‌ی توکن‌های کوئری در این مقادیر هست؟ (معادلِ سمتِ کلاینتِ buildSearchFilter) */
export function matchesSearch(query, ...values) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = searchHaystack(...values);
  return tokens.every((token) => haystack.includes(token));
}

/**
 * امتیازِ ربط. ترتیبِ خواسته‌شده: کد/SKUِ دقیق → تطابقِ قویِ چندتوکنی → نامی که
 * بیشترِ توکن‌ها را دارد → ترکیبِ برند و محصول → تطابقِ ناقص.
 * این ترتیب از وزنِ فیلد ضربدر کیفیتِ تطابق درمی‌آید، نه از قواعدِ جداگانه.
 *
 * `fields`: آرایه‌ای از `[value, weight]`.
 */
export function relevanceScore(query, fields) {
  const tokens = searchTokens(query);
  if (!tokens.length) return 0;
  const phrase = searchTokens(query).join(" ");
  let score = 0;

  for (const [rawValue, weight = 1] of fields) {
    const value = normalizeSearchText(rawValue);
    if (!value) continue;
    const flat = stripPunctuation(value).replace(/\s+/g, " ").trim();
    let field = 0;

    if (flat === phrase) field += 1000; // تطابقِ کاملِ فیلد (کد کالا/SKU)
    else if (flat.startsWith(phrase)) field += 300;
    else if (flat.includes(phrase)) field += 150; // عینِ عبارت، با همان ترتیب

    const words = flat.split(" ");
    for (const token of tokens) {
      if (words.includes(token)) field += 40; // کلمه‌ی کامل
      else if (words.some((w) => w.startsWith(token))) field += 25; // ابتدای کلمه
      else if (flat.includes(token)) field += 10; // جایی وسطِ متن
    }
    score += field * weight;
  }

  // هرچه نسبتِ بیشتری از کوئری پوشش داده شده باشد، بالاتر
  const haystack = stripPunctuation(searchHaystack(fields.map(([value]) => value)));
  const covered = tokens.filter((token) => haystack.includes(token)).length;
  return score * (covered / tokens.length);
}

/**
 * نتایج را بر اساسِ ربط مرتب می‌کند. `pick(doc)` باید `[[value, weight], ...]`
 * برگرداند. مرتب‌سازی پایدار است، پس ترتیبِ قبلیِ دیتابیس در امتیازهای برابر
 * حفظ می‌شود (یعنی sortِ موجود به هم نمی‌خورد).
 */
export function rankBySearch(query, docs, pick) {
  if (!searchTokens(query).length) return docs;
  return docs
    .map((doc, index) => ({ doc, index, score: relevanceScore(query, pick(doc)) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.doc);
}
