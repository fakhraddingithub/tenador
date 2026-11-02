import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, mocks, observer) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'IntersectionObserver', code)(id => id in mocks
    ? { __esModule: true, ...mocks[id] } : require(id), module, module.exports, observer);
  return module.exports.default;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const effects = [], calls = [], refs = [];
  let intersection;
  const listeners = new Map(), navigation = new Map();
  const element = {
    closest: () => ({ querySelector: selector => ({ addEventListener: (_, fn) => navigation.set(selector, fn), removeEventListener: () => {} }) }),
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type),
  };
  class Observer {
    constructor(callback) { intersection = callback; }
    observe() { calls.push('observe'); }
    disconnect() { calls.push('disconnect'); }
  }
  class Swiper {
    constructor(target, options) { assert.equal(target, element); calls.push('initialize'); assert.equal(options.speed, 300); }
    slideNext() { calls.push('next'); }
    slidePrev() { calls.push('previous'); }
    destroy() { calls.push('destroy'); }
  }
  const Component = load('src/components/features/bestSellers/DeferredProductSwiper.jsx', {
    react: { useRef: value => { const ref = { current: refs.length ? value : element }; refs.push(ref); return ref; }, useEffect: fn => effects.push(fn) },
    swiper: { get default() { calls.push('load'); return Swiper; } },
    'swiper/modules': { Navigation: {}, Autoplay: {}, Pagination: {} },
  }, Observer);
  const tree = Component({ children: React.createElement('a', { href: '/products/test' }, 'product'), speed: 300,
    navigation: { nextEl: '.next', prevEl: '.previous' }, pagination: { el: '.pages' } });
  effects[0]();
  effects[1]();
  const cleanup = effects[2]();
  return { calls, tree, cleanup, navigation, listeners, intersect: () => intersection([{ isIntersecting: true }]) };
}

test('SSR cards remain available; Swiper loads only near the viewport and only once', async () => {
  const h = harness();
  assert.match(renderToStaticMarkup(h.tree), /href="\/products\/test"/);
  assert.deepEqual(h.calls, ['observe']);
  h.intersect(); h.intersect();
  await tick();
  assert.equal(h.calls.filter(x => x === 'initialize').length, 1);
  h.cleanup();
  assert.ok(h.calls.includes('destroy'));
  assert.equal(h.listeners.size, 0);
});

test('navigation pressed during loading is applied after initialization', async () => {
  const h = harness();
  h.navigation.get('.next')();
  await tick();
  assert.ok(h.calls.indexOf('next') > h.calls.indexOf('initialize'));
  h.cleanup();
});

test('leaving the page during chunk loading prevents late initialization', async () => {
  const h = harness();
  h.intersect(); h.cleanup();
  await tick();
  assert.ok(!h.calls.includes('initialize'));
});

test('closed quick view does not request the modal module', async () => {
  const effects = [];
  const Component = load('src/components/modules/cart/LazyQuickViewModal.jsx', {
    react: { useEffect: fn => effects.push(fn), useState: value => [value, () => {}] },
    './QuickViewModal': { get default() { throw Error('Closed modal was loaded'); } },
  });
  assert.equal(Component({ isOpen: false }), null);
  effects.forEach(fn => fn());
  await tick();
});

test('opening quick view loads the real modal with the selected product', async () => {
  const states = [], effects = [];
  let cursor = 0, loads = 0;
  const Component = load('src/components/modules/cart/LazyQuickViewModal.jsx', {
    react: { useEffect: fn => effects.push(fn), useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    } },
    './QuickViewModal': { get default() { loads++; return ({ product }) => React.createElement('div', null, product.name); } },
  });
  const props = { isOpen: true, product: { name: 'selected product' }, onClose() {} };
  const pending = renderToStaticMarkup(Component(props));
  assert.match(pending, /role="dialog"/);
  assert.match(pending, /بستن/);
  effects.forEach(fn => fn());
  await tick();
  cursor = 0;
  assert.match(renderToStaticMarkup(Component(props)), /selected product/);
  assert.equal(loads, 1);
});

test('related slider renders all cards on the server without running eager Swiper', () => {
  const Slider = load('src/components/features/bestSellers/ProductSliderContent.jsx', {
    'next/dynamic': { default: () => () => { throw Error('Eager slider mounted'); } },
    './DeferredProductSwiper': { default: ({ children }) => React.createElement('div', null, children) },
    '@/components/modules/cart/ProductCard': { default: ({ product }) => React.createElement('a', { href: '/products/' + product.slug }, product.name) },
    '@/components/modules/cart/LazyQuickViewModal': { default: () => null },
    '@/components/templates/secondHands/UsedProductCard': { default: () => null },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/features/home/HomeSectionHeading': { default: ({ title }) => React.createElement('h2', null, title) },
    '@/components/features/home/HomeSliderNav': { default: () => null },
    '@/lib/homeSlider': { HOME_SLIDER_SPEED: 300, HOME_SLIDER_AUTOPLAY: { delay: 5000 } },
    '@/lib/homeBannerTexts': { PRODUCT_SLIDER_TEXT: {} },
  });
  const html = renderToStaticMarkup(React.createElement(Slider, { deferActivation: true, isolated: true, title: 'related',
    products: [{ _id: 'a', slug: 'a', name: 'A' }, { _id: 'b', slug: 'b', name: 'B' }] }));
  assert.match(html, /href="\/products\/a"/);
  assert.match(html, /href="\/products\/b"/);
});
