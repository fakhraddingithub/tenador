import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function load(path, mocks = {}) {
  const code = transformSync(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), module, module.exports);
  return module.exports.default;
}
const Link = ({ children, ...props }) => React.createElement('a', props, children);
const Card = load('src/components/modules/cart/ProductCard.js', {
  'next/link': Link,
  'next/image': ({ fill, ...props }) => React.createElement('img', props),
  '@/lib/variantImages': { valueImageSwatches: () => [] },
  '@/hooks/useWishlist': () => ({ isWishlisted: false, toggle() {}, isLoading: false }),
  './ProductCardTitle': ({ name, slug }) => React.createElement('a', { href: '/products/' + slug }, name),
});

test('product card navigation is named and never nests a button inside a link', () => {
  const html = renderToStaticMarkup(React.createElement(Card, {
    product: { name: 'راکت تست', slug: 'test', mainImage: '/test.jpg', basePriceToman: 1000, label: 'new' },
    onQuickView() {},
  }));
  assert.match(html, /aria-label="راکت تست"/);
  assert.match(html, /<a[^>]*href="\/products\/test"[^>]*aria-label="صفحه محصول"/);
  for (const link of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) assert.doesNotMatch(link[1], /<button\b/);
  assert.match(html, /<button[^>]*aria-label="نمایش سریع"/);
  assert.match(html, /<button[^>]*aria-label="افزودن به علاقه مندی"/);
  assert.equal((html.match(/h-6 w-6 -m-\[3px\]/g) || []).length, 3);
});

test('WhatsApp has an accessible name without additional visible text', () => {
  const Support = load('src/components/features/WhatsAppSupport/WhatsAppSupport.jsx');
  const html = renderToStaticMarkup(React.createElement(Support));
  assert.match(html, /aria-label="ارتباط با پشتیبانی در واتساپ"/);
  assert.match(html, /w-14 h-14/);
});

test('share heading keeps its presentation with a valid section level', () => {
  const Share = load('src/components/templates/product/ProductShare.jsx');
  const html = renderToStaticMarkup(React.createElement(Share));
  assert.match(html, /<h2 class="text-sm font-bold text-gray-800 mb-1">اشتراک‌گذاری محصول<\/h2>/);
});

function luminance(hex) {
  const c = hex.match(/\w\w/g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
test('replacement text colors exceed 4.5:1 against the report backgrounds', () => {
  for (const [foreground, background] of [['ffffff', '008368'], ['9da5b3', '36393f'], ['6a7282', 'ffffff'], ['e6a18a', '36393f']]) {
    const a = luminance(foreground), b = luminance(background);
    assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, foreground);
  }
});
