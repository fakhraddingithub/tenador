'use client';

import { forwardRef } from 'react';

const GROUP_SEPARATOR_PATTERN = /[,\u066C\s]/g;
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => PERSIAN_DIGITS.indexOf(digit))
    .replace(/[٠-٩]/g, digit => ARABIC_DIGITS.indexOf(digit));
}

export function normalizeNumericValue(value, allowDecimal = true) {
  const normalized = toEnglishDigits(value)
    .replace(GROUP_SEPARATOR_PATTERN, '')
    .replace(/−/g, '-');
  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = normalized.replace(/-/g, '');

  if (!allowDecimal) return sign + unsigned.replace(/\D/g, '');

  const [integer = '', ...fractionParts] = unsigned.split('.');
  const cleanInteger = integer.replace(/\D/g, '');
  const cleanFraction = fractionParts.join('').replace(/\D/g, '');
  return sign + cleanInteger + (unsigned.includes('.') ? '.' + cleanFraction : '');
}

export function formatNumericValue(value) {
  if (value === '' || value == null) return '';

  const normalized = toEnglishDigits(value).replace(GROUP_SEPARATOR_PATTERN, '');
  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = normalized.replace(/^-/, '');
  const decimalIndex = unsigned.indexOf('.');
  const integer = decimalIndex === -1 ? unsigned : unsigned.slice(0, decimalIndex);
  const fraction = decimalIndex === -1 ? '' : unsigned.slice(decimalIndex);

  return sign + integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + fraction;
}

const AdminInput = forwardRef(function AdminInput(
  { type = 'text', formatNumber = true, value, onChange, step, inputMode, ...props },
  ref,
) {
  if (type !== 'number' || !formatNumber) {
    return (
      <input
        {...props}
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        step={step}
        inputMode={inputMode}
      />
    );
  }

  const allowDecimal = step === 'any' || (step != null && Number(step) % 1 !== 0);

  const handleChange = event => {
    if (!onChange) return;

    const rawValue = normalizeNumericValue(event.target.value, allowDecimal);
    const numericTarget = {
      name: event.target.name,
      id: event.target.id,
      value: rawValue,
      type: 'number',
      validity: event.target.validity,
      dataset: event.target.dataset,
    };

    onChange({
      ...event,
      target: numericTarget,
      currentTarget: numericTarget,
    });
  };

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode || (allowDecimal ? 'decimal' : 'numeric')}
      value={formatNumericValue(value)}
      onChange={handleChange}
    />
  );
});

export default AdminInput;
