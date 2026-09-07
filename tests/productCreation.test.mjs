import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { validateProductVariants, validateProductFields } from '../src/lib/productVariantValidation.js';
import { createProductWithVariants } from '../src/lib/createProductWithVariants.js';
import { makeComboKey } from '../src/lib/variantKey.js';

register('./productCreationHooks.mjs', import.meta.url);
let repl, Product, Variant, category, fieldsCategory, handleApiError, POST, PUT;
const required = [{ name: 'size', label: 'سایز کفش', required: true }];

before(async () => {
  // Real replica set, real schemas and save hooks; no production database access.
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import('../models/registerModels.js');
  Product = mongoose.model('Product');
  Variant = mongoose.model('Variant');
  category = await mongoose.model('Category').create({
    name: 'tennis-shoes', title: 'کفش تنیس', sport: new mongoose.Types.ObjectId(),
    variantAttributes: required,
  });
  fieldsCategory = await mongoose.model('Category').create({
    name: 'rackets', title: 'راکت', sport: category.sport,
    attributes: [{ name: 'material', label: 'جنس', required: true }],
    technicalStats: [{ name: 'power', label: 'قدرت' }],
    variantAttributes: [],
  });
  await Product.init();
  await Variant.init();
  ({ handleApiError } = await import('../src/lib/apiError.js'));
  ({ POST } = await import('../src/app/api/product/create/route.js'));
  ({ PUT } = await import('../src/app/api/product/[productId]/route.js'));
});
after(async () => { await mongoose.disconnect(); await repl?.stop(); });

function data(name) {
  return { name, sku: name, shortDescription: 'short', longDescription: 'long',
    mainImage: 'https://example.com/shoe.jpg', category: category._id,
    brand: new mongoose.Types.ObjectId(), sport: category.sport };
}
function create(name, variants, extra = {}) {
  return createProductWithVariants({ Product, Variant, productData: { ...data(name), ...extra },
    variants: variants.map((variant) => ({ categoryId: category._id, price: 100, ...variant })) });
}
const put = (id, body) =>
  PUT({ json: async () => body }, { params: Promise.resolve({ productId: String(id) }) });

test('required variants reject omitted, empty, blank and malformed values', () => {
  for (const options of [undefined, {}, { size: [] }, { size: [''] }, { size: ['  '] },
    { size: [null] }, { size: [{}] }, { size: '42' }]) {
    assert.ok(validateProductVariants(required, options).error);
  }
  assert.match(validateProductVariants(required, {}).error, /سایز کفش/);
});
test('required variants reject deselecting every combination or stale selections', () => {
  for (const selected of [[], ['size=99']]) {
    assert.ok(validateProductVariants(required, { size: ['42'] }, selected).error);
  }
});
test('optional empty variants create no phantom combination; numeric and duplicate sizes work', () => {
  assert.deepEqual(validateProductVariants([], {}).combinations, []);
  assert.deepEqual(validateProductVariants([{ name: 'size' }], { size: [] }).combinations, []);
  assert.deepEqual(validateProductVariants(required, { size: [42, '42', '42.5'] }).combinations,
    [{ size: '42' }, { size: '42.5' }]);
  assert.ok(validateProductVariants(required, { size: ['42'], unknown: ['x'] }).error);
});
test('padded variant values are rejected, never silently trimmed', () => {
  // Trimming would change the combination key, and that key is the variant's
  // identity — an existing variant would be deleted and rebuilt with a new _id.
  assert.match(validateProductVariants(required, { size: [' 42'] }).error, /فاصله/);
  assert.match(validateProductVariants(required, { size: ['42 '] }).error, /فاصله/);
  assert.equal(validateProductVariants(required, { size: ['42'] }).error, undefined);
});
test('invalid required variant leaves neither product nor variants', async () => {
  await assert.rejects(create('invalid-required', [{ attributes: { size: '42' } }, { attributes: {} }]));
  assert.equal(await Product.countDocuments({ sku: 'invalid-required' }), 0);
  assert.equal(await Variant.countDocuments({ sku: /^invalid-required-V/ }), 0);
  await assert.rejects(create('blank-required', [{ attributes: { size: '   ' } }]));
  assert.equal(await Product.countDocuments({ sku: 'blank-required' }), 0);
});
test('late unique-index failure rolls back product and earlier successful variant', async () => {
  const existing = await Variant.create({ productId: new mongoose.Types.ObjectId(),
    categoryId: category._id, sku: 'rollback-V2', attributes: { size: '45' }, price: 100 });
  await assert.rejects(create('rollback', [{ attributes: { size: '42' } }, { attributes: { size: '43' } }]),
    (error) => error.code === 11000);
  assert.equal(await Product.countDocuments({ sku: 'rollback' }), 0);
  assert.equal(await Variant.countDocuments({ sku: 'rollback-V1' }), 0);
  assert.ok(await Variant.findById(existing._id));
});
test('successful creation links all variants and generates their slugs', async () => {
  const product = await create('valid-shoes', [{ attributes: { size: '42' } }, { attributes: { size: '43' } }]);
  const stored = await Product.findById(product._id).populate('variants');
  assert.equal(stored.variants.length, 2);
  assert.ok(stored.slug);
  assert.ok(stored.variants.every((variant) => variant.slug && variant.productId.equals(product._id)));
});
test('invalid athlete array reproduces the screenshot but reports the actual field', async () => {
  let error;
  try { await create('invalid-athlete', [], { athlete: ['Roger Federer'] }); }
  catch (caught) { error = caught; }
  assert.equal(error.name, 'ValidationError');
  assert.ok(error.errors['athlete.0']);
  const response = handleApiError(error);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /ورزشکار/);
  assert.doesNotMatch(body.error, /«0»/);
  assert.equal(await Product.countDocuments({ sku: 'invalid-athlete' }), 0);
});
test('nested array errors name the field and preserve enum details', async () => {
  const document = new Product({ ...data('bad-gallery'), gallery: [{}], label: 'invalid-label' });
  const error = document.validateSync();
  const body = await handleApiError(error).json();
  assert.match(body.fieldErrors['gallery.0'], /گالری/);
  assert.match(body.fieldErrors.label, /invalid-label/);
});

test('create API rejects missing required options before any write', async () => {
  for (const [index, extra] of [
    {}, { variantOptions: {} }, { variantOptions: { size: [] } },
    { variantOptions: { size: ['42'] }, selectedCombos: [] },
  ].entries()) {
    const name = `api-invalid-${index}`;
    const response = await POST({ json: async () => ({ ...data(name), ...extra }) });
    assert.equal(response.status, 400);
    assert.equal(await Product.countDocuments({ name }), 0);
  }
});
test('create API persists only selected valid combinations', async () => {
  const response = await POST({ json: async () => ({ ...data('api-valid'),
    variantOptions: { size: ['42', '43'] }, selectedCombos: ['size=42'] }) });
  assert.equal(response.status, 201);
  const { product } = await response.json();
  const variants = await Variant.find({ productId: product._id });
  assert.equal(variants.length, 1);
  assert.equal(variants[0].attributes.get('size'), '42');
});

// ── Product fields (shared by create and edit) ───────────────────────────────

test('product field validation catches every hole the create route used to leak', () => {
  const definition = { attributes: [{ name: 'material', label: 'جنس', required: true }],
    technicalStats: [{ name: 'power', label: 'قدرت', min: 0, max: 100 }] };
  // absent `attributes` used to skip the required check entirely
  assert.match(validateProductFields(definition, { attributes: {} }).error, /جنس/);
  // an empty string used to satisfy `!== undefined && !== null`
  assert.match(validateProductFields(definition, { attributes: { material: '  ' } }).error, /جنس/);
  assert.match(validateProductFields(definition, { attributes: { material: [] } }).error, /جنس/);
  assert.match(validateProductFields(definition, { attributes: { nope: 'x' } }).error, /nope/);
  // out-of-range stats used to be console.warn'd and stored, breaking the radar chart
  assert.match(validateProductFields(definition, { technicalStats: { power: 5000 } }).error, /۰|0/);
  assert.match(validateProductFields(definition, { technicalStats: { power: 'abc' } }).error, /قدرت/);
  assert.match(validateProductFields(definition, { technicalStats: { bogus: 1 } }).error, /bogus/);
  assert.match(validateProductFields(definition, { basePrice: -1 }).error, /قیمت پایه/);
  assert.match(validateProductFields(definition, { basePrice: 'abc' }).error, /قیمت پایه/);
  // undefined means "not setting this field" and must be skipped, not rejected
  assert.deepEqual(validateProductFields(definition, {}), {});
  assert.deepEqual(validateProductFields(definition, { basePrice: '', attributes: { material: 'x' },
    technicalStats: { power: 100 } }), {});
});
test('create API rejects a negative base price and an out-of-range stat', async () => {
  const withCategory = (name, extra) => ({ ...data(name), category: fieldsCategory._id,
    attributes: { material: 'x' }, variantOptions: {}, ...extra });
  for (const [name, extra] of [
    ['bad-price', { basePrice: -500 }],
    ['bad-price-text', { basePrice: 'abc' }],
    ['bad-stat', { technicalStats: { power: 5000 } }],
    ['missing-attr', { attributes: {} }],
  ]) {
    const response = await POST({ json: async () => withCategory(name, extra) });
    assert.equal(response.status, 400, name);
    assert.equal(await Product.countDocuments({ name }), 0, name);
  }
});

// ── Edit route (PUT) ─────────────────────────────────────────────────────────
//
// The edit route used to validate nothing at all, so every guard the create
// route had could be walked straight past by saving the product instead.

test('edit refuses to wipe the variants of a category that requires them', async () => {
  const product = await create('edit-wipe', [{ attributes: { size: '42' } }, { attributes: { size: '43' } }]);
  const response = await put(product._id, { ...data('edit-wipe'), variantOptions: {}, selectedCombos: [] });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /سایز کفش/);
  // the order lines and warehouse barcodes pointing at these _ids are intact
  assert.equal(await Variant.countDocuments({ productId: product._id }), 2);
});

test('edit of a product that never had variants is not blocked by that rule', async () => {
  // Legacy products predate the create-side validation and can legitimately have
  // no variants; refusing their edits would lock the admin out for nothing.
  assert.deepEqual(validateProductVariants(required, {}, [], { allowEmpty: true }).combinations, []);
  assert.ok(validateProductVariants(required, { size: [''] }, [], { allowEmpty: true }).error);

  const product = await create('edit-never-had', []);
  assert.equal(await Variant.countDocuments({ productId: product._id }), 0);
  const response = await put(product._id, { ...data('edit-never-had'),
    shortDescription: 'edited', variantOptions: {}, selectedCombos: [] });
  assert.equal(response.status, 200);
  assert.equal((await Product.findById(product._id)).shortDescription, 'edited');
});

test('edit rejects a category id that does not exist, and says so about the category', async () => {
  const product = await create('edit-ghost-cat', [{ attributes: { size: '42' } }]);
  const ghost = new mongoose.Types.ObjectId();
  const response = await put(product._id, { ...data('edit-ghost-cat'), category: ghost,
    variantOptions: { size: ['42'] }, selectedCombos: ['size=42'] });
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.match(body.error, /دسته‌بندی/);
  assert.ok(body.fieldErrors.category);
  assert.equal(String((await Product.findById(product._id)).category), String(category._id));
});

test('a failed edit leaves no half-written variant behind', async () => {
  const product = await create('edit-atomic', [{ attributes: { size: '42' } }]);
  const before = await Variant.find({ productId: product._id });
  const response = await put(product._id, { ...data('edit-atomic'), name: '',
    variantOptions: { size: ['42', '44'] }, selectedCombos: ['size=42', 'size=44'] });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /نام/);

  const after = await Variant.find({ productId: product._id });
  assert.equal(after.length, 1);                                   // no orphaned "44"
  assert.equal(String(after[0]._id), String(before[0]._id));
  assert.equal((await Product.findById(product._id)).name, 'edit-atomic');
});

test('edit leaves fields the request did not send alone', async () => {
  const product = await create('edit-untouched', [{ attributes: { size: '42' } }]);
  await Product.updateOne({ _id: product._id }, { $set: { tag: ['keep'], gallery: ['g1'],
    color: '#fff', variantMeta: { size: { 42: { images: ['i'] } } } } });

  const response = await put(product._id, { name: 'edit-untouched', shortDescription: 'short',
    longDescription: 'long', mainImage: 'https://example.com/shoe.jpg' });
  assert.equal(response.status, 200);

  const stored = await Product.findById(product._id).lean();
  assert.deepEqual(stored.tag, ['keep']);
  assert.deepEqual(stored.gallery, ['g1']);
  assert.equal(stored.color, '#fff');
  assert.deepEqual(stored.variantMeta, { size: { 42: { images: ['i'] } } });
  assert.equal(stored.variants.length, 1);
  assert.equal(await Variant.countDocuments({ productId: product._id }), 1);
});

test('edit applies the same field validation the create route does', async () => {
  const product = await create('edit-fields', [], { category: fieldsCategory._id });
  for (const extra of [{ attributes: { nope: 'x' } }, { technicalStats: { power: 5000 } },
    { basePrice: -1 }, { attributes: {} }]) {
    const response = await put(product._id, extra);
    assert.equal(response.status, 400, JSON.stringify(extra));
  }
  // mongoose `minimize` drops empty objects, so absent here means "nothing was written"
  const stored = await Product.findById(product._id).lean();
  assert.deepEqual(stored.attributes ?? {}, {});
  assert.deepEqual(stored.technicalStats ?? {}, {});
});

test('a normal edit keeps variant identity and still applies real changes', async () => {
  const product = await create('edit-happy', [{ attributes: { size: '42' } }, { attributes: { size: '43' } }]);
  const before = await Variant.find({ productId: product._id }).sort({ sku: 1 });
  const key = (size) => makeComboKey({ size });

  const response = await put(product._id, { ...data('edit-happy'), basePrice: 200,
    shortDescription: 'edited',
    variantOptions: { size: ['42', '43', '44'] },
    selectedCombos: [key('42'), key('43'), key('44')],
    variantDetails: { [key('42')]: { price: 555, images: [] } } });
  assert.equal(response.status, 200);

  const after = await Variant.find({ productId: product._id });
  assert.equal(after.length, 3);
  for (const original of before) {
    const kept = after.find((variant) => String(variant._id) === String(original._id));
    assert.ok(kept, `variant ${original.sku} lost its identity`);
    assert.equal(kept.sku, original.sku);
  }
  assert.equal(after.find((v) => v.attributes.get('size') === '42').price, 555);
  assert.equal(after.find((v) => v.attributes.get('size') === '44').price, 200);
  assert.equal((await Product.findById(product._id)).shortDescription, 'edited');
});

test('edit can still remove a combination the admin deliberately deselected', async () => {
  const product = await create('edit-remove', [{ attributes: { size: '42' } }, { attributes: { size: '43' } }]);
  const response = await put(product._id, { ...data('edit-remove'),
    variantOptions: { size: ['42', '43'] }, selectedCombos: [makeComboKey({ size: '42' })] });
  assert.equal(response.status, 200);
  const after = await Variant.find({ productId: product._id });
  assert.equal(after.length, 1);
  assert.equal(after[0].attributes.get('size'), '42');
});
