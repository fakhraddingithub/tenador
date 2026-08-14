import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePhoneInput,
  validateAddressForm,
  validateAddressPayload,
} from '../src/lib/addressForm.mjs'

test('keeps the entered phone digit language while removing separators', () => {
  assert.equal(normalizePhoneInput('۰۹۱۲۳۴۵۶۷۸۹'), '۰۹۱۲۳۴۵۶۷۸۹')
  assert.equal(normalizePhoneInput('٠٩١٢٣٤٥٦٧٨٩'), '٠٩١٢٣٤٥٦٧٨٩')
  assert.equal(normalizePhoneInput('0912 345-6789'), '09123456789')
})

test('accepts Persian phone digits when the complete address is present', () => {
  assert.deepEqual(
    validateAddressForm({
      firstName: 'علی',
      lastName: 'رضایی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      city: 'تهران',
      title: '',
      postalCode: '',
      addressLine: 'خیابان ولیعصر، پلاک ۱۲',
    }),
    {},
  )
})

test('requires the complete address in client and server validation', () => {
  assert.equal(validateAddressForm({
    firstName: 'علی',
    lastName: 'رضایی',
    phone: '09123456789',
    city: 'تهران',
    addressLine: '   ',
  }).addressLine, 'آدرس کامل را وارد کنید')

  assert.equal(validateAddressPayload({
    fullName: 'علی رضایی',
    phone: '09123456789',
    city: 'تهران',
    addressLine: '',
  }).addressLine, 'آدرس کامل را وارد کنید')
})

test('server payload validation accepts Persian and English phone digits with no postal code', () => {
  for (const phone of ['09123456789', '۰۹۱۲۳۴۵۶۷۸۹']) {
    assert.deepEqual(
      validateAddressPayload({
        fullName: 'علی رضایی',
        phone,
        city: 'تهران',
        addressLine: 'خیابان ولیعصر، پلاک ۱۲',
      }),
      {},
    )
  }
})
