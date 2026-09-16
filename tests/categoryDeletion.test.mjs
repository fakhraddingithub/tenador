import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { deleteCategoryWithProducts } from '../services/categoryDeletion.js';

// Minimal schemas exercise actual MongoDB transactions without production connections.
const id = mongoose.Schema.Types.ObjectId;
const models = {
  Category: mongoose.model('DeletionCategory', new mongoose.Schema({ slug: String, parent: id })),
  Product: mongoose.model('DeletionProduct', new mongoose.Schema({ category: id, isActive: Boolean })),
  Variant: mongoose.model('DeletionVariant', new mongoose.Schema({ productId: id })),
  PriceCache: mongoose.model('DeletionPrice', new mongoose.Schema({ productId: id })),
  SlugRegistery: mongoose.model('DeletionSlug', new mongoose.Schema({ type: String, refId: id })),
};
let server;
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(server.getUri());
  await Promise.all(Object.values(models).map(m => m.createCollection()));
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });
beforeEach(async () => { for (const m of Object.values(models)) await m.deleteMany({}); });

async function seed() {
  const category = await models.Category.create({ slug: 'socks' });
  const other = await models.Category.create({ slug: 'socks', parent: category._id });
  const products = await models.Product.create([
    { category: category._id, isActive: true },
    { category: category._id, isActive: false },
    { category: other._id, isActive: true },
  ]);
  for (const p of products) {
    await models.Variant.create({ productId: p._id });
    await models.PriceCache.create({ productId: p._id });
  }
  for (const c of [category, other]) await models.SlugRegistery.create({ type: 'category', refId: c._id });
  return { category, other, products };
}
test('missing or incorrect confirmation cannot delete any data', async () => {
  const { category } = await seed();
  for (const confirmationSlug of [undefined, '', 'wrong', 'SOCKS', {}]) {
    await assert.rejects(deleteCategoryWithProducts({ ...models, categoryId: category._id, confirmationSlug }), e => e.status === 400);
  }
  assert.equal(await models.Product.countDocuments(), 3);
  assert.equal(await models.Category.countDocuments(), 2);
  assert.equal(await models.Variant.countDocuments(), 3);
});
test('deletes active/inactive products and dependent variants/prices, preserves other category with same slug', async () => {
  const { category, other, products } = await seed();
  const result = await deleteCategoryWithProducts({ ...models, categoryId: category._id, confirmationSlug: 'socks' });
  assert.equal(result.deletedProducts, 2);
  assert.equal(await models.Category.findById(category._id), null);
  assert.equal((await models.Category.findById(other._id)).parent, null);
  for (const name of ['Product', 'Variant', 'PriceCache', 'SlugRegistery']) assert.equal(await models[name].countDocuments(), 1);
  assert.ok(await models.Product.findById(products[2]._id));
});
test('failure midway rolls back product, variant and category deletion', async () => {
  const { category } = await seed();
  await assert.rejects(deleteCategoryWithProducts({ ...models,
    SlugRegistery: { deleteMany: async () => { throw new Error('injected failure'); } },
    categoryId: category._id, confirmationSlug: 'socks',
  }), /injected failure/);
  assert.equal(await models.Product.countDocuments(), 3);
  assert.equal(await models.Variant.countDocuments(), 3);
  assert.equal(await models.PriceCache.countDocuments(), 3);
  assert.equal(await models.Category.countDocuments(), 2);
});
test('unknown category returns 404', async () => {
  await assert.rejects(deleteCategoryWithProducts({ ...models, categoryId: new mongoose.Types.ObjectId(), confirmationSlug: 'socks' }), e => e.status === 404);
});
