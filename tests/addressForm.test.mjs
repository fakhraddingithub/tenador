import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePhoneInput,
  validateAddressForm,
  validateAddressPayload,
} from '../src/lib/addressForm.mjs'

test('normalizes Persian and Arabic phone digits to English digits', () => {
  assert.equal(normalizePhoneInput('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789')
  assert.equal(normalizePhoneInput('٠٩١٢٣٤٥٦٧٨٩'), '09123456789')
  assert.equal(normalizePhoneInput('0912 345-6789'), '09123456789')
})

test('only name, last name, phone and city are required in the address form', () => {
  assert.deepEqual(
    validateAddressForm({
      firstName: 'علی',
      lastName: 'رضایی',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      city: 'تهران',
      title: '',
      postalCode: '',
      addressLine: '',
    }),
    {},
  )
})

test('server payload validation allows optional address details', () => {
  assert.deepEqual(
    validateAddressPayload({
      fullName: 'علی رضایی',
      phone: '09123456789',
      city: 'تهران',
    }),
    {},
  )
})
