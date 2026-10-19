import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProductMetadata, productMetaText } from '../src/lib/seo/productSeo.js';
import { generateProductSchema } from '../src/lib/seo/productSchema.js';
import { generateBreadcrumbSchema } from '../src/lib/seo/breadcrumbSchema.js';
import { listingPage, listingCanonical } from '../src/lib/seo/listingPagination.js';
import robots from '../src/app/robots.js';
const product = { name: 'Blade 98', slug: 'blade-98', basePrice: 100000, sku: 'internal-sku', sport: { slug: 'tennis', title: 'تنیس' }, category: { slug: 'racket', title: 'راکت' }, brand: { slug: 'wilson', title: 'ویلسون' }, serie: { slug: 'blade', title: 'بلید' } };
test('metadata removes markup, preserves Persian and entity text, and falls back when empty', () => {
 assert.equal(productMetaText('<p>راکت &amp; توپ</p><p>ویلسون<br>۹۸</p><script>bad()</script>'), 'راکت & توپ ویلسون ۹۸');
 assert.equal(generateProductMetadata({ ...product, shortDescription: '<p> </p>' }).description, 'خرید Blade 98 با ضمانت اصالت و ارسال سریع از تنادور');
 assert.equal(generateProductMetadata(product).alternates.canonical.endsWith('/products/blade-98'), true);
});
test('schema uses final anonymous single-unit price, preserves zero, and changes no other offer fields', () => {
 const original = generateProductSchema(product);
 const discounted = generateProductSchema({ ...product, finalPriceToman: 75000 });
 assert.equal(discounted.offers.price, '750000');
 assert.deepEqual({ ...discounted.offers, price: original.offers.price }, original.offers);
 assert.equal(generateProductSchema({ ...product, finalPriceToman: 0 }).offers.price, '0');
 assert.equal(original.offers.price, '1000000');
});
test('breadcrumb follows actual sport/category/brand/series routes with optional series', () => {
 const items = generateBreadcrumbSchema(product).itemListElement;
 assert.deepEqual(items.map(x => new URL(x.item).pathname), ['/', '/tennis', '/tennis/racket', '/tennis/racket/wilson', '/tennis/wilson/blade', '/products/blade-98']);
 assert.equal(generateBreadcrumbSchema({ ...product, serie: null }).itemListElement.length, 5);
 assert.deepEqual(items.map(x => x.position), [1,2,3,4,5,6]);
});
test('pagination rejects invalid numbers and canonicalizes each real page', () => {
 for(const value of [undefined, '-1', '0', '1.5', 'Infinity', 'foo', '999999999999999999999']) assert.equal(listingPage(value), 1);
 assert.equal(listingPage('2'), 2);
 assert.equal(listingCanonical('/tennis/racket', '2'), '/tennis/racket?page=2');
 assert.equal(listingCanonical('/tennis/racket', 1), '/tennis/racket');
});
test('robots permits only page-only query URLs while keeping parameter combinations blocked', () => {
 const rule = robots().rules[0];
 const match = (pattern, url) => new RegExp('^' + pattern.split('*').map(s => s.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*')).test(url);
 const allowed = url => { const entries = [...rule.allow.map(p => [p,true]), ...rule.disallow.map(p => [p,false])].filter(([p]) => match(p,url)).sort((a,b) => b[0].replace(/\*/g,'').length-a[0].replace(/\*/g,'').length || Number(b[1])-Number(a[1]));return entries[0]?.[1] ?? true; };
 assert.equal(allowed('/tennis/racket?page=2'), true);
 assert.equal(allowed('/tennis/racket?page=2&brand=wilson'), false);
 assert.equal(allowed('/tennis/racket?brand=wilson&page=2'), false);
 assert.equal(allowed('/api/private?page=2'), false);
});
