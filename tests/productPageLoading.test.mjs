import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup, renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";
import { eurToToman } from "../src/lib/currency.js";
import * as variantImages from "../src/lib/variantImages.js";
import nextConfig from "../next.config.mjs";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in dependencies) return { __esModule: true, ...dependencies[name] };
    if (["react", "react/jsx-runtime", "framer-motion", "react-icons/fi"].includes(name)) return require(name);
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

test("early image preload matches the gallery source and responsive candidates", () => {
  const { PRODUCT_IMAGE_SIZES } = load("src/lib/productImageSizing.js", {});
  const previousEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/test";
  const { default: loader } = load("src/lib/imagekitLoader.js", {});
  if (previousEndpoint === undefined) delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  else process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = previousEndpoint;
  const { getImageProps } = require("next/image");
  const hints = [];
  const { preloadProductImage } = load("src/lib/productImageHints.js", {
    "next/image": { getImageProps }, "react-dom": { preload: (...args) => hints.push(args) },
    "./imagekitLoader": { default: loader }, "./variantImages": variantImages,
    "./productImageSizing": { PRODUCT_IMAGE_SIZES },
  });
  const product = { mainImage: "https://ik.imagekit.io/test/main.webp", gallery: ["https://ik.imagekit.io/test/gallery.webp"],
    variants: [{ images: ["https://ik.imagekit.io/test/variant.webp"] }] };
  preloadProductImage(product);
  const src = variantImages.buildGalleryImages(product)[0];
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: PRODUCT_IMAGE_SIZES, loader });
  assert.match(props.srcSet, /tr=w-\d+/);
  assert.deepEqual(hints, [[props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high" }]]);
  preloadProductImage({});
  assert.equal(hints.length, 1);
});

test("product response hints preload local fonts without enabling shared price caching", async () => {
  const rule = (await nextConfig.headers()).find(rule => rule.source === "/products/:productSlug");
  assert.equal(rule.headers.length, 1);
  assert.equal(rule.headers[0].key, "Link");
  for (const font of ["Regular", "Bold"]) {
    assert.ok(rule.headers[0].value.includes(`/fonts/invoice/Vazirmatn-${font}.woff2`));
  }
  assert.equal((rule.headers[0].value.match(/crossorigin=anonymous/g) || []).length, 2);
  assert.ok(rule.headers[0].value.includes("/logo/logo.svg"));
});

test("display pricing preserves API variant fallback, rounding, discounts and tier order", async () => {
  const user = { role: "coach" };
  const product = { _id: "p", basePrice: 100, variants: [
    { _id: "v1", price: 123.45, sku: "SKU" }, { _id: "v2", price: 0 },
  ] };
  const qd = { title: "bulk", tiers: [
    { minQty: 5, discount: { kind: "fixed", value: 5000 } },
    { minQty: 2, discount: { kind: "percent", value: 3 } },
  ] };
  const result = { basePriceToman: 10000000, finalPriceToman: 8500000,
    discountPercent: 15, discountAmount: 1500000, appliedRules: [{ id: "role" }] };
  let calls = 0;
  const { getProductDisplayPrice } = load("services/productDisplayPrice.service.js", {
    "base/models/registerModels": {}, "base/configs/db": { default: async () => {} },
    "@/lib/currency": { eurToToman },
    "base/services/priceEngine": {
      computeProductPrice: async (p, r, u) => { calls++; assert.equal(p, product); assert.equal(u, user); assert.equal(r, 100000); return result; },
      loadQuantityDiscountMap: async () => new Map([["p", qd]]),
    },
  });
  const actual = await getProductDisplayPrice(product, 100000, user);
  assert.equal(actual.finalPriceToman, 8500000);
  assert.equal(actual.variants[0].basePriceToman, 12345000);
  assert.equal(actual.variants[0].finalPriceToman, 10493250);
  assert.equal(actual.variants[1].finalPriceToman, 8500000);
  assert.deepEqual(actual.quantityDiscount.tiers.map(t => t.minQty), [2, 5]);
  assert.deepEqual(qd.tiers.map(t => t.minQty), [5, 2]);
  for (const rate of [0, null, -1, NaN, Infinity]) await assert.rejects(getProductDisplayPrice(product, rate, user));
  assert.equal(calls, 1, "invalid rates must not reach price computation");
});

function pageHarness({ product, rate, reviews, pricing, user = null }) {
  const calls = [];
  // Scope this mock dispatcher to one request, like React's server cache.
  const cache = fn => { const results = new Map(); return key => {
    if (!results.has(key)) results.set(key, fn(key)); return results.get(key);
  }; };
  const api = load("src/lib/productPageData.js", {
    "./productImageHints": { preloadProductImage: () => { calls.push("imageHint"); } },
    "./serverTiming": { timed: (name, work) => work() },
    "base/utils/articleSlug": { decodeSlugParam: (value) => decodeURIComponent(value) },
    react: { cache },
    "next/headers": { cookies: async () => ({ get: () => user ? { value: "token" } : undefined }) },
    "base/utils/auth": { verifyToken: () => user },
    "base/services/product.service": { getProductBySlug: () => { calls.push("product"); return product; } },
    "base/services/comment.service": { getApprovedReviews: () => { calls.push("reviews"); return reviews; } },
    "base/services/priceEngine": { getRate: () => { calls.push("rate"); return rate; } },
    "base/services/productDisplayPrice.service": { getProductDisplayPrice: async (p, r, u) => {
      calls.push("pricing"); assert.equal(u, user); assert.equal(r, 100000); return pricing;
    } },
  });
  return { ...api, calls };
}

test("product and rate overlap; metadata shares product; pending reviews do not block priced page", async () => {
  const product = deferred(), rate = deferred(), reviews = deferred(), pricing = deferred();
  const api = pageHarness({ product: product.promise, rate: rate.promise, reviews: reviews.promise, pricing: pricing.promise });
  const metadataProduct = api.getProductForPage("slug");
  let finished = false;
  const page = api.getProductPageData("slug").then(value => { finished = true; return value; });
  assert.deepEqual(api.calls, ["product", "rate"]);
  product.resolve({ _id: "p" }); rate.resolve(100000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false, "must not show an unpriced buy box");
  assert.ok(api.calls.indexOf("imageHint") < api.calls.indexOf("pricing"), "image must be hinted before pricing completes");
  assert.ok(api.calls.includes("reviews"));
  pricing.resolve({ finalPriceToman: 8500000 });
  const result = await page;
  assert.equal(result.product, await metadataProduct);
  assert.equal(result.pricing.finalPriceToman, 8500000);
  reviews.resolve({ reviews: [], stats: { count: 0 } });
  assert.deepEqual(await result.reviewsPromise, { data: { reviews: [], stats: { count: 0 } } });
  assert.equal(api.calls.filter(c => c === "product").length, 1);
  assert.equal(api.calls.filter(c => c === "imageHint").length, 1);
});

test("a Persian slug in either encoding reads the product once", async () => {
  const api = pageHarness({ product: Promise.resolve({ _id: "p" }), rate: 100000, reviews: Promise.resolve({ reviews: [] }), pricing: {} });
  const decoded = "راکت-تست";
  assert.equal(await api.getProductForPage(decoded), await api.getProductForPage(encodeURIComponent(decoded)));
  assert.equal(api.calls.filter((c) => c === "product").length, 1);
});

test("server timing records each step without changing start order or rejections", async () => {
  let store;
  const { timed, readServerTiming } = load("src/lib/serverTiming.js", {
    react: { cache: (fn) => () => (store ??= fn()) },
    mongoose: { default: { connection: { readyState: 0 } } },
  });
  let started = false;
  const ok = timed("ok", () => { started = true; return Promise.resolve("value"); });
  assert.equal(started, true, "work must start synchronously");
  assert.equal(await ok, "value");
  await assert.rejects(timed("bad", () => Promise.reject(new Error("db down"))), /db down/);
  assert.equal(await timed("sync", () => "plain"), "plain");
  await new Promise((resolve) => setImmediate(resolve));
  const output = readServerTiming();
  assert.deepEqual(Object.keys(output.steps).sort(), ["bad", "ok", "sync"]);
  await timed("ok", () => "again");
  assert.ok(readServerTiming().steps["ok#2"], "a duplicate read must stay visible");
  assert.equal(output.dbAtStart, 0);
  assert.equal(typeof output.steps.ok.ms, "number");
  assert.equal(typeof output.totalMs, "number");
  assert.doesNotThrow(() => JSON.stringify(output));
});

test("pricing failure rejects the page rather than showing zero or an undiscounted fallback", async () => {
  const pricing = deferred();
  const api = pageHarness({ product: Promise.resolve({ _id: "p" }), rate: 100000, reviews: Promise.resolve({ reviews: [] }), pricing: pricing.promise });
  const page = api.getProductPageData("slug");
  pricing.reject(new Error("price unavailable"));
  await assert.rejects(page, /price unavailable/);
});

test("missing product remains a 404 result when rate loading fails", async () => {
  const api = pageHarness({ product: Promise.resolve({ error: "not found", status: 404 }),
    rate: Promise.reject(new Error("rate unavailable")), reviews: null, pricing: null });
  assert.equal((await api.getProductPageData("missing")).product.status, 404);
  assert.equal(api.calls.includes("pricing"), false);
});

test("the first buy-box HTML already contains final product and variant prices", () => {
  const empty = { default: () => null };
  const { default: ProductInfo } = load("src/components/templates/product/ProductInfo.jsx", {
    "next/link": { default: ({ children }) => React.createElement("a", null, children) },
    "./ProductHeader": empty, "./ProductPrice": { default: ({ basePrice }) => React.createElement("span", null, basePrice.toLocaleString("fa-IR")) },
    "./AddToCartButton": empty, "./WishlistButton": empty, "./VariantSelector": empty,
    "@/components/modules/orderFlow/useOrderFlowCart": { useOrderFlowCart: () => ({ requestAddToCart() {}, flowModal: null }) },
    "@/lib/flyToCart": { flyToCart() {} }, "@/lib/variantImages": variantImages,
  });
  const product = { _id: "p", basePrice: 10000000, category: {}, variants: [{ _id: "v", price: 12000000 }],
    displayPrice: { basePriceToman: 10000000, finalPriceToman: 8500000, discountPercent: 15,
      variants: [{ _id: "v", basePriceToman: 12000000, finalPriceToman: 10200000, discountPercent: 15 }],
      quantityDiscount: { tiers: [{ minQty: 2, kind: "percent", value: 3 }] },
    },
  };
  const render = (selectedVariant = null) => renderToStaticMarkup(React.createElement(ProductInfo, { product, selectedVariant }));
  assert.ok(render().includes((8500000).toLocaleString("fa-IR")));
  assert.ok(render(product.variants[0]).includes((10200000).toLocaleString("fa-IR")));
  assert.ok(render().includes("15"));
  assert.throws(() => renderToStaticMarkup(React.createElement(ProductInfo, { product: { ...product, displayPrice: null } })), /قیمت محصول آماده نیست/);
});

test("review and schema streaming retain approved counts and public price without blocking shell", async () => {
  const reviews = deferred();
  const { ProductReviewCount, ProductSchemaWithReviews } = load("src/components/templates/product/DeferredProductReviews.jsx", {
    "./ProductReviews": { default: () => null }, "@/components/reviews/ReviewForm": { default: () => null },
    "@/lib/seo/productSchema": { generateProductSchema: (product, stats) => ({ price: product.finalPriceToman, count: stats?.count }) },
  });
  let shell = "";
  const output = new PassThrough(); output.on("data", chunk => { shell += chunk.toString(); });
  const done = new Promise(resolve => output.on("end", resolve));
  const tree = React.createElement("main", null, React.createElement("div", null, "priced product"),
    React.createElement(React.Suspense, { fallback: null }, React.createElement(ProductReviewCount, { reviewsPromise: reviews.promise })),
    React.createElement(React.Suspense, { fallback: null }, React.createElement(ProductSchemaWithReviews, {
      product: { finalPriceToman: 80 }, publicPricePromise: Promise.resolve({ finalPriceToman: 100 }), reviewsPromise: reviews.promise,
    })));
  const stream = renderToPipeableStream(tree, { onShellReady() { stream.pipe(output); } });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(shell, /priced product/);
  assert.doesNotMatch(shell, /"price"/);
  reviews.resolve({ data: { reviews: [], stats: { count: 5 } } });
  await done;
  assert.match(shell, /"price":100,"count":5/);
  assert.doesNotMatch(shell, /"price":80/);
});

test("related slider CSS stays byte-identical to installed Swiper and markup keeps its styles", () => {
  const { productSliderStyles } = load("src/components/templates/product/productSliderStyles.js", {});
  const expected = readFileSync(new URL("../node_modules/swiper/swiper.css", import.meta.url), "utf8") + "\n" +
    readFileSync(new URL("../node_modules/swiper/modules/pagination.css", import.meta.url), "utf8");
  assert.equal(productSliderStyles, expected);
  const renderer = readFileSync(new URL("../src/components/features/bestSellers/ProductSliderContent.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(renderer, /import ["']swiper\/css/);
  const html = renderToStaticMarkup(React.createElement("style", null, productSliderStyles));
  assert.match(html, /\.swiper-wrapper/);
  assert.match(html, /\.swiper-pagination-bullet/);
});
