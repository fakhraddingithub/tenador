import { cache, createElement } from "react";
import mongoose from "mongoose";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { tagsManifest } from "next/dist/server/lib/incremental-cache/tags-manifest.external.js";

// A server component cannot set response headers, so the page prints these numbers as JSON
// instead of a Server-Timing header. Durations only: no user or product data.
// ponytail: diagnostic for the product page TTFB, remove once that investigation is done.

// Writes finish after the response, so a request can only report the writes of earlier ones.
// The trace therefore outlives the request, and lives on globalThis because Next bundles this
// module into more than one layer.
const TRACE = Symbol.for("tenador.cacheTrace");
const trace = (globalThis[TRACE] ??= []);

function note(entry) {
  trace.push({ agoFrom: Date.now(), ...entry });
  if (trace.length > 30) trace.shift();
}

const shortKey = (key) => String(key).slice(0, 8);

function tagStates(ctx) {
  const states = {};
  for (const tag of [...(ctx?.tags || []), ...(ctx?.softTags || [])]) {
    const state = tagsManifest.get(tag);
    if (state) states[tag] = state;
  }
  return states;
}

function describeEntry(result) {
  if (!result) return { result: "none" };
  return {
    result: result.isStale ? "stale" : "found",
    ageSec: result.lastModified ? Math.round((Date.now() - result.lastModified) / 1000) : undefined,
    kind: result.value?.kind,
  };
}

// Observes a cache method without changing what it returns or rejects with.
function watch(target, method, op, describe) {
  const original = target[method];
  target[method] = async function watched(...args) {
    const startedAt = performance.now();
    const finish = (details) => note({ op, key: shortKey(args[0]), ms: Math.round(performance.now() - startedAt), ...details });
    try {
      const result = await original.apply(this, args);
      finish(describe(args, result));
      return result;
    } catch (err) {
      finish({ error: err?.name || "error" });
      throw err;
    }
  };
}

const WATCHED = Symbol.for("tenador.cacheWatched");

// A failure here must never reach the page: it reads Next internals that may not exist.
function watchCache() {
  try {
    const workStore = workAsyncStorage.getStore();
    const unit = workUnitAsyncStorage.getStore();
    const incremental = workStore?.incrementalCache;
    if (!incremental) return { available: false };

    const handler = incremental.cacheHandler;
    if (!incremental[WATCHED]) {
      incremental[WATCHED] = true;
      const read = ([, ctx], result) => ({ tags: ctx?.tags, ...describeEntry(result), tagStates: tagStates(ctx) });
      const write = ([, data]) => ({ size: data?.data?.body?.length });
      watch(incremental, "get", "get", read);
      watch(incremental, "set", "set", write);
      if (handler && !handler[WATCHED]) {
        handler[WATCHED] = true;
        watch(handler, "get", "handlerGet", read);
        watch(handler, "set", "handlerSet", write);
      }
    }

    return {
      handler: handler?.constructor?.name || null,
      globalHandlers: Object.keys(globalThis[Symbol.for("@next/cache-handlers")] || {}),
      unitType: unit?.type,
      softTags: unit?.implicitTags?.tags,
      fetchCache: workStore.fetchCache,
      forceDynamic: workStore.forceDynamic,
      draft: workStore.isDraftMode,
      onDemand: Boolean(workStore.isOnDemandRevalidate || incremental.isOnDemandRevalidate),
      minimalMode: incremental.minimalMode,
      revalidatedTags: incremental.revalidatedTags,
      hasScHost: Boolean(incremental.requestHeaders?.["x-vercel-sc-host"]),
    };
  } catch (err) {
    return { failed: err?.name || "error" };
  }
}

// cache() scopes this to one request, so the layout and the page share the same store.
const requestTiming = cache(() => ({
  start: performance.now(),
  dbAtStart: mongoose.connection.readyState,
  steps: {},
  pending: [],
  cacheInfo: watchCache(),
}));

// Calls work synchronously, so wrapping a read never changes when it starts or what it rejects with.
// A second call under the same name gets its own entry (name#2), so duplicate reads stay visible.
export function timed(name, work) {
  const timing = requestTiming();
  const startedAt = performance.now();
  let key = name;
  for (let n = 2; timing.steps[key]; n++) key = `${name}#${n}`;
  const step = { start: Math.round(startedAt - timing.start), ms: null };
  timing.steps[key] = step;
  const promise = Promise.resolve(work());
  const record = () => { step.ms = Math.round(performance.now() - startedAt); };
  timing.pending.push(promise.then(record, record));
  return promise;
}

export function readServerTiming() {
  const timing = requestTiming();
  return {
    totalMs: Math.round(performance.now() - timing.start),
    instanceAgeSec: Math.round(process.uptime()),
    // mongoose readyState when this request began: 1 = connected, 0 = had to connect
    dbAtStart: timing.dbAtStart,
    steps: timing.steps,
  };
}

// Streamed after the shell, so waiting for slower steps here does not delay the page.
export async function ServerTimingLate() {
  const timing = requestTiming();
  await Promise.all(timing.pending);
  const now = Date.now();
  const output = {
    ...readServerTiming(),
    cacheInfo: timing.cacheInfo,
    cacheTrace: trace.map(({ agoFrom, ...entry }) => ({ agoSec: Math.round((now - agoFrom) / 1000), ...entry })),
  };
  // createElement, not JSX: the cached readers import this file, and tests load those in plain node.
  // The soft tags carry the URL path, so "<" is escaped to keep it inside this script tag.
  return createElement("script", {
    type: "application/json",
    id: "server-timing-late",
    dangerouslySetInnerHTML: { __html: JSON.stringify(output).replace(/</g, "\\u003c") },
  });
}
