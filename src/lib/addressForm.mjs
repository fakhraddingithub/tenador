const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toEnglishDigits(value = '') {
  return String(value)
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

export function normalizePhoneInput(value = '') {
  return String(value).replace(/[^0-9۰-۹٠-٩]/g, '').slice(0, 11)
}

export function validateAddressForm(data) {
  const errors = {}
  const phone = toEnglishDigits(normalizePhoneInput(data.phone))

  if (!data.firstName?.trim()) errors.firstName = 'نام را وارد کنید'
  if (!data.lastName?.trim()) errors.lastName = 'نام خانوادگی را وارد کنید'
  if (!phone) {
    errors.phone = 'شماره موبایل را وارد کنید'
  } else if (!/^09\d{9}$/.test(phone)) {
    errors.phone = 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'
  }
  if (!data.city?.trim()) errors.city = 'شهر را وارد کنید'
  if (!data.addressLine?.trim()) errors.addressLine = 'آدرس کامل را وارد کنید'

  return errors
}

export function validateAddressPayload(data) {
  const errors = {}
  const phone = toEnglishDigits(normalizePhoneInput(data.phone))

  const hasSeparateNameFields = data.firstName !== undefined || data.lastName !== undefined
  if (hasSeparateNameFields) {
    if (!data.firstName?.trim()) errors.firstName = 'نام را وارد کنید'
    if (!data.lastName?.trim()) errors.lastName = 'نام خانوادگی را وارد کنید'
  } else if (!data.fullName?.trim()) {
    errors.fullName = 'نام و نام خانوادگی را وارد کنید'
  }
  if (!phone) {
    errors.phone = 'شماره موبایل را وارد کنید'
  } else if (!/^09\d{9}$/.test(phone)) {
    errors.phone = 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد'
  }
  if (!data.city?.trim()) errors.city = 'شهر را وارد کنید'
  if (!data.addressLine?.trim()) errors.addressLine = 'آدرس کامل را وارد کنید'

  return errors
}

export function firstAddressError(errors) {
  return Object.values(errors)[0] || null
}
