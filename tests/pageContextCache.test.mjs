// The root brand/sport page context is cached across requests, but a URL that resolves to
// nothing must never be: bots hitting arbitrary root paths would otherwise fill the cache.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((id) => ({ __esModule: true, ...(mocks[id] || {}) }), loaded, loaded.exports);
  return loaded.exports;
}

// Stores only what the callback returned, the way Next's data cache does; a throw stores nothing.
function fakeCache() {
  const store = new Map();
  const created = [];
  const unstable_cache = (fn, keyParts, options) => {
    created.push({ keyParts, options });
    return async (...args) => {
      const key = JSON.stringify([keyParts, args]);
      if (store.has(key)) return JSON.parse(store.get(key));
      const value = await fn(...args);
      store.set(key, JSON.stringify(value));
      return value;
    };
  };
  return { store, created, unstable_cache };
}

function harness({ sports = {}, brands = {}, fail = false } = {}) {
  const cache = fakeCache();
  const reads = [];
  const lean = (value) => ({ lean: async () => { if (fail) throw new Error("db down"); return value ?? null; } });
  const api = load("services/query.service.js", {
    "next/cache": { unstable_cache: cache.unstable_cache },
    "base/configs/db": { default: async () => {} },
    "base/models/Sport": { default: { findOne: ({ slug }) => { reads.push(`sport:${slug}`); return lean(sports[slug]); } } },
    "base/models/Brand": { default: { findOne: ({ slug }) => { reads.push(`brand:${slug}`); return { select: () => lean(brands[slug]) }; } } },
  });
  return { ...api, cache, reads };
}

const OPTIONS = { includeBrandStats: false };

test("a found brand is read from the database once, then from the cache", async () => {
  const h = harness({ brands: { wilson: { _id: "b1", slug: "wilson", title: "ویلسون" } } });
  const first = await h.resolvePageContext(["wilson"], OPTIONS);
  const readsAfterFirst = h.reads.length;
  const second = await h.resolvePageContext(["wilson"], OPTIONS);
  assert.equal(first.notFound, false);
  assert.equal(second.filters.brand.title, "ویلسون");
  assert.deepEqual(second, first);
  assert.equal(h.reads.length, readsAfterFirst, "the second visit must not touch the database");
});

test("an unknown root slug answers notFound and leaves nothing in the cache", async () => {
  const h = harness();
  assert.deepEqual(await h.resolvePageContext(["no-such-page"], OPTIONS), { notFound: true });
  assert.deepEqual(await h.resolvePageContext(["no-such-page"], OPTIONS), { notFound: true });
  assert.equal(h.cache.store.size, 0);
  assert.equal(h.reads.filter((r) => r === "sport:no-such-page").length, 2, "each miss is resolved again");
});

test("a database failure is thrown, not cached and not turned into a 404", async () => {
  const h = harness({ fail: true });
  await assert.rejects(h.resolvePageContext(["wilson"], OPTIONS), /db down/);
  assert.equal(h.cache.store.size, 0);
});

test("the context is purged by a save of anything it resolves", () => {
  const h = harness();
  const { options } = h.cache.created.find((c) => c.keyParts?.[0] === "page-context-v1");
  for (const tag of ["sports", "brands", "categories", "series", "limited-editions", "products"]) {
    assert.ok(options.tags.includes(tag), `missing tag ${tag}`);
  }
});

test("public brand and sport pages read block entities through the cache, admin previews do not", () => {
  const page = readFileSync(new URL("../src/app/(Site)/(sports)/[sportSlug]/page.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /resolveArticleEntities/);
  assert.match(page, /getCachedBlockEntities\(brochureBlocks\)/);
  assert.match(page, /getCachedBlockEntities\(sportBrochureBlocks\)/);
  const preview = readFileSync(new URL("../src/components/admin/brochure/BrochurePreview.jsx", import.meta.url), "utf8");
  assert.match(preview, /resolveArticleEntities\(/);
});
