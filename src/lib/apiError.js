/**
 * src/lib/apiError.js  (server)
 *
 * مدیریت یکپارچه‌ی خطای APIهای ادمین. هدف: خطاهای واقعیِ اعتبارسنجی/تکراری/
 * ارجاعِ نامعتبر با پیام فارسیِ روشن و کدِ وضعیتِ درست برگردانده شوند و هرگز
 * جزئیاتِ داخلی (stack، پیام خام دیتابیس، E11000 ...) به کلاینت درز نکند.
 *
 * قرارداد پاسخِ خطا (یکسان در کل پروژه):
 *   { error: string, fieldErrors?: { [field]: string } }
 * فرانت‌اند فقط باید `error` را نمایش دهد؛ `fieldErrors` برای فوکوس/های‌لایت
 * اختیاری است. برای مصرفِ کلاینت، getApiErrorMessage در apiClientError.js.
 */

import { NextResponse } from "next/server";

// نامِ فیلدِ مدل → برچسبِ فارسی برای پیام‌های خطا
const FIELD_LABELS = {
  name: "نام",
  title: "عنوان",
  slug: "اسلاگ (نشانی)",
  sku: "کد کالا (SKU)",
  sport: "ورزش",
  brand: "برند",
  serie: "سری",
  parentSerie: "سری والد",
  category: "دسته‌بندی",
  parent: "دسته‌ی والد",
  color: "رنگ",
  basePrice: "قیمت پایه",
  price: "قیمت",
  description: "توضیحات",
  shortDescription: "توضیح کوتاه",
  longDescription: "توضیح کامل",
  mainImage: "تصویر اصلی",
  image: "تصویر",
  gallery: "گالری",
  logo: "لوگو",
  icon: "آیکون",
  order: "ترتیب",
  foundedYear: "سال تأسیس",
  country: "کشور",
  athlete: "ورزشکار",
  limitedEdition: "نسخه محدود",
  attributes: "ویژگی‌ها",
  variantAttributes: "ویژگی‌های متغیر",
  technicalStats: "شاخص‌های فنی",
};

function labelFor(field) {
  return FIELD_LABELS[field] || field;
}

/**
 * پاسخِ خطای ساختارمند و تمیز.
 * @param {string} message  پیام قابل‌نمایش به کاربر (فارسی)
 * @param {number} status   کد وضعیت HTTP
 * @param {object} [extra]  فیلدهای اضافی مثل fieldErrors
 */
export function apiError(message, status = 400, extra = undefined) {
  return NextResponse.json(
    extra ? { error: message, ...extra } : { error: message },
    { status }
  );
}

/**
 * تبدیلِ خطای گرفته‌شده در catch به پاسخِ مناسب. خطاهای شناخته‌شده‌ی Mongoose
 * به ۴۰۰/۴۰۹ با پیام روشن نگاشت می‌شوند؛ بقیه ۵۰۰ عمومی (بدون درزِ جزئیات).
 *
 * @param {unknown} error
 * @param {string} [fallback]  پیام ۵۰۰ عمومی
 */
export function handleApiError(error, fallback = "خطای غیرمنتظره‌ی سرور؛ لطفاً دوباره تلاش کنید") {
  // ۱) ولیدیشنِ Mongoose → پیام هر فیلد
  if (error?.name === "ValidationError" && error.errors) {
    const fieldErrors = {};
    for (const [path, e] of Object.entries(error.errors)) {
      const label = labelFor(path.split(".").pop());
      // پیامِ اختصاصیِ اسکیمای Mongoose (اگر تعریف شده) وگرنه پیامِ عمومی
      fieldErrors[path] =
        e?.kind === "required"
          ? `«${label}» الزامی است`
          : e?.message && !/^Path |is required$|Cast to /.test(e.message)
            ? e.message
            : `مقدار «${label}» نامعتبر است`;
    }
    const first = Object.values(fieldErrors)[0] || "اطلاعات واردشده نامعتبر است";
    return apiError(first, 400, { fieldErrors });
  }

  // ۲) کلیدِ تکراری (unique index) → ۴۰۹
  if (error?.code === 11000) {
    const keys = Object.keys(error.keyValue || {});
    // ایندکسِ مرکب (مثل {sport, slug}) → پیامِ «در این محدوده تکراری است»
    const hasSlug = keys.includes("slug");
    const primary = keys.find((k) => k !== "sport" && k !== "brand") || keys[0];
    const label = labelFor(primary);
    const scoped = keys.includes("sport") || keys.includes("brand");
    const message = hasSlug
      ? `«${labelFor("name")}» انتخاب‌شده${scoped ? " در این محدوده" : ""} تکراری است؛ نامی دیگر انتخاب کنید`
      : `«${label}»${scoped ? " در این محدوده" : ""} تکراری است؛ مقداری دیگر وارد کنید`;
    return apiError(message, 409, primary ? { fieldErrors: { [primary]: message } } : undefined);
  }

  // ۳) شناسه/ارجاعِ نامعتبر (ObjectId خراب و ...)
  if (error?.name === "CastError") {
    const label = labelFor(error.path);
    return apiError(`مقدار «${label}» نامعتبر است`, 400, { fieldErrors: { [error.path]: `مقدار «${label}» نامعتبر است` } });
  }

  // ۴) بدنه‌ی JSON خراب
  if (error instanceof SyntaxError) {
    return apiError("داده‌های ارسالی نامعتبر است", 400);
  }

  // ۵) خطای پیش‌بینی‌نشده — فقط سمت سرور لاگ می‌شود، جزئیات درز نمی‌کند
  console.error("[apiError:500]", error);
  return apiError(fallback, 500);
}
