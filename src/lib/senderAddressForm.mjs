/**
 * src/lib/senderAddressForm.mjs
 *
 * اعتبارسنجی + نرمال‌سازیِ آدرسِ فرستنده — ماژولِ خالص، مشترکِ کلاینت و سرور.
 *
 * چرا جدا از addressForm.mjs: آنجا شماره باید موبایلِ ۱۱ رقمیِ ۰۹... باشد چون
 * برای پیامکِ تحویل به مشتری است. فرستنده معمولاً یک کسب‌وکار است و تلفنِ ثابت
 * (۰۲۱...) دارد؛ با آن قانون هیچ آدرسِ فرستنده‌ای قابلِ ثبت نبود.
 *
 * سرور *همیشه* دوباره اعتبارسنجی می‌کند؛ نسخه‌ی کلاینت فقط برای خطای زودهنگام
 * است.
 */

import { toEnglishDigits } from "./addressForm.mjs";

/** بیشینه‌ی طولِ هر فیلد — هم‌تراز با maxlength در models/SenderAddress.js */
export const SENDER_ADDRESS_LIMITS = {
  title: 60,
  fullName: 120,
  phone: 20,
  province: 80,
  city: 80,
  addressLine: 500,
  postalCode: 20,
};

/** فقط ارقام (فارسی/عربی هم به انگلیسی تبدیل می‌شوند) — برای تلفن و کد پستی. */
export function normalizeDigits(value = "", max = 20) {
  return toEnglishDigits(String(value ?? ""))
    .replace(/[^0-9]/g, "")
    .slice(0, max);
}

const trim = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * شکلِ نهاییِ ذخیره‌شدنی. هرچه در بدنه‌ی درخواست بیاید و اینجا نباشد دور ریخته
 * می‌شود (whitelist)، پس کلاینت نمی‌تواند فیلدِ ناخواسته تزریق کند.
 */
export function normalizeSenderAddress(input = {}) {
  const L = SENDER_ADDRESS_LIMITS;
  return {
    title: trim(input.title, L.title),
    fullName: trim(input.fullName, L.fullName),
    phone: normalizeDigits(input.phone, L.phone),
    province: trim(input.province, L.province),
    city: trim(input.city, L.city),
    addressLine: trim(input.addressLine, L.addressLine),
    postalCode: normalizeDigits(input.postalCode, L.postalCode),
  };
}

/** خطاها به‌ازای فیلد؛ شیِ خالی یعنی معتبر. */
export function validateSenderAddress(input = {}) {
  const data = normalizeSenderAddress(input);
  const errors = {};

  if (!data.fullName) errors.fullName = "نام فرستنده را وارد کنید";
  if (!data.phone) {
    errors.phone = "شماره تماس را وارد کنید";
  } else if (data.phone.length < 8 || data.phone.length > 15) {
    // ثابت (۰۲۱۱۲۳۴۵۶۷۸) و موبایل (۰۹۱۲۱۲۳۴۵۶۷) هر دو باید بگذرند.
    errors.phone = "شماره تماس باید بین ۸ تا ۱۵ رقم باشد";
  }
  if (!data.city) errors.city = "شهر را وارد کنید";
  if (!data.addressLine) errors.addressLine = "آدرس کامل را وارد کنید";
  if (data.postalCode && data.postalCode.length !== 10) {
    errors.postalCode = "کد پستی باید ۱۰ رقم باشد";
  }

  return errors;
}

export function firstSenderAddressError(errors) {
  return Object.values(errors)[0] || null;
}

/** خلاصه‌ی یک‌خطی برای فهرست‌ها. */
export function senderAddressSummary(address) {
  if (!address) return "";
  return [address.province, address.city, address.addressLine]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("، ");
}
