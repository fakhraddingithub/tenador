/**
 * tests/cdnPurge.test.mjs
 *
 * The storefront showed an old mini article after a correct admin save: pages
 * under /[sport]/… are cached for an hour at Vercel's CDN, and being
 * force-dynamic they carry no Next path tags, so nothing could purge them.
 * They now carry one constant tag and every mini-article write purges it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFile } from "node:fs/promises";

register("./aliasHooks.mjs", import.meta.url);
// Next's bundler resolves the extensionless "next/cache"; bare Node ESM does not.
register("data:text/javascript,export async function resolve(s,c,n){return n(s==='next/cache'?'next/cache.js':s,c)}");

const { SPORT_PAGES_CDN_TAG } = await import("../src/lib/cdnCacheTags.js");
const { purgeSportPagesCdn } = await import("@/lib/revalidate");

// @vercel/functions reads the platform's purge API from this global request context.
const CONTEXT = Symbol.for("@vercel/request-context");
const withPurgeApi = async (purge, fn) => {
  globalThis[CONTEXT] = { get: () => ({ purge }) };
  try { return await fn(); } finally { delete globalThis[CONTEXT]; }
};

test("purge deletes exactly the sport-pages tag on Vercel", async () => {
  const calls = [];
  await withPurgeApi({ dangerouslyDeleteByTag: async (tag, options) => { calls.push([tag, options]); } }, purgeSportPagesCdn);
  assert.deepEqual(calls, [[SPORT_PAGES_CDN_TAG, undefined]]);
});

test("purge never fails the admin write: outside Vercel it is a no-op, and API errors are swallowed", async () => {
  await purgeSportPagesCdn(); // no request context at all
  await withPurgeApi({ dangerouslyDeleteByTag: async () => { throw new Error("purge API down"); } }, purgeSportPagesCdn);
});

test("every CDN-cached sport page carries the tag; the tag is plain ASCII", async () => {
  const { default: config } = await import("../next.config.mjs");
  const rules = await config.headers();
  const tagOf = (rule) => rule.headers.find((h) => h.key === "Vercel-Cache-Tag")?.value;
  const cached = rules.filter((rule) => rule.headers.some((h) => h.key === "Vercel-CDN-Cache-Control"));
  const sportRules = cached.filter((rule) => rule.source.startsWith("/:sport("));
  assert.equal(sportRules.length, 2);
  for (const rule of sportRules) assert.equal(tagOf(rule), SPORT_PAGES_CDN_TAG, rule.source);
  assert.match(SPORT_PAGES_CDN_TAG, /^[a-z0-9-]+$/, "a non-ASCII header value crashes Node (ERR_INVALID_CHAR)");
});

test("every write that changes a sport-page mini article awaits the purge", async () => {
  const src = (path) => readFile(new URL(`../src/app/api/${path}`, import.meta.url), "utf8");
  const expectations = {
    "brands/[brandId]/route.js": /await brand\.save\(\);[\s\S]*if \(categoryArticles !== undefined\) await purgeSportPagesCdn\(\);/,
    "brands/create/route.js": /if \(sanitizedCategoryArticles\.length > 0\) await purgeSportPagesCdn\(\);/,
    "series/[id]/route.js": /await serie\.save\(\);[\s\S]*if \(body\.articleBlocks !== undefined\) await purgeSportPagesCdn\(\);/,
    "series/create/route.js": /if \(sanitizedArticleBlocks\.length > 0\) await purgeSportPagesCdn\(\);/,
    "categories/[categoryId]/route.js": /deleteCategoryWithProducts\([\s\S]*await purgeSportPagesCdn\(\);/,
  };
  for (const [path, pattern] of Object.entries(expectations)) assert.match(await src(path), pattern, path);
});
