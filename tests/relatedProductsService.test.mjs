import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import * as ranking from "../src/lib/relatedProducts.js";

async function loadService(source, candidates = [], details = [], fail = false, complements = [], series = []) {
  const calls = [];
  const chain = (value) => {
    const query = {};
    for (const method of ["select", "populate", "sort"]) {
      query[method] = (...args) => { calls.push([method, ...args]); return query; };
    }
    query.lean = async () => { if (fail) throw new Error("DB unavailable"); return value; };
    return query;
  };
  const deps = {
    "base/models/registerModels": {},
    "next/cache": { unstable_cache: (fn, key, options) => { calls.push(["cache", key, options]); return fn; } },
    "base/configs/db": { default: async () => {} },
    "base/models/Product": { default: {
      findOne: (filter) => { calls.push(["source", filter]); return chain(source); },
      find: (filter) => {
        calls.push(["find", filter]);
        return chain(filter._id.$in ? details : filter.brand ? complements : candidates);
      },
    } },
    "base/models/Serie": { default: { find: (filter) => { calls.push(["series", filter]); return chain(series); } } },
    "@/lib/relatedProducts": ranking,
    "base/services/priceEngine": { attachListingPrices: async (products, rate) => {
      calls.push(["prices", products, rate]);
      return products.map((p) => ({ ...p, finalPriceToman: p.basePrice * rate }));
    } },
  };
  const context = vm.createContext({ console });
  const module = new vm.SourceTextModule(await readFile(new URL("../services/relatedProducts.service.js", import.meta.url), "utf8"), { context });
  await module.link((name) => {
    assert.ok(deps[name], `Unexpected dependency: ${name}`);
    return new vm.SyntheticModule(Object.keys(deps[name]), function () {
      for (const [key, value] of Object.entries(deps[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { run: module.namespace.getRelatedProducts, calls };
}

test("service scopes technical candidates, excludes inactive/current products, preserves rank after hydration and prices in EUR", async () => {
  const source = { _id: "source", category: { _id: "cat", technicalStats: [{ name: "power", min: 0, max: 100 }] }, technicalStats: { power: 60 } };
  const near = { _id: "near", technicalStats: { power: 61 } };
  const far = { _id: "far", technicalStats: { power: 90 } };
  const { run, calls } = await loadService(source, [far, near], [
    { ...far, basePrice: 200, variants: [{ price: 210 }] },
    { ...near, basePrice: 100, variants: [{ price: 110 }] },
  ]);
  const result = await run("source", 50000);
  assert.deepEqual(Array.from(result.products, (p) => p._id), ["near", "far"]);
  assert.equal(result.products[0].basePrice, 100);
  assert.equal(result.products[0].variants[0].price, 110);
  assert.equal(result.products[0].finalPriceToman, 5000000);
  const filter = calls.find(([kind]) => kind === "find")[1];
  assert.equal(filter.category, "cat");
  assert.equal(filter.isActive, true);
  assert.equal(filter._id.$ne, "source");
  assert.equal(filter.slug.$type, "string");
  assert.deepEqual(calls.filter(([kind]) => kind === "populate").map((entry) => entry[1]), ["category", "serie", "brand", "category", "variants"]);
  const options = calls.find(([kind]) => kind === "cache")[2];
  assert.ok(options.tags.includes("products") && options.tags.includes("categories") && options.tags.includes("series"));
});

test("tag fallback searches tagged products across categories and hydrates only selected ids", async () => {
  const { run, calls } = await loadService({ _id: "source", tag: ["tennis"] }, [
    { _id: "match", tag: ["tennis"] }, { _id: "unrelated", tag: ["padel"] },
  ], [{ _id: "match", basePrice: 100 }]);
  const result = await run("source", 10);
  assert.equal(result.mode, "tags");
  const queries = calls.filter(([kind]) => kind === "find");
  assert.equal(queries[0][1].category, undefined);
  assert.equal(queries[0][1]["tag.0"].$exists, true);
  assert.deepEqual(Array.from(queries[1][1]._id.$in), ["match"]);
});

test("missing source or matching data skips catalog scan and pricing", async () => {
  for (const source of [null, { _id: "source", technicalStats: {}, tag: [] }]) {
    const { run, calls } = await loadService(source);
    assert.equal((await run("source", 10)).products.length, 0);
    assert.ok(!calls.some(([kind]) => kind === "find" || kind === "prices"));
  }
});

test("DB failures reject rather than becoming cached empty recommendations", async () => {
  const { run } = await loadService(null, [], [], true);
  await assert.rejects(run("source", 10), /DB unavailable/);
});

test("service returns 3 matches then 5 diverse complements, enforcing sport/brand and hydrating in rank order", async () => {
  const source = { _id: "source", category: { _id: "rackets" }, tag: ["tennis"],
    brand: "wilson", sport: "tennis", serie: { _id: "blade", brand: "wilson" } };
  const similar = Array.from({ length: 8 }, (_, i) => ({ _id: `match${i}`, tag: ["tennis"] }));
  const complements = ["bags", "bags", "bags", "strings", "dampers", "grips"].map((category, i) => ({
    _id: `extra${i}`, category, serie: "blade", brand: "wilson", sport: "tennis",
  }));
  const details = [...complements, ...similar].reverse().map((p) => ({ ...p, basePrice: 10 }));
  const { run, calls } = await loadService(source, similar, details, false, complements, [{ _id: "blade" }]);
  const result = await run("source", 10);
  assert.deepEqual(Array.from(result.products, (p) => p._id),
    ["match0", "match1", "match2", "extra0", "extra3", "extra4", "extra5", "extra1"]);
  const filter = calls.find(([kind, filter]) => kind === "find" && filter.brand)[1];
  assert.equal(filter.brand, "wilson");
  assert.equal(filter.sport, "tennis");
  assert.equal(filter.category.$ne, "rackets");
  assert.equal(filter.isActive, true);
  assert.equal(calls.find(([kind]) => kind === "series")[1].brand, "wilson");
});

test("missing technical stats AND tags still returns complements from the series owner's brand", async () => {
  const source = { _id: "source", category: { _id: "rackets" }, brand: "legacy-brand", sport: "tennis",
    serie: { _id: "blade", brand: "wilson" } };
  const complement = { _id: "bag", category: "bags", brand: "wilson", sport: "tennis", serie: "blade", basePrice: 10 };
  const { run, calls } = await loadService(source, [], [complement], false, [complement], [{ _id: "blade" }]);
  assert.deepEqual(Array.from((await run("source", 10)).products, (p) => p._id), ["bag"]);
  assert.equal(calls.find(([kind]) => kind === "find")[1].brand, "wilson");
});
