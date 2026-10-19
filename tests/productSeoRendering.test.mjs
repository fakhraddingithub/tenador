import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const load = (path, mocks) => {
 const code = transformSync(readFileSync(new URL('../'+path, import.meta.url),'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } }).code;
 const module = { exports: {} };
 new Function('require','module','exports',code)(id => id in mocks ? mocks[id] : require(id),module,module.exports);
 return module.exports.default;
};
const motion = new Proxy({}, { get: (_,tag) => ({children, initial, animate, exit, transition, layoutId, ...props}) => React.createElement(tag,props,children) });
test('initial product HTML contains technical values and custom technology text without mounting the review form', () => {
 const Tabs = load('src/components/templates/product/ProductTabs.jsx', {
  'framer-motion': { motion, AnimatePresence: ({children}) => children },
  './ProductDescription': ({description}) => React.createElement('p',null,description),
  './ProductAttributesTable': ({attributes,active}) => React.createElement('dl',{'data-active':String(active)},attributes.map(x=>React.createElement('dd',{key:x.label},`${x.label}: ${x.value}`))),
  './ProductReviews': () => React.createElement('p',null,'reviews'),
  '@/components/reviews/ReviewForm': () => { throw Error('Review form mounted before interaction'); },
  './MobileProductTabs': { default: () => null, useMobileProductLayout: () => false },
 });
 const html = renderToStaticMarkup(React.createElement(Tabs,{ description:'Blade description', attributes:[{label:'وزن',value:'305 گرم'}],customTab:{enabled:true,name:'Technology',items:[{_id:'tech',title:'FORTYFIVE',description:'Specific frame technology'}]},customTabItemIds:['tech'] }));
 assert.match(html,/305 گرم/); assert.match(html,/Specific frame technology/); assert.match(html,/hidden=""/); assert.match(html,/data-active="false"/);
});
test('page two SSR contains its own products and crawlable adjacent links', () => {
 const List = load('src/components/templates/products/ProductList.js', {
  'next/navigation': { usePathname: () => '/tennis/racket', useSearchParams: () => new URLSearchParams('page=2') },
  '@/lib/seo/listingPagination': { listingPage: v => Number(v)||1 },
  '@/components/modules/cart/ProductCard': ({product}) => React.createElement('a',{href:'/products/'+product.slug},product.name),
  '@/components/modules/cart/QuickViewModal': () => null,
  '@/components/templates/sports/ProductCardSkeleton': { ProductCardSkeleton: () => React.createElement('div',null,'skeleton') },
 });
 const products=Array.from({length:20},(_,i)=>({_id:String(i+20),slug:'racket-'+(i+20),name:'Racket '+(i+20)}));
 const html=renderToStaticMarkup(React.createElement(List,{products,loadedOffset:20,totalResults:60}));
 assert.match(html,/Racket 20/); assert.doesNotMatch(html,/Racket 0</); assert.match(html,/href="\/tennis\/racket\?page=3"/); assert.match(html,/href="\/tennis\/racket"/); assert.match(html,/aria-current="page"/);
});
test('deferred loading preserves the requested page until a complete ordered list is available', async () => {
 const state=[]; let effect; let scheduled; let index=0;
 const hook=load('src/hooks/useDeferredProducts.js',{'react':{useState: initial=>{const slot=index++; state[slot]=initial;return [initial,v=>{state[slot]=typeof v==='function'?v(state[slot]):v;}];},useMemo:fn=>fn(),useEffect:fn=>{effect=fn;}}});
 const oldWindow=globalThis.window, oldFetch=globalThis.fetch;
 const initial=Array.from({length:20},(_,i)=>({_id:String(i+20)}));
 try {
  globalThis.window={setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{}};
  globalThis.fetch=async url=>{const offset=Number(new URL(url,'https://example.test').searchParams.get('offset'));return {ok:true,json:async()=>({products:Array.from({length:Math.min(60,80-offset)},(_,i)=>({_id:String(offset+i)}))})};};
  const result=hook(initial,80,{},20);
  assert.equal(result.loadedOffset,20); assert.deepEqual(result.products,initial);
  const cleanup=effect(); await scheduled();
  assert.equal(state[0],0);assert.equal(state[1].length,80);assert.deepEqual(state[1].map(x=>x._id),Array.from({length:80},(_,i)=>String(i)));assert.equal(state[2],false);cleanup();
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('mobile accordion keeps technical text mounted while its panel is closed', () => {
 const Mobile=load('src/components/templates/product/MobileProductTabs.jsx',{
  'framer-motion':{motion,AnimatePresence:({children})=>children,useReducedMotion:()=>true},
  './MobileProductTabs.module.css':{},
 });
 const html=renderToStaticMarkup(React.createElement(Mobile,{tabs:[{id:'description',label:'توضیحات'},{id:'attributes',label:'مشخصات'}],keepMounted:['description','attributes'],renderContent:(id,active)=>React.createElement('p',null,id==='attributes'?'وزن 305 گرم':'description')}));
 assert.match(html,/وزن 305 گرم/);assert.match(html,/aria-expanded="false"/);assert.match(html,/aria-hidden="true"/);
});
test('nested taxonomy route forwards its server pagination offset to the client list', () => {
 const source=readFileSync(new URL('../src/app/(Site)/(sports)/[sportSlug]/[...slug]/page.jsx',import.meta.url),'utf8');
 assert.match(source,/queryBySlugs\(slugs, ctx, \{ targetAudience, offset: \(page - 1\) \* 20 \}\)/);
 assert.match(source,/<SportPageClient\s+initialOffset=\{\(page - 1\) \* 20\}/);
});
