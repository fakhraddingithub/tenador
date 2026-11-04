import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { eurToToman } from '../src/lib/currency.js';

function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => ({ __esModule: true, ...(mocks[id] || {}) }), module, module.exports);
  return module.exports;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function priceHarness() {
  const flash = deferred(), rules = deferred(), calls = [];
  const { computeProductPrice } = load('services/priceEngine.js', {
    mongoose: { default: { Types: { ObjectId: class { constructor(value) { this.value = value; } } } } },
    '@/lib/Exchangerate': { eurToToman },
    'base/utils/discountWindow': { discountWindowFilter: () => ({}) },
    'base/utils/discountMatch': { ruleBrandFilterPasses: () => true },
    'base/models/FlashSale': { default: { findOne: () => ({ lean: () => { calls.push('flash'); return flash.promise; } }) } },
    'base/models/DiscountRule': { default: { find: query => {
      calls.push(query);
      return { sort: () => ({ lean: () => { calls.push('rules'); return rules.promise; } }) };
    } } },
  });
  return { flash, rules, calls, run: user => computeProductPrice({ _id: 'product', basePrice: 100 }, 1000, user) };
}

test('price reads overlap and no price is returned before the applicable rules arrive', async () => {
  const h = priceHarness();
  let complete = false;
  const result = h.run({ role: 'coach', level: 2 }).then(value => { complete = true; return value; });
  assert.ok(h.calls.includes('rules') && h.calls.includes('flash'));
  assert.ok(h.calls[0].$or.some(query => query.type === 'userRole'));
  assert.ok(h.calls[0].$or.some(query => query.type === 'userLevel'));
  h.flash.resolve(null);
  await tick();
  assert.equal(complete, false);
  h.rules.resolve([{ _id: 'r', type: 'userRole', title: 'coach', discount: { kind: 'percent', value: 10 } }]);
  assert.equal((await result).finalPriceToman, 90000);
});

test('flash price keeps precedence and does not wait for unrelated rules', async () => {
  const h = priceHarness();
  const result = h.run();
  h.flash.resolve({ _id: 'sale', flashPrice: 70 });
  assert.equal((await result).finalPriceToman, 70000);
  h.rules.reject(new Error('Rules unavailable'));
  await tick(); // rejection is handled even after returning the flash price
});

test('rule failure without a flash sale rejects instead of showing a fallback price', async () => {
  const h = priceHarness();
  const result = h.run();
  h.rules.reject(new Error('Rules unavailable'));
  h.flash.resolve(null);
  await assert.rejects(result, /Rules unavailable/);
});

test('navbar starts independent reads together and keeps category and audience output', async () => {
  const pending = Array.from({ length: 4 }, deferred), started = [];
  const query = (index) => {
    const q = { select: () => q, sort: () => q, lean: () => {
      started.push(index); return pending[index].promise;
    } };
    return q;
  };
  let aggregates = 0;
  const { getCachedNavbar } = load('src/lib/navbarService.js', {
    'next/cache': { unstable_cache: fn => fn },
    '@/lib/serverTiming': { timed: (name, work) => work() },
    'base/configs/db': { default: async () => {} },
    'base/models/Sport': { default: { find: () => query(0) } },
    'base/models/Category': { default: { find: () => query(2) } },
    'base/models/Product': { default: { aggregate: () => {
      const index = aggregates++ === 0 ? 1 : 3;
      started.push(index); return pending[index].promise;
    } } },
    'base/utils/navbarCategoryTree': { missingParentIds: () => [], fillStructuralAudiences: () => {} },
    'base/utils/targetAudience': { getEffectiveTargetAudienceFilters: values => values, normalizeTargetAudience: value => value },
  });
  const result = getCachedNavbar();
  await tick();
  assert.deepEqual([...started].sort(), [0, 1, 2, 3]);
  pending[0].resolve([{ _id: 's', title: 'Tennis' }]);
  pending[1].resolve([{ _id: { sport: 's', category: 'c' }, sport: 's', title: 'Rackets', brands: [{ _id: 'b' }] }]);
  pending[2].resolve([]);
  pending[3].resolve([{ _id: { sport: 's', category: 'c', brand: 'b' }, values: ['men'] }]);
  const [sport] = await result;
  assert.equal(sport.categories[0].title, 'Rackets');
  assert.deepEqual(sport.categories[0].brands[0].audiences, ['men']);
});
