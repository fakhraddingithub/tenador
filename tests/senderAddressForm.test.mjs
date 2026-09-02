/**
 * tests/senderAddressForm.test.mjs
 *
 * نگهبانِ مرزِ اعتمادِ آدرسِ فرستنده: همان ماژولی که هم فرمِ ادمین و هم روتِ
 * API با آن اعتبارسنجی می‌کنند.
 *
 * اجرا: npm run test:sender-address
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  SENDER_ADDRESS_LIMITS,
  firstSenderAddressError,
  normalizeDigits,
  normalizeSenderAddress,
  senderAddressSummary,
  validateSenderAddress,
} from "../src/lib/senderAddressForm.mjs";

const valid = {
  title: "انبار تهران",
  fullName: "فروشگاه تنادور",
  phone: "02112345678",
  province: "تهران",
  city: "تهران",
  addressLine: "خیابان ولیعصر، پلاک ۱۰",
  postalCode: "1234567890",
};

test("آدرس کامل معتبر است", () => {
  assert.deepEqual(validateSenderAddress(valid), {});
});

test("تلفنِ ثابت رد نمی‌شود (تفاوتِ عمدی با آدرسِ مشتری)", () => {
  assert.equal(validateSenderAddress({ ...valid, phone: "02188776655" }).phone, undefined);
  assert.equal(validateSenderAddress({ ...valid, phone: "09121234567" }).phone, undefined);
});

test("فیلدهای الزامی خطا می‌دهند", () => {
  const errors = validateSenderAddress({});
  assert.ok(errors.fullName);
  assert.ok(errors.phone);
  assert.ok(errors.city);
  assert.ok(errors.addressLine);
  // استان و عنوان اختیاری‌اند
  assert.equal(errors.province, undefined);
  assert.equal(errors.title, undefined);
});

test("فضای خالی به‌تنهایی مقدار حساب نمی‌شود", () => {
  const errors = validateSenderAddress({ ...valid, fullName: "   " });
  assert.ok(errors.fullName);
});

test("ارقام فارسی/عربی به انگلیسی تبدیل می‌شوند", () => {
  assert.equal(normalizeDigits("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567");
  assert.equal(normalizeDigits("٠٢١-٨٨٧٧"), "0218877");
  assert.equal(normalizeSenderAddress({ ...valid, phone: "۰۲۱ ۸۸۷۷۶۶۵۵" }).phone, "02188776655");
});

test("طولِ تلفن کران دارد", () => {
  assert.ok(validateSenderAddress({ ...valid, phone: "1234567" }).phone);
  assert.ok(validateSenderAddress({ ...valid, phone: "1234567890123456" }).phone);
});

test("کد پستی اختیاری است ولی اگر بیاید باید ۱۰ رقم باشد", () => {
  assert.equal(validateSenderAddress({ ...valid, postalCode: "" }).postalCode, undefined);
  assert.ok(validateSenderAddress({ ...valid, postalCode: "123" }).postalCode);
});

test("نرمال‌سازی فیلدهای ناخواسته را دور می‌ریزد (whitelist)", () => {
  const out = normalizeSenderAddress({ ...valid, _id: "x", createdBy: "y", role: "admin" });
  assert.deepEqual(Object.keys(out).sort(), [
    "addressLine",
    "city",
    "fullName",
    "phone",
    "postalCode",
    "province",
    "title",
  ]);
});

test("مقادیرِ بیش‌ازحد بلند بریده می‌شوند", () => {
  const out = normalizeSenderAddress({ ...valid, addressLine: "ا".repeat(900) });
  assert.equal(out.addressLine.length, SENDER_ADDRESS_LIMITS.addressLine);
});

test("firstSenderAddressError اولین پیام را می‌دهد و برای معتبر null است", () => {
  assert.equal(firstSenderAddressError(validateSenderAddress(valid)), null);
  assert.equal(typeof firstSenderAddressError(validateSenderAddress({})), "string");
});

test("خلاصه‌ی یک‌خطی بخش‌های خالی را جا نمی‌اندازد", () => {
  assert.equal(
    senderAddressSummary({ province: "", city: "تهران", addressLine: "خیابان ولیعصر" }),
    "تهران، خیابان ولیعصر"
  );
  assert.equal(senderAddressSummary(null), "");
});
