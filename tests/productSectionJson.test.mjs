import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductSectionJson, validateProductSectionJson } from '../src/lib/productSectionJson.js';

const category = {
  attributes: [
    { name: 'weight', label: 'وزن', uiType: 'number-input', required: true },
    { name: 'material', label: 'جنس', uiType: 'text-input', required: true },
    { name: 'grip', label: 'گریپ', uiType: 'dropdown', options: ['S', 'M'] },
    { name: 'balance', uiType: 'number-input', required: true, targetAudiences: ['مردانه'] },
  ],
  technicalStats: [{ name: 'power', label: 'قدرت', min: 10, max: 90 }, { name: 'control' }],
};
const form = {
  name: 'راکت', shortDescription: 'کوتاه', longDescription: 'کامل', targetAudience: 'بچگانه',
  attributes: { weight: '0', material: 'کربن', grip: 'S, M', balance: 32 },
  technicalStats: { power: 50, control: 0 },
  basePrice: 1200, variantMeta: { untouched: true },
};
const validate = (section, data) => validateProductSectionJson(section, JSON.stringify(data), form, category);

test('exports only fields in the section, using current uiType and preserving zero', () => {
  assert.deepEqual(getProductSectionJson('basicInfo', form, category), {
    name: 'راکت', shortDescription: 'کوتاه', longDescription: 'کامل',
  });
  assert.deepEqual(getProductSectionJson('fixedAttributes', form, category), {
    weight: 0, material: 'کربن', grip: ['S', 'M'],
  });
  assert.equal(getProductSectionJson('technicalStats', form, category).control, 0);
});

test('all three sections round-trip without touching unrelated data', () => {
  for (const section of ['basicInfo', 'fixedAttributes', 'technicalStats']) {
    const before = structuredClone(form);
    const result = validate(section, getProductSectionJson(section, form, category));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(form, before);
    assert.equal(result.patch.basePrice, undefined);
    assert.equal(result.patch.variantMeta, undefined);
  }
});

test('malformed JSON, primitives, arrays, unknown and duplicate keys fail', () => {
  for (const text of ['{', '{"name":"a",}', 'null', '[]', 'true', '"name"']) {
    assert.ok(validateProductSectionJson('basicInfo', text, form, category).errors.length);
  }
  assert.ok(validate('basicInfo', { ...getProductSectionJson('basicInfo', form), basePrice: 1 }).errors.some(e => e.includes('basePrice')));
  for (const key of ['name', '\\u006eame']) {
    const result = validateProductSectionJson('basicInfo', `{"name":"a","${key}":"b","shortDescription":"s","longDescription":"l"}`, form, category);
    assert.ok(result.errors.some(e => e.includes('تکراری')));
  }
});

test('reports every invalid required basic field and refuses coercion', () => {
  const result = validate('basicInfo', { name: ' ', shortDescription: 5, longDescription: null });
  assert.equal(result.errors.length, 3);
  assert.equal(result.patch, undefined);
});

test('fixed attribute validation enforces required fields, types, options and allowed keys', () => {
  for (const attrs of [
    {}, { weight: '12', material: 'کربن' }, { weight: null, material: 'کربن' },
    { weight: true, material: 'کربن' }, { weight: 12, material: {} },
    { weight: 12, material: 'کربن', grip: ['L'] },
    { weight: 12, material: 'کربن', grip: ['S', 'S'] },
    { weight: 12, material: 'کربن', grip: ['S,M'] },
    { weight: 12, material: 'کربن', grip: 'S' },
    { weight: 12, material: 'کربن', balance: 40 },
    { weight: 12, material: 'کربن', unknown: 40 },
  ]) {
    const result = validate('fixedAttributes', attrs);
    assert.ok(result.errors.length, JSON.stringify(attrs));
    assert.equal(result.patch, undefined);
  }
});

test('replaces visible values, clears omitted optional fields, preserves hidden fields', () => {
  const result = validate('fixedAttributes', { weight: 0, material: 'جدید' });
  assert.deepEqual(result.patch.attributes, { weight: 0, material: 'جدید', grip: '', balance: 32 });
  assert.deepEqual(validate('fixedAttributes', { weight: 1, material: 'جدید', grip: ['M'] }).patch.attributes.grip, 'M');
});

test('radar validation enforces category bounds, finite numeric types and allowed keys', () => {
  for (const stats of [{ power: 9 }, { power: 91 }, { control: -1 }, { control: 101 },
    { power: '50' }, { power: null }, { power: true }, { power: [] }, { unknown: 50 }]) {
    assert.ok(validate('technicalStats', stats).errors.length, JSON.stringify(stats));
  }
  assert.ok(validateProductSectionJson('technicalStats', '{"power":1e400}', form, category).errors.length);
  assert.deepEqual(validate('technicalStats', { power: 10, control: 100 }).errors, []);
  assert.deepEqual(validate('technicalStats', { power: '' }).patch, { technicalStats: {} });
});

test('missing category fails safely and inherited keys cannot enter the patch', () => {
  assert.ok(validateProductSectionJson('fixedAttributes', '{}', form, null).errors.length);
  for (const section of ['basicInfo', 'fixedAttributes', 'technicalStats']) {
    assert.ok(validateProductSectionJson(section, '{"__proto__":{"polluted":true}}', form, category).errors.length);
  }
  assert.equal({}.polluted, undefined);
});

test('legacy attribute type remains supported', () => {
  const legacyCategory = { attributes: [{ name: 'size', type: 'select' }, { name: 'weight', type: 'number' }] };
  const result = validateProductSectionJson('fixedAttributes', '{"size":["L"],"weight":12}', form, legacyCategory);
  assert.deepEqual(result.errors, []);
  assert.equal(result.patch.attributes.size, 'L');
  assert.equal(result.patch.attributes.weight, 12);
});
